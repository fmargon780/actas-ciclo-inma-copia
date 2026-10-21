/* La lista de alumnado de «Rúbricas de Inma»: solo se LEE la carpeta RÚBRICAS, nunca se escribe en ella.
   Se abre una sola vez (Carpeta la recuerda). est.alumnado guarda el último resultado:
   { estado: 'ok' | 'sinCarpeta' | 'sinPermiso' | 'vacia' | 'error', lista: { todos, delCiclo, grupos } | null, handle, texto }. */
(function (g) {
  'use strict';
  var FRASE_NO_ES = 'Esta no es tu carpeta de Rúbricas: está en Mi unidad › RÚBRICAS.';

  async function cargar(est) {
    var r = { estado: 'sinCarpeta', lista: null, handle: null, texto: '' };
    try {
      var h = await g.Carpeta.rubricasRecordada();
      if (!h) { est.alumnado = r; return r; }
      r.handle = h;
      if ((await g.Carpeta.permisoLectura(h)) !== 'granted') { r.estado = 'sinPermiso'; est.alumnado = r; return r; }
      var raiz = g.Carpeta.adaptador(h);
      if (!(await raiz.leerJSON('rubricas.json'))) { r.texto = FRASE_NO_ES; est.alumnado = r; return r; }
      r.lista = await g.Alumnado.leerLista(raiz, est.ficha && est.ficha.ciclo);
      r.estado = r.lista.delCiclo.length ? 'ok' : 'vacia';
    } catch (e) { r.estado = 'error'; r.texto = 'No he podido leer la lista de alumnado: ' + ((e && e.message) || e); }
    est.alumnado = r;
    return r;
  }

  /* El botón «Abrir la carpeta RÚBRICAS»: la elige (una vez), comprueba que es la buena y la recuerda. Devuelve un texto de error o ''. */
  async function abrir(est) {
    try {
      var h = await g.Carpeta.elegirRubricas();
      if (!(await g.Carpeta.adaptador(h).leerJSON('rubricas.json'))) return FRASE_NO_ES;
      await g.Carpeta.guardarRubricas(h);
    } catch (e) { return e && e.name === 'AbortError' ? '' : ((e && e.message) || String(e)); }
    await cargar(est);
    return '';
  }

  /* Cuando el navegador retira el permiso: un clic de Inma lo da de nuevo. */
  async function darPermiso(est) {
    if (est.alumnado && est.alumnado.handle) await g.Carpeta.pedirPermisoLectura(est.alumnado.handle);
    await cargar(est);
  }

  g.Rubricas = { FRASE_NO_ES: FRASE_NO_ES, cargar: cargar, abrir: abrir, darPermiso: darPermiso };
})(window);
