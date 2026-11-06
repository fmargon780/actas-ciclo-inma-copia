/* La lista de alumnado de Rúbricas. Los datos de Rúbricas viven en ACTAS/rubricas (marca ACTAS/rubricas-pasadas.json): de ahí sale el alumnado.
   La carpeta RÚBRICAS de siempre ya no se lee desde aquí (fila 111): solo la leen «Pasar tus rúbricas aquí» y «Ya tenía una carpeta RÚBRICAS», en la pestaña.
   est.alumnado guarda el último resultado:
   { estado: 'ok' | 'sinCarpeta' | 'vacia' | 'error', lista: { todos, delCiclo, grupos } | null, handle: null, raiz, texto }. */
(function (g) {
  'use strict';

  async function cargar(est) {
    var r = { estado: 'sinCarpeta', lista: null, handle: null, raiz: null, texto: '' };
    try {
      if (g.RubPasar && est.raiz && await g.RubPasar.leerMarca(est)) {
        r.raiz = await est.raiz.sub('rubricas');
        r.lista = await g.Alumnado.leerLista(r.raiz, est.ficha && est.ficha.ciclo);
        r.estado = r.lista.delCiclo.length ? 'ok' : 'vacia';
      }
    } catch (e) { r.estado = 'error'; r.texto = 'No he podido leer la lista de alumnado: ' + ((e && e.message) || e); }
    est.alumnado = r;
    return r;
  }

  g.Rubricas = { cargar: cargar };
})(window);
