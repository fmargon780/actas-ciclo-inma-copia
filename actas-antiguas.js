/* Parte el texto de un documento de actas (el de Inma, «Actas de 2º ciclo 26-27») en actas sueltas y saca de cada una el orden del día.
   Sin pantalla ni red: se prueba con node --test. Usa fechas.js. */
(function (g) {
  'use strict';
  var NUM = /^\s*(\d{1,2})\s*[.)\-–]+\s*(.+?)\s*$/;
  var MAX_TEXTO = 600;

  function normal(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  /* «Celebrada el día 03/11/2025 a las 13:00 horas» -> [{ fecha: '2025-11-03', lineas: [...] }] */
  function trocear(texto) {
    var lineas = String(texto || '').split(/\r?\n/), actas = [], actual = null;
    lineas.forEach(function (l) {
      var m = /Celebrada el día (\d{2})\/(\d{2})\/(\d{4})/.exec(l);
      if (m) { actual = { fecha: m[3] + '-' + m[2] + '-' + m[1], lineas: [] }; actas.push(actual); }
      else if (actual) actual.lineas.push(l);
    });
    return actas;
  }

  /* De las líneas de un acta: [{ titulo, texto }]. El orden del día es la primera lista 1., 2., 3.… seguida; el texto de cada punto, lo que va bajo su
     título la segunda vez que aparece (si el acta no lo repite, queda vacío). */
  function puntosDe(lineas) {
    var i0 = -1, i;
    for (i = 0; i < lineas.length; i++) { var m0 = NUM.exec(lineas[i]); if (m0 && +m0[1] === 1) { i0 = i; break; } }
    if (i0 < 0) return [];
    var titulos = [], fin = i0;
    for (i = i0; i < lineas.length; i++) {
      var m = NUM.exec(lineas[i]);
      if (!m || +m[1] !== titulos.length + 1) break;
      titulos.push(m[2]); fin = i + 1;
    }
    var resto = lineas.slice(fin), posiciones = [], desde = 0;
    titulos.forEach(function (t, k) {
      var pos = -1;
      for (var j = desde; j < resto.length; j++) {
        var m2 = NUM.exec(resto[j]);
        if (m2 && +m2[1] === k + 1 && normal(m2[2]).slice(0, 25) === normal(t).slice(0, 25)) { pos = j; break; }
      }
      posiciones.push(pos); if (pos >= 0) desde = pos + 1;
    });
    return titulos.map(function (t, k) {
      var texto = '';
      if (posiciones[k] >= 0) {
        var hasta = resto.length;
        for (var q = k + 1; q < titulos.length; q++) if (posiciones[q] >= 0) { hasta = posiciones[q]; break; }
        texto = resto.slice(posiciones[k] + 1, Math.min(hasta, posiciones[k] + 9)).map(function (x) { return x.trim(); }).filter(Boolean).join(' ').slice(0, MAX_TEXTO);
      }
      return { titulo: t, texto: texto };
    });
  }

  /* Todo el documento -> [{ fecha, puntos: [{ titulo, texto }] }] (las actas sin orden del día no cuentan). */
  function leer(texto) {
    return trocear(texto).map(function (a) { return { fecha: a.fecha, puntos: puntosDe(a.lineas) }; }).filter(function (a) { return a.puntos.length; });
  }

  g.ActasAntiguas = { trocear: trocear, puntosDe: puntosDe, leer: leer, MAX_TEXTO: MAX_TEXTO };
})(typeof window !== 'undefined' ? window : globalThis);
