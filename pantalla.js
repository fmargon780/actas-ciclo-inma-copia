/* Pantallas sencillas comunes: pedir la carpeta y mostrar un error. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  function pedirCarpeta(texto, alPulsar, etiqueta) {
    g.Dom.montar([h('div', { class: 'vacio' }, [
      h('h2', { texto: 'Mi carpeta de actas ' }, [g.Ayuda.aviso('carpeta-actas')]),
      h('p', { id: 'textoCarpeta', texto: texto }),
      h('button', { type: 'button', class: 'boton principal', id: 'botonCarpeta', texto: etiqueta || 'Elegir mi carpeta ACTAS', onclick: alPulsar })
    ])]);
  }
  function error(texto) {
    g.Dom.montar([h('div', { class: 'vacio' }, [h('div', { class: 'aviso error', id: 'errorGeneral', texto: texto })])]);
  }
  g.Pantalla = { pedirCarpeta: pedirCarpeta, error: error };
})(window);
