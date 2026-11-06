/* La hoja tal como sale en el papel: la del alumno (cabecera y ejercicios) y la de soluciones, solo para la maestra.
   Todo texto entra con textContent. Se ve igual en pantalla y al imprimir (A4, negro sobre blanco). */
(function (g) {
  'use strict';
  var H = g.Hoja, DB = g.HojaDibujo, h = g.RubDom.h;
  var div = function (clase, hijos, texto) { return h('div', texto == null ? { class: clase } : { class: clase, texto: texto }, hijos); };
  var lineas = function (n) { var l = []; for (var i = 0; i < n; i++) l.push(div('linea')); return l; };
  var item = function (clase, texto) { return h('div', { class: clase }, [h('span', { class: 'marca' }), h('span', { texto: texto })]); };

  /* Cuerpo de cada tipo (lo que va debajo del enunciado). */
  var CUERPO = {
    elegir: function (e) { return e.contenido.opciones.map(function (o) { return item('opcion', o); }); },
    vf: function (e) { return e.contenido.frases.map(function (f) { return div('vf', [h('span', { class: 'vf-cajas' }, [h('span', { class: 'caja', texto: 'V' }), h('span', { class: 'caja', texto: 'F' })]), h('span', { texto: f })]); }); },
    huecos: function (e) {
      var p = h('p', { class: 'texto-huecos' });
      e.contenido.texto.split(/_{3,}/).forEach(function (t, i, l) { p.appendChild(document.createTextNode(t)); if (i < l.length - 1) p.appendChild(h('span', { class: 'hueco' })); });
      return [p];
    },
    unir: function (e) {
      var c = e.contenido, n = Math.max(c.izq.length, c.der.length), filas = [];
      for (var i = 0; i < n; i++) filas.push(div('unir-fila', [h('span', { texto: c.izq[i] || '' }), h('span', { class: 'punto' }), h('span', { class: 'flecha-hueco' }), h('span', { class: 'punto' }), h('span', { texto: c.der[i] || '' })]));
      return filas;
    },
    ordenar: function (e) { return e.contenido.elementos.map(function (o) { return item('ordenar', o); }); },
    rodear: function (e) { return [div('rodear', e.contenido.elementos.map(function (o) { return h('span', { class: 'elemento', texto: o }); }))]; },
    corta: function (e) { return lineas(e.contenido.lineas); },
    problema: function () { return ['Datos', 'Operación', 'Solución'].map(function (t) { return div('recuadro', [h('b', { texto: t })]); }); },
    dibujo: function (e) {
      var c = e.contenido, out = [];
      if (c.recta) out.push(DB.recta(c.recta.marcas));
      if (c.tabla) out.push(DB.tabla(c.tabla.filas, c.tabla.columnas));
      out.push(div('recuadro grande'));
      return out;
    },
    musica: function (e) { return [DB.pentagrama(e.contenido.modo, e.contenido.figuras)]; },
    libre: function (e) { return lineas(e.contenido.lineas); }
  };

  function ejercicio(e, n) {
    return div('ejercicio', [h('p', { class: 'enunciado' }, [h('b', { texto: n + '. ' }), document.createTextNode(e.enunciado)])].concat(CUERPO[e.tipo](e)));
  }
  /* Cabecera: colegio, área y grupo, título, y los huecos de nombre y fecha para rellenar a mano. Sin nombres del alumnado. */
  function cabecera(c) {
    return div('hoja-cabecera', [c.colegio ? h('p', { class: 'colegio', texto: c.colegio }) : null, h('p', { class: 'area-grupo', texto: c.area + ' · ' + c.grupo }), h('h2', { texto: c.titulo }),
      div('nombre-fecha', [h('span', { texto: 'Nombre: ' }, [h('span', { class: 'rellenar' })]), h('span', { texto: 'Fecha: ' }, [h('span', { class: 'rellenar corto' })])])]);
  }
  /* Los bloques de la hoja (cabecera y ejercicios), para medir cuántas caras ocupa. */
  function bloques(c, hoja) { return [cabecera(c)].concat(hoja.ejercicios.map(function (e, i) { return ejercicio(e, i + 1); })); }

  function soluciones(c, hoja, filas) {
    var texto = function (id) { var f = filas.filter(function (x) { return x.id === id; })[0]; return f ? f.texto : ''; };
    var raiz = div('hoja-soluciones', [h('p', { class: 'solo-maestra', texto: c.adaptada ? 'SOLUCIONES · VERSIÓN ADAPTADA · solo para la maestra' : 'SOLUCIONES · solo para la maestra' }), h('h2', { texto: c.titulo }), h('p', { class: 'area-grupo', texto: c.area + ' · ' + c.grupo })]);
    hoja.ejercicios.forEach(function (e, i) {
      var f = e.fila ? texto(e.fila) : '';
      raiz.appendChild(div('sol-ejercicio', [h('p', { class: 'enunciado' }, [h('b', { texto: (i + 1) + '. ' }), document.createTextNode(e.enunciado || '(sin enunciado)')]),
        h('p', { class: 'sol-respuesta', texto: H.solucionLegible(e) }), f ? h('p', { class: 'sol-fila', texto: 'Ayuda a calificar: ' + f }) : null]));
    });
    return raiz;
  }

  g.HojaPapel = { ejercicio: ejercicio, cabecera: cabecera, bloques: bloques, soluciones: soluciones };
})(window);
