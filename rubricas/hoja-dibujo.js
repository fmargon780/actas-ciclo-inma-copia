/* Dibujos de la hoja, en SVG dentro de la página (sin fuentes ni imágenes de fuera): pentagrama o línea de ritmo con figuras, recta numérica y tabla vacía.
   Todo en negro sobre blanco, para que se vea bien impreso en blanco y negro. */
(function (g) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function s(nombre, atributos, hijos) {
    var e = document.createElementNS(NS, nombre);
    Object.keys(atributos || {}).forEach(function (k) { e.setAttribute(k, atributos[k]); });
    (hijos || []).forEach(function (x) { e.appendChild(x); });
    return e;
  }
  var NEGRO = '#000';

  function cabeza(x, y, llena) { return s('ellipse', { cx: x, cy: y, rx: 7, ry: 5, transform: 'rotate(-20 ' + x + ' ' + y + ')', fill: llena ? NEGRO : '#fff', stroke: NEGRO, 'stroke-width': 2 }); }
  function plica(x, y) { return s('line', { x1: x + 6.5, y1: y - 1, x2: x + 6.5, y2: y - 34, stroke: NEGRO, 'stroke-width': 2 }); }
  function bandera(x, y) { return s('path', { d: 'M' + (x + 6.5) + ' ' + (y - 34) + ' q 12 6 8 20', fill: 'none', stroke: NEGRO, 'stroke-width': 2.5 }); }

  /* Cada figura devuelve sus trozos de dibujo y lo que ocupa a lo ancho. */
  var FIGURAS = {
    negra: function (x, y) { return { ancho: 44, trozos: [cabeza(x, y, true), plica(x, y)] }; },
    blanca: function (x, y) { return { ancho: 44, trozos: [cabeza(x, y, false), plica(x, y)] }; },
    corchea: function (x, y) { return { ancho: 44, trozos: [cabeza(x, y, true), plica(x, y), bandera(x, y)] }; },
    parcorcheas: function (x, y) {
      return { ancho: 64, trozos: [cabeza(x, y, true), plica(x, y), cabeza(x + 24, y, true), plica(x + 24, y),
        s('line', { x1: x + 6.5, y1: y - 33, x2: x + 30.5, y2: y - 33, stroke: NEGRO, 'stroke-width': 5 })] };
    },
    silencio: function (x, y) { return { ancho: 44, trozos: [s('path', { d: 'M' + (x - 2) + ' ' + (y - 16) + ' l 8 8 l -8 8 l 8 8 q -8 2 -4 8', fill: 'none', stroke: NEGRO, 'stroke-width': 3, 'stroke-linejoin': 'round' })] }; }
  };

  /* modo: 'pentagrama' (cinco líneas) o 'ritmo' (una sola línea). figuras: ids en orden. */
  function pentagrama(modo, figuras) {
    var y0 = modo === 'ritmo' ? 46 : 54, lineas = modo === 'ritmo' ? [46] : [30, 40, 50, 60, 70], x = 30, trozos = [];
    (figuras || []).forEach(function (f) { var r = FIGURAS[f](x, y0); r.trozos.forEach(function (t) { trozos.push(t); }); x += r.ancho; });
    var ancho = Math.max(640, x + 30), alto = modo === 'ritmo' ? 70 : 96;
    var dib = s('svg', { viewBox: '0 0 ' + ancho + ' ' + alto, width: '100%', class: 'dibujo-musica', role: 'img', 'aria-label': modo === 'ritmo' ? 'Línea de ritmo' : 'Pentagrama' });
    lineas.forEach(function (y) { dib.appendChild(s('line', { x1: 8, y1: y, x2: ancho - 8, y2: y, stroke: NEGRO, 'stroke-width': 1.5 })); });
    var arriba = lineas[0] - (modo === 'ritmo' ? 14 : 0), abajo = lineas[lineas.length - 1] + (modo === 'ritmo' ? 14 : 0);
    [8, ancho - 8].forEach(function (xb) { dib.appendChild(s('line', { x1: xb, y1: arriba, x2: xb, y2: abajo, stroke: NEGRO, 'stroke-width': xb === 8 ? 1.5 : 3 })); });
    trozos.forEach(function (t) { dib.appendChild(t); });
    return dib;
  }

  /* Recta numérica con las marcas escritas (repartidas a la misma distancia). */
  function recta(marcas) {
    var n = marcas.length, ancho = 640, dib = s('svg', { viewBox: '0 0 ' + ancho + ' 64', width: '100%', class: 'dibujo-recta', role: 'img', 'aria-label': 'Recta numérica' });
    dib.appendChild(s('line', { x1: 10, y1: 24, x2: ancho - 10, y2: 24, stroke: NEGRO, 'stroke-width': 2 }));
    dib.appendChild(s('path', { d: 'M' + (ancho - 18) + ' 17 l 9 7 l -9 7', fill: 'none', stroke: NEGRO, 'stroke-width': 2 }));
    marcas.forEach(function (m, i) {
      var x = 40 + i * (ancho - 100) / Math.max(1, n - 1);
      dib.appendChild(s('line', { x1: x, y1: 14, x2: x, y2: 34, stroke: NEGRO, 'stroke-width': 2 }));
      var t = s('text', { x: x, y: 56, 'text-anchor': 'middle', 'font-size': 18, 'font-family': 'Figtree, Arial, sans-serif', fill: NEGRO }); t.textContent = m;
      dib.appendChild(t);
    });
    return dib;
  }

  function tabla(filas, columnas) {
    var t = document.createElement('table'); t.className = 'tabla-vacia';
    for (var i = 0; i < filas; i++) { var tr = document.createElement('tr'); for (var j = 0; j < columnas; j++) tr.appendChild(document.createElement('td')); t.appendChild(tr); }
    return t;
  }

  g.HojaDibujo = { pentagrama: pentagrama, recta: recta, tabla: tabla };
})(window);
