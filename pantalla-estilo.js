/* Tarjeta «Estilo de redacción» de Ajustes (fila 63). Se guarda sola al cambiar, en ACTAS/estilo.json. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  async function tarjeta(est) {
    var actual = await g.Estilo.leer(est.raiz), aviso = g.Dom.aviso();
    var hecho = h('div', { class: 'aviso ok', id: 'estiloGuardado', hidden: '' });
    function selector(id, lista, valor) {
      return h('select', { id: id }, lista.map(function (x) { var o = h('option', { value: x[0], texto: x[1] }); if (x[0] === valor) o.selected = true; return o; }));
    }
    var extension = selector('estiloExtension', g.Estilo.EXTENSIONES, actual.extension);
    var lenguaje = selector('estiloLenguaje', g.Estilo.LENGUAJES, actual.lenguaje);
    var propias = h('textarea', { id: 'estiloInstrucciones', rows: '3', maxlength: String(g.Estilo.MAX_INSTRUCCIONES), placeholder: 'Por ejemplo: di siempre «el alumnado»; no uses la primera persona' });
    propias.value = actual.instrucciones;
    var guardando = Promise.resolve();
    function cambio() {
      var e = { extension: extension.value, lenguaje: lenguaje.value, instrucciones: propias.value };
      guardando = guardando.then(async function () {
        try { await g.Estilo.guardar(est.raiz, e); g.Dom.decir(aviso, ''); hecho.textContent = 'Estilo guardado.'; hecho.hidden = false; }
        catch (x) { hecho.hidden = true; g.Dom.decir(aviso, x.message || String(x)); }
      });
    }
    extension.addEventListener('change', cambio);
    lenguaje.addEventListener('change', cambio);
    propias.addEventListener('change', cambio);
    return h('section', { class: 'tarjeta ancha', id: 'tarjetaEstilo' }, [
      h('h2', { texto: 'Estilo de redacción ' }, [g.Ayuda.aviso('estilo-redaccion')]),
      h('p', { class: 'suave', texto: 'Cómo quieres que Claude redacte. Vale para todo: actas, entrevistas, reuniones con familias y actas de evaluación. Se guarda solo al cambiarlo.' }),
      h('label', { class: 'campo' }, ['Extensión', extension]),
      h('label', { class: 'campo' }, ['Lenguaje', lenguaje]),
      h('label', { class: 'campo' }, ['Instrucciones propias (opcional)', propias]),
      hecho, aviso
    ]);
  }
  g.PantallaEstilo = { tarjeta: tarjeta };
})(window);
