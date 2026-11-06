/* La lógica de rúbricas y notas, sin pantalla: sirve en el navegador y en las pruebas de Node.
   Rúbrica: { id, actividad, nombre, filas: [{ id, texto, peso, criterio?, celdas: [5 textos] }] } (`criterio` = id «area:código» de la actividad). Las notas de un alumno: { filaId: nivel 0..4 }. */
(function (g) {
  'use strict';

  var NIVELES = [
    { nombre: 'Insuficiente', valor: 3 }, { nombre: 'Suficiente', valor: 5 }, { nombre: 'Bien', valor: 6 },
    { nombre: 'Notable', valor: 8 }, { nombre: 'Sobresaliente', valor: 10 }
  ];
  var CORTOS = ['Ins', 'Sufi', 'Bien', 'Not', 'Sobre'];

  function nuevoId(prefijo) { return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function copia(x) { return JSON.parse(JSON.stringify(x)); }

  function filaNueva(texto) { return { id: nuevoId('f'), texto: texto || '', peso: 1, celdas: ['', '', '', '', ''] }; }
  function rubricaNueva(actividad, nombre, nFilas) {
    var filas = [];
    for (var i = 0; i < (nFilas == null ? 3 : nFilas); i++) filas.push(filaNueva(''));
    return { id: nuevoId('r'), actividad: actividad, nombre: nombre || '', filas: filas };
  }
  /* Una copia lista para otra actividad: mismos textos y pesos, identificadores nuevos. */
  function copiarRubrica(r, actividad, nombre, criterios) {
    var c = copia(r);
    c.id = nuevoId('r'); c.actividad = actividad; c.nombre = nombre || r.nombre; delete c.plantilla;
    c.filas.forEach(function (f) { f.id = nuevoId('f'); });
    /* Una plantilla no lleva criterio: con un solo criterio las filas lo toman; con varios salen «Sin criterio». */
    if (criterios) c.filas.forEach(function (f) { f.criterio = criterios.length === 1 ? criterios[0] : ''; });
    return c;
  }

  /* `criterio` (opcional): el criterio de la fila nueva. Sin él, la fila no lleva criterio (rúbricas de un solo criterio). */
  function anadirFila(r, criterio) { var c = copia(r), f = filaNueva(''); if (criterio) f.criterio = criterio; c.filas.push(f); return c; }
  function quitarFila(r, fid) { var c = copia(r); c.filas = c.filas.filter(function (f) { return f.id !== fid; }); return c; }
  function moverFila(r, fid, delta) {
    var c = copia(r), i = c.filas.findIndex(function (f) { return f.id === fid; }), j = i + delta;
    if (i < 0 || j < 0 || j >= c.filas.length) return c;
    var t = c.filas[i]; c.filas[i] = c.filas[j]; c.filas[j] = t;
    return c;
  }
  function ponerPeso(r, fid, peso) {
    var p = Number(String(peso).replace(',', '.'));
    if (!isFinite(p) || p <= 0) throw new Error('El peso tiene que ser un número mayor que cero.');
    var c = copia(r); c.filas.forEach(function (f) { if (f.id === fid) f.peso = p; }); return c;
  }
  /* Valores de los cinco niveles escritos por Inma → lista de números (o error con un mensaje claro). */
  function validarValores(textos) {
    if (textos.length !== 5) throw new Error('Tienen que ser cinco niveles.');
    return textos.map(function (t) {
      var v = Number(String(t).replace(',', '.'));
      if (String(t).trim() === '' || !isFinite(v) || v < 0 || v > 10) throw new Error('El valor de cada nivel es un número entre 0 y 10.');
      return v;
    });
  }

  /* Nota (0-10) de un alumno: media ponderada de los valores de los niveles elegidos. Solo cuentan las filas ya calificadas. */
  function nota(r, valores, eleccion) {
    var suma = 0, pesos = 0;
    r.filas.forEach(function (f) {
      var n = eleccion && eleccion[f.id];
      if (typeof n !== 'number' || n < 0 || n > 4) return;
      suma += f.peso * valores[n]; pesos += f.peso;
    });
    return pesos ? suma / pesos : null;
  }
  function completo(r, eleccion) { return r.filas.length > 0 && r.filas.every(function (f) { return eleccion && typeof eleccion[f.id] === 'number'; }); }

  /* «Cómo va»: alumnos calificados del todo, media del grupo y la fila con la media más baja. */
  function resumen(r, valores, alumnos, notas) {
    var sumaNotas = 0, n = 0, calificados = 0, porFila = {};
    alumnos.forEach(function (a) {
      var e = notas[a] || {}, v = nota(r, valores, e);
      if (v != null) { sumaNotas += v; n++; }
      if (completo(r, e)) calificados++;
      r.filas.forEach(function (f) {
        if (typeof e[f.id] !== 'number') return;
        porFila[f.id] = porFila[f.id] || { s: 0, c: 0 }; porFila[f.id].s += valores[e[f.id]]; porFila[f.id].c++;
      });
    });
    var floja = null;
    r.filas.forEach(function (f) {
      var p = porFila[f.id]; if (!p) return;
      var m = p.s / p.c;
      if (!floja || m < floja.media) floja = { fila: f.id, texto: f.texto, media: m };
    });
    return { calificados: calificados, total: alumnos.length, media: n ? sumaNotas / n : null, filaFloja: floja };
  }

  function ordenar(nombres) { return nombres.slice().sort(function (a, b) { return a.localeCompare(b, 'es', { sensitivity: 'base' }); }); }
  /* Listado para Séneca: todo el grupo, en orden alfabético, con la nota del criterio (media de las actividades que lo evalúan).
     `notasPorActividad`: lista de { nombre → nota|null }. Sin ninguna nota, la casilla queda vacía. */
  function listadoSeneca(alumnos, notasPorActividad) {
    return ordenar(alumnos).map(function (a) {
      var s = 0, c = 0;
      notasPorActividad.forEach(function (m) { if (typeof m[a] === 'number') { s += m[a]; c++; } });
      return { nombre: a, nota: c ? Math.round(s / c * 10) / 10 : null };
    });
  }
  function dec(n) { return n == null ? '' : String(n).replace('.', ','); }
  function textoListado(filas) { return filas.map(function (f) { return f.nombre + '\t' + dec(f.nota); }).join('\n'); }
  function csvListado(filas) {
    return '﻿' + ['Alumno/a;Nota'].concat(filas.map(function (f) { return '"' + f.nombre.replace(/"/g, '""') + '";' + dec(f.nota); })).join('\r\n') + '\r\n';
  }

  /* ---- Varios criterios por actividad (fila 23). Los criterios de una actividad son ids «area:código» (actividad.criterios). ---- */
  var ABREV = { 'educacion-artistica': 'ART', 'lengua-castellana-y-literatura': 'LEN', 'matematicas': 'MAT' };
  function areaDe(id) { return String(id).split(':')[0]; }
  function codigoDe(id) { var t = String(id).split(':'); return t[1] || t[0]; }
  function abreviatura(areaId) { return ABREV[areaId] || String(areaId).replace(/-/g, '').slice(0, 3).toUpperCase(); }
  /* Código del criterio; con criterios de más de un área va precedido del área abreviada («ART 3.1.b»). */
  function etiquetaCriterio(id, ids) {
    var areas = {}; ids.forEach(function (x) { areas[areaDe(x)] = 1; });
    return Object.keys(areas).length > 1 ? abreviatura(areaDe(id)) + ' ' + codigoDe(id) : codigoDe(id);
  }
  /* Título de un grupo de filas: código y principio del texto oficial. `Crit` = Criterios (o null), `curso` = nº del curso. */
  function tituloCriterio(id, ids, Crit, curso) {
    if (!id) return 'Sin criterio';
    var k = Crit && curso ? Crit.buscar(id, curso) : null, t = k ? k.texto : '';
    return etiquetaCriterio(id, ids) + (t ? ' · ' + (t.length > 70 ? t.slice(0, 70).replace(/\s+\S*$/, '') + '…' : t) : '');
  }
  /* A qué criterio pertenece una fila: el suyo; si la rúbrica es vieja (sin campo) y la actividad tiene uno solo, ese; si no, '' («Sin criterio»). */
  function criterioDe(f, criterios) {
    if (f.criterio == null) return criterios.length === 1 ? criterios[0] : '';
    return criterios.indexOf(f.criterio) >= 0 ? f.criterio : '';
  }
  /* Filas agrupadas por criterio, en el orden de la actividad: [{ criterio, filas }] (los criterios sin filas salen vacíos; «Sin criterio» solo si hay). */
  function agrupar(r, criterios) {
    var grupos = criterios.map(function (c) { return { criterio: c, filas: [] }; }), sin = { criterio: '', filas: [] };
    r.filas.forEach(function (f) {
      var c = criterioDe(f, criterios);
      (grupos.filter(function (x) { return x.criterio === c; })[0] || sin).filas.push(f);
    });
    if (sin.filas.length) grupos.push(sin);
    return grupos;
  }
  /* Nota de cada criterio: media ponderada solo de sus filas. { criterio: nota|null }. */
  function notasPorCriterio(r, criterios, valores, eleccion) {
    var out = {};
    agrupar(r, criterios).forEach(function (g) { if (g.criterio) out[g.criterio] = nota({ filas: g.filas }, valores, eleccion); });
    return out;
  }
  /* Lo que impide guardar: criterios sin filas y filas sin criterio. Lista de avisos (vacía si está bien). */
  function problemas(r, criterios) {
    var out = [], sin = 0;
    agrupar(r, criterios).forEach(function (g) {
      if (!g.criterio) { sin = g.filas.length; return; }
      if (!g.filas.some(function (f) { return String(f.texto).trim(); })) out.push('El criterio ' + etiquetaCriterio(g.criterio, criterios) + ' no tiene ninguna fila');
    });
    if (sin) out.push('Hay ' + sin + (sin === 1 ? ' fila sin criterio' : ' filas sin criterio'));
    return out;
  }
  function asignarCriterio(r, fid, criterio) { var c = copia(r); c.filas.forEach(function (f) { if (f.id === fid) f.criterio = criterio; }); return c; }
  /* La rúbrica tras cambiar los criterios de la actividad de `antes` a `ahora`: sella las filas viejas con su criterio y deja «Sin criterio» las del que se quita. */
  function alinear(r, antes, ahora) {
    var c = copia(r);
    c.filas.forEach(function (f) { var k = criterioDe(f, antes); f.criterio = ahora.indexOf(k) >= 0 ? k : ''; });
    return c;
  }
  /* Sube o baja una fila dentro de su criterio (las demás no se mueven). */
  function moverEnGrupo(r, fid, delta, criterios) {
    var c = copia(r), i = c.filas.findIndex(function (f) { return f.id === fid; });
    if (i < 0) return c;
    var k = criterioDe(c.filas[i], criterios), idx = [];
    c.filas.forEach(function (f, n) { if (criterioDe(f, criterios) === k) idx.push(n); });
    var p = idx.indexOf(i), q = p + delta;
    if (q < 0 || q >= idx.length) return c;
    var t = c.filas[idx[p]]; c.filas[idx[p]] = c.filas[idx[q]]; c.filas[idx[q]] = t;
    return c;
  }
  /* Añadir un criterio a una lista (sin repetir) y quitarlo (siempre queda uno del área de la actividad). */
  function anadirCriterio(lista, id) {
    if (lista.indexOf(id) >= 0) throw new Error('Ese criterio ya está en la actividad.');
    return lista.concat([id]);
  }
  function puedeQuitarCriterio(lista, id, area) { return !area || areaDe(id) !== area || lista.filter(function (x) { return areaDe(x) === area; }).length > 1; }

  /* Listado para Séneca de una actividad con varios criterios: una columna por criterio.
     columnas: [{ id, etiqueta, notasPorActividad }] (cada columna con la misma forma que `listadoSeneca`). */
  function tablaSeneca(alumnos, columnas) {
    var listas = columnas.map(function (c) { return listadoSeneca(alumnos, c.notasPorActividad); });
    return { columnas: columnas.map(function (c) { return { id: c.id, etiqueta: c.etiqueta }; }),
      filas: ordenar(alumnos).map(function (a, i) { return { nombre: a, notas: listas.map(function (l) { return l[i].nota; }) }; }) };
  }
  function textoColumna(t, i) { return t.filas.map(function (f) { return f.nombre + '\t' + dec(f.notas[i]); }).join('\n'); }
  function csvTabla(t) {
    return '﻿' + ['Alumno/a;' + t.columnas.map(function (c) { return c.etiqueta; }).join(';')].concat(t.filas.map(function (f) {
      return '"' + f.nombre.replace(/"/g, '""') + '";' + f.notas.map(dec).join(';');
    })).join('\r\n') + '\r\n';
  }

  var api = { NIVELES: NIVELES, CORTOS: CORTOS, nuevoId: nuevoId, filaNueva: filaNueva, rubricaNueva: rubricaNueva, copiarRubrica: copiarRubrica,
    anadirFila: anadirFila, quitarFila: quitarFila, moverFila: moverFila, ponerPeso: ponerPeso, validarValores: validarValores,
    nota: nota, completo: completo, resumen: resumen, ordenar: ordenar, listadoSeneca: listadoSeneca, textoListado: textoListado, csvListado: csvListado,
    areaDe: areaDe, codigoDe: codigoDe, abreviatura: abreviatura, etiquetaCriterio: etiquetaCriterio, tituloCriterio: tituloCriterio, criterioDe: criterioDe,
    agrupar: agrupar, notasPorCriterio: notasPorCriterio, problemas: problemas, asignarCriterio: asignarCriterio, alinear: alinear, moverEnGrupo: moverEnGrupo,
    anadirCriterio: anadirCriterio, puedeQuitarCriterio: puedeQuitarCriterio, tablaSeneca: tablaSeneca, textoColumna: textoColumna, csvTabla: csvTabla };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.Rubrica = api;
})(typeof window !== 'undefined' ? window : globalThis);
