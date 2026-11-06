/* Lee el listado de un grupo bajado de Séneca (CSV con punto y coma en Latin-1, o .xls que en realidad es una tabla HTML)
   y devuelve solo los nombres. Lógica pura: sirve en el navegador y en las pruebas de Node. */
(function (g) {
  'use strict';

  function aTexto(bytes) {
    var u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u).replace(/^﻿/, ''); } catch (e) { /* no es UTF-8: Latin-1 */ }
    return new TextDecoder('windows-1252').decode(u);
  }

  function separador(linea) {
    var mejor = ';', n = -1;
    [';', '\t', ','].forEach(function (s) { var c = linea.split(s).length; if (c > n) { n = c; mejor = s; } });
    return mejor;
  }

  function filasCSV(texto) {
    var lineas = texto.split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; });
    if (!lineas.length) return [];
    var sep = separador(lineas[0]);
    return lineas.map(function (l) {
      var campos = [], cur = '', q = false;
      for (var i = 0; i < l.length; i++) {
        var c = l[i];
        if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
        else if (c === '"') q = true;
        else if (c === sep) { campos.push(cur); cur = ''; }
        else cur += c;
      }
      campos.push(cur);
      return campos.map(function (x) { return x.trim(); });
    });
  }

  function entidades(t) {
    return t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); });
  }

  function filasHTML(texto) {
    var filas = [];
    (texto.match(/<tr[\s\S]*?<\/tr>/gi) || []).forEach(function (tr) {
      var celdas = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(function (c) { return entidades(c.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(); });
      if (celdas.some(function (c) { return c !== ''; })) filas.push(celdas);
    });
    return filas;
  }

  function clave(t) { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z/ ]/g, '').trim(); }

  /* Devuelve { ok, nombres, motivo }. */
  function reconocerAlumnos(bytes) {
    var u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!u.length) return { ok: false, nombres: [], motivo: 'El fichero está vacío.' };
    if (u[0] === 0xD0 && u[1] === 0xCF) return { ok: false, nombres: [], motivo: 'Es un Excel antiguo que no puedo leer. Ábrelo y guárdalo como CSV, o escribe los nombres a mano.' };
    if (u[0] === 0x50 && u[1] === 0x4B) return { ok: false, nombres: [], motivo: 'Es un Excel moderno (.xlsx) que no puedo leer. Guárdalo como CSV, o escribe los nombres a mano.' };
    var texto = aTexto(u);
    var filas = /<tr[\s>]/i.test(texto) ? filasHTML(texto) : filasCSV(texto);
    for (var i = 0; i < filas.length; i++) {
      var cab = filas[i].map(clave);
      var iAl = cab.findIndex(function (c) { return /^alumn[oa]\/?a?$|^alumnado$|^alumno\/a$/.test(c) || c === 'nombre y apellidos' || c === 'apellidos y nombre'; });
      var iAp = cab.findIndex(function (c) { return /^apellidos?$/.test(c); });
      var iNo = cab.findIndex(function (c) { return c === 'nombre'; });
      var nombres = [];
      if (iAl >= 0) nombres = filas.slice(i + 1).map(function (f) { return f[iAl] || ''; });
      else if (iAp >= 0 && iNo >= 0) nombres = filas.slice(i + 1).map(function (f) { return f[iAp] && f[iNo] ? f[iAp] + ', ' + f[iNo] : ''; });
      else continue;
      nombres = nombres.map(function (n) { return n.replace(/\s+/g, ' ').trim(); }).filter(function (n) { return n !== ''; });
      var vistos = {};
      nombres = nombres.filter(function (n) { if (vistos[n]) return false; vistos[n] = 1; return true; });
      if (nombres.length) return { ok: true, nombres: nombres, motivo: '' };
    }
    return { ok: false, nombres: [], motivo: 'No encuentro la columna con los nombres (busco «Alumno/a» o «Apellidos» y «Nombre»). Puedes escribir los nombres a mano.' };
  }

  /* Nombres escritos a mano: uno por línea. */
  function nombresDeTexto(texto) {
    var vistos = {};
    return String(texto).split(/\r\n|\n|\r/).map(function (n) { return n.replace(/\s+/g, ' ').trim(); })
      .filter(function (n) { if (!n || vistos[n]) return false; vistos[n] = 1; return true; });
  }

  var api = { reconocerAlumnos: reconocerAlumnos, nombresDeTexto: nombresDeTexto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.Seneca = api;
})(typeof window !== 'undefined' ? window : globalThis);
