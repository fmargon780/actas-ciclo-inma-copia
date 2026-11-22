/* Pantallas sencillas comunes: pedir la carpeta y mostrar un error. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  /* Fila 120: a dónde quería ir quien pulsó un botón de arriba mientras faltaba la carpeta ('inicio', 'rubricas' o 'ajustes'). */
  var destino = null;
  function tomarDestino() { var d = destino; destino = null; return d; }
  function pedirCarpeta(texto, alPulsar, etiqueta) {
    /* Sin carpeta, Inicio, Rúbricas y Ajustes hacen lo mismo que el botón grande y, al abrirla, llevan adonde se pulsó. */
    [['pasoInicio', 'inicio'], ['pasoRubricas', 'rubricas'], ['pasoAjustes', 'ajustes']].forEach(function (b) {
      var el = g.document.getElementById(b[0]);
      if (el) el.onclick = function () { destino = b[1]; return alPulsar(); };
    });
    g.Dom.montar([h('div', { class: 'vacio' }, [
      h('h2', { texto: 'Mi carpeta de actas ' }, [g.Ayuda.aviso('carpeta-actas')]),
      h('p', { id: 'textoCarpeta', texto: texto }),
      h('button', { type: 'button', class: 'boton principal', id: 'botonCarpeta', texto: etiqueta || 'Elegir mi carpeta ACTAS', onclick: alPulsar })
    ])]);
  }
  function error(texto) {
    g.Dom.montar([h('div', { class: 'vacio' }, [h('div', { class: 'aviso error', id: 'errorGeneral', texto: texto })])]);
  }
  g.Pantalla = { pedirCarpeta: pedirCarpeta, tomarDestino: tomarDestino, error: error };
})(window);
