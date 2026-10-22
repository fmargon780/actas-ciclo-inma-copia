/* Ajustes: la clave de Claude (clave.json), o copiarla de la carpeta RÚBRICAS. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  async function pintarAjustes(est, refrescar) {
    var actual = await g.Datos.leerClave(est.raiz);
    var aviso = g.Dom.aviso();
    var dicho = h('div', { class: 'aviso ok', id: 'clavePuesta', hidden: '' });
    var campo = h('input', { type: 'password', id: 'campoClave', autocomplete: 'off', placeholder: 'Pega aquí la clave de Claude', value: actual });
    function ok(texto) { dicho.textContent = texto; dicho.hidden = false; g.Dom.decir(aviso, ''); }

    var guardar = h('button', { type: 'button', class: 'boton principal', id: 'guardarClave', texto: 'Guardar la clave', onclick: async function () {
      var v = campo.value.trim();
      if (!v) { g.Dom.decir(aviso, 'Escribe o pega la clave primero.'); return; }
      try { await g.Datos.guardarClave(est.raiz, v); ok('Clave guardada.'); } catch (e) { g.Dom.decir(aviso, e.message || String(e)); }
    } });
    var deRubricas = h('button', { type: 'button', class: 'boton', id: 'claveDeRubricas', texto: 'Usar la de Rúbricas', onclick: async function () {
      try {
        var otra = await g.Carpeta.elegirRubricas();
        var raiz = g.Carpeta.adaptador(otra);
        var marca = await raiz.leerJSON('rubricas.json');
        if (!marca) { g.Dom.decir(aviso, g.Rubricas.FRASE_NO_ES); return; }
        await g.Carpeta.guardarRubricas(otra); est.alumnado = null; /* la lista de alumnado usa esta misma carpeta */
        var c = await g.Datos.leerClave(raiz);
        if (!c) { g.Dom.decir(aviso, 'En Rúbricas todavía no hay ninguna clave guardada.'); return; }
        await g.Datos.guardarClave(est.raiz, c); campo.value = c; ok('Clave copiada de Rúbricas.');
      } catch (e) { if (e && e.name === 'AbortError') return; g.Dom.decir(aviso, e.message || String(e)); }
    } });
    var tutoria = await g.PantallaTutoria.tarjeta(est, function () { refrescar(); });
    g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [
      h('h2', { texto: 'Clave de Claude' }),
      h('p', { class: 'suave', texto: 'Se guarda en tu carpeta ACTAS. La usará Claude para redactar las actas.' }),
      campo, h('div', { class: 'fila' }, [guardar, deRubricas]), dicho, aviso
    ]), tutoria]);
  }
  g.PantallaAjustes = { pintarAjustes: pintarAjustes };
})(window);
