/* «Lo habitual» (fila 17): los puntos que se repiten en las reuniones de cada mes, aprendidos de las actas y retocados por Inma.
   Sin pantalla: la carpeta entra por parámetro (adaptador de carpeta.js) y se prueba con node --test. Se guarda en ACTAS/habitual.json:
   { formato, meses: { '11': { orden, puntos: [{ id, titulo, huecos, porGrupo, veces, origen, editado, alias }] } }, borrados: { '11': [titulos] },
     actas: [fechas ya aprendidas], fuentes: [{ nombre, actas, aprendido }], cambiado }.
   Los puntos se guardan en versión general (sin fechas, efemérides ni nombres). Lo que Inma cambia a mano manda sobre lo aprendido. */
(function (g) {
  'use strict';
  var FICHERO = 'habitual.json';
  var PUNTO_ANTERIOR = 'Lectura y aprobación del acta anterior';
  var OBLIGATORIOS = [PUNTO_ANTERIOR];
  var HUECOS_GRUPO = ['Cómo es el grupo', 'Dificultades por área', 'Casos concretos'];
  var HUECOS_FINAL = ['Acuerdos y propuestas de mejora'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var ORDEN_CURSO = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
  var VACIAS = ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'al', 'a', 'un', 'una', 'mes', 'meses', 'proximos', 'proximo', 'este', 'esta', 'para', 'con', 'por'];

  function normal(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function esAnterior(t) { return normal(t) === normal(PUNTO_ANTERIOR); }
  function esEvaluacion(t) { return /sesi[oó]n(es)? de evaluaci[oó]n/i.test(String(t || '')); }
  function nombreMes(m) { return MESES[Number(m) - 1]; }
  function mesDe(iso) { var m = /^\d{4}-(\d{2})-\d{2}$/.exec(String(iso || '')); return m ? String(Number(m[1])) : null; }

  /* El título en versión general: sin lo que va tras los dos puntos, sin fechas, años ni meses concretos. */
  function generalizar(titulo) {
    var t = String(titulo || '').replace(/\s+/g, ' ').trim();
    var dos = t.indexOf(':'); if (dos > 0) t = t.slice(0, dos);
    var mes = '(?:' + MESES.join('|') + ')';
    t = t.replace(new RegExp('\\b(?:del mes de|de|del|en)\\s+' + mes + '(?:\\s*(?:,|y|e)\\s*' + mes + ')+', 'gi'), 'de los próximos meses');
    t = t.replace(new RegExp('\\b(?:del mes de|de|del|en)\\s+' + mes + '\\b', 'gi'), 'del mes');
    t = t.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '').replace(/\b(?:curso\s+)?20\d\d(?:\s*[-\/]\s*(?:20)?\d\d)?\b/gi, '');
    t = t.replace(/\s+/g, ' ').replace(/[\s,;.\-–]+$/, '').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }

  function palabras(t) {
    return normal(t).split(' ').filter(function (w) { return w && VACIAS.indexOf(w) < 0; }).map(function (w) { return w.slice(0, 6); });
  }
  /* ¿El mismo punto, aunque cambie un poco la redacción? */
  function parecidos(a, b) {
    var x = palabras(a), y = palabras(b);
    if (!x.length || !y.length) return normal(a) === normal(b);
    var comunes = x.filter(function (w) { return y.indexOf(w) >= 0; }).length, union = x.length + y.length - comunes;
    return comunes / union >= 0.6 && comunes >= Math.min(2, x.length, y.length);
  }

  function vacio() { return { formato: 1, meses: {}, borrados: {}, actas: [], fuentes: [], cambiado: null }; }
  function mes(h, m) { return h.meses[m] || (h.meses[m] = { orden: false, puntos: [] }); }
  function nuevoId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function sinRepetir(l) { var v = {}; return (l || []).map(function (x) { return String(x || '').trim(); }).filter(function (x) { var k = normal(x); if (!k || v[k]) return false; v[k] = true; return true; }); }

  function buscar(h, m, titulo) {
    var p = (h.meses[m] && h.meses[m].puntos) || [];
    for (var i = 0; i < p.length; i++) {
      if (parecidos(p[i].titulo, titulo) || (p[i].alias || []).some(function (a) { return parecidos(a, titulo); })) return p[i];
    }
    return null;
  }
  function estaBorrado(h, m, titulo) { return ((h.borrados && h.borrados[m]) || []).some(function (b) { return parecidos(b, titulo); }); }

  function ordenarPorVeces(mm) {
    if (mm.orden) return;
    mm.puntos = mm.puntos.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) { return (b.p.veces - a.p.veces) || (a.i - b.i); }).map(function (x) { return x.p; });
  }

  /* Suma una acta: { fecha, puntos: [{ titulo, huecos }] }. Cada fecha se aprende una sola vez. Devuelve cuántos puntos nuevos entraron. */
  function aprender(h, acta) {
    var m = mesDe(acta.fecha), nuevos = 0;
    if (!m || h.actas.indexOf(acta.fecha) >= 0) return 0;
    h.actas.push(acta.fecha);
    acta.puntos.forEach(function (p) {
      if (esAnterior(p.titulo)) return;
      var t = generalizar(p.titulo);
      if (!t || esAnterior(t) || estaBorrado(h, m, t)) return;
      var huecos = sinRepetir(p.huecos), ya = buscar(h, m, t);
      if (ya) {
        ya.veces++;
        if (!ya.editado) ya.huecos = sinRepetir((ya.huecos || []).concat(huecos));
        return;
      }
      var punto = { id: nuevoId(), titulo: t, huecos: huecos, veces: 1, origen: 'aprendido', editado: false, alias: [] };
      if (esEvaluacion(t)) { punto.porGrupo = HUECOS_GRUPO.slice(); punto.huecos = HUECOS_FINAL.slice(); }
      mes(h, m).puntos.push(punto); nuevos++;
    });
    if (h.meses[m]) ordenarPorVeces(h.meses[m]);
    return nuevos;
  }

  function buscarId(h, m, id) { return ((h.meses[m] && h.meses[m].puntos) || []).filter(function (p) { return p.id === id; })[0] || null; }

  /* --- Lo que cambia Inma: manda sobre lo aprendido --- */
  function quitar(h, m, id) {
    var mm = h.meses[m], p = buscarId(h, m, id);
    if (!p) return h;
    mm.puntos = mm.puntos.filter(function (x) { return x.id !== id; });
    h.borrados[m] = sinRepetir((h.borrados[m] || []).concat([p.titulo], p.alias || []));
    return h;
  }
  function cambiarTitulo(h, m, id, nuevo) {
    var p = buscarId(h, m, id), t = String(nuevo || '').replace(/\s+/g, ' ').trim();
    if (!p || !t || t === p.titulo) return h;
    p.alias = sinRepetir((p.alias || []).concat([p.titulo])); p.titulo = t; p.editado = true;
    return h;
  }
  function cambiarHuecos(h, m, id, huecos) { var p = buscarId(h, m, id); if (p) { p.huecos = sinRepetir(huecos); p.editado = true; } return h; }
  function anadir(h, m, titulo) {
    var t = String(titulo || '').replace(/\s+/g, ' ').trim();
    if (!t || esAnterior(t)) return null;
    var mm = mes(h, m), p = { id: nuevoId(), titulo: t, huecos: [], veces: 1, origen: 'inma', editado: true, alias: [] };
    h.borrados[m] = (h.borrados[m] || []).filter(function (b) { return !parecidos(b, t); });
    if (esEvaluacion(t)) { p.porGrupo = HUECOS_GRUPO.slice(); p.huecos = HUECOS_FINAL.slice(); }
    mm.puntos.push(p); mm.orden = true;
    return p;
  }
  function mover(h, m, id, delta) {
    var mm = h.meses[m]; if (!mm) return h;
    var i = mm.puntos.map(function (p) { return p.id; }).indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= mm.puntos.length) return h;
    var x = mm.puntos[i]; mm.puntos[i] = mm.puntos[j]; mm.puntos[j] = x; mm.orden = true;
    return h;
  }

  /* Lo que se propone para una reunión de ese mes: lo obligatorio primero y después lo habitual, en orden. */
  function proponer(h, m) {
    var res = OBLIGATORIOS.map(function (t) { return { titulo: t, huecos: [] }; });
    (((h.meses && h.meses[m]) || {}).puntos || []).forEach(function (p) {
      if (esAnterior(p.titulo)) return;
      var o = { titulo: p.titulo, huecos: (p.huecos || []).slice() };
      if (p.porGrupo && p.porGrupo.length) o.porGrupo = p.porGrupo.slice();
      res.push(o);
    });
    return res;
  }

  /* Los meses con algo, en el orden del curso (septiembre primero). */
  function mesesConDatos(h) {
    return ORDEN_CURSO.filter(function (m) { return h.meses[m] && h.meses[m].puntos.length; });
  }

  async function leer(raiz) {
    var h = null;
    try { h = await raiz.leerJSON(FICHERO); } catch (e) { h = null; }
    if (!h || typeof h !== 'object' || !h.meses) return vacio();
    h.borrados = h.borrados || {}; h.actas = h.actas || []; h.fuentes = h.fuentes || [];
    return h;
  }
  async function guardar(raiz, h, ahora) { h.cambiado = (ahora || new Date()).toISOString(); await raiz.escribirJSON(FICHERO, h); return h; }

  /* Suma las actas creadas con «Crear acta» que aún no se habían aprendido (sin Claude: solo sus títulos). Devuelve cuántas. */
  async function sumarCreadas(raiz, h, ficha) {
    var actas = await g.Fichas.leerActas(raiz, ficha), sumadas = 0;
    actas.forEach(function (e) {
      if (h.actas.indexOf(e.fecha) >= 0) return;
      aprender(h, { fecha: e.fecha, puntos: e.puntos.map(function (p) { return { titulo: p.titulo, huecos: p.huecos || [] }; }) });
      sumadas++;
    });
    return sumadas;
  }

  g.Habitual = {
    FICHERO: FICHERO, PUNTO_ANTERIOR: PUNTO_ANTERIOR, OBLIGATORIOS: OBLIGATORIOS, HUECOS_GRUPO: HUECOS_GRUPO, HUECOS_FINAL: HUECOS_FINAL, MESES: MESES,
    nombreMes: nombreMes, mesDe: mesDe, generalizar: generalizar, parecidos: parecidos, esAnterior: esAnterior, esEvaluacion: esEvaluacion, vacio: vacio,
    aprender: aprender, quitar: quitar, cambiarTitulo: cambiarTitulo, cambiarHuecos: cambiarHuecos, anadir: anadir, mover: mover, proponer: proponer,
    mesesConDatos: mesesConDatos, leer: leer, guardar: guardar, sumarCreadas: sumarCreadas
  };
})(typeof window !== 'undefined' ? window : globalThis);
