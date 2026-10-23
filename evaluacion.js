/* El acta de sesión de evaluación (fila 59), la parte que calcula: las cuatro sesiones, las áreas, qué hay apuntado y qué no, y cómo se guarda.
   Sin pantalla ni red: se prueba con node --test. Cada acta se guarda en ACTAS/evaluaciones/<id>.json:
   { formato, id, curso, clase, sesion: 'inicial'|'primera'|'segunda'|'final', fecha, estado: 'borrador'|'creada',
     composicion: { chicas, chicos }, areas: [{ nombre, notas, porcentaje, porcentajeAMano, porcentajeDeRubricas? }], areasQuitadas: [nombres],
     alumnos: [{ nombre, grupo, notas }] (solo con algo apuntado), orientacion, observaciones, conclusiones, informesAnteriores,
     textos: { seneca: [5 cajas], anexo: { IA, IB, IC, II, III, IV } }, notasRedactadas, resumenCiclo, documentos?, creada }.
   `resumenCiclo` lo escribe Claude con las marcas de alumnado de siempre; esta fila solo lo guarda (lo usa la fila 61). */
(function (g) {
  'use strict';
  var A = g.Alumnado, DIR = 'evaluaciones';
  var SESIONES = [
    { id: 'inicial', nombre: 'Inicial', evaluacion: 'PRIMERA' }, { id: 'primera', nombre: 'Primera', evaluacion: 'PRIMERA' },
    { id: 'segunda', nombre: 'Segunda', evaluacion: 'SEGUNDA' }, { id: 'final', nombre: 'Final', evaluacion: 'TERCERA' }
  ];
  var AREAS = ['Lengua', 'Matemáticas', 'Inglés', 'Ciencias', 'Artística', 'Educación Física', 'Religión/Atención educativa'];
  var CAJAS_SENECA = [
    '1. Acuerdos y decisiones de carácter general para el grupo', '2. Acuerdos y decisiones de carácter individual',
    '3. Asesoramiento del departamento de orientación', '4. Observaciones', '5. Conclusiones'
  ];
  var PARTES_ANEXO = [
    { id: 'IA', titulo: 'I.A) Valoración de la situación del alumnado respecto de las competencias específicas' },
    { id: 'IB', titulo: 'I.B) Información de la tutoría tras analizar los informes del curso anterior', soloInicial: true },
    { id: 'IC', titulo: 'I.C) Medidas de atención a la diversidad grupales' },
    { id: 'II', titulo: 'II. Acuerdos y decisiones de carácter individual' },
    { id: 'III', titulo: 'III. Observaciones' },
    { id: 'IV', titulo: 'IV. Conclusiones' }
  ];

  function sesion(id) { return SESIONES.filter(function (s) { return s.id === id; })[0] || null; }
  /* La sesión que toca por la fecha: septiembre-octubre inicial, noviembre-diciembre primera, enero-marzo segunda, abril-agosto final. */
  function sesionPorFecha(iso) {
    var m = g.partesFecha(iso).m;
    return m >= 9 && m <= 10 ? 'inicial' : m >= 11 ? 'primera' : m >= 1 && m <= 3 ? 'segunda' : 'final';
  }
  /* La evaluación del acta de ciclo (PRIMERA, SEGUNDA o TERCERA) a la que equivale la sesión. */
  function evaluacionDeSesion(id) { var s = sesion(id); return s ? s.evaluacion : ''; }

  function marcaTiempo(ahora) { return (ahora || new Date()).toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6); }
  function areaVacia(nombre) { return { nombre: nombre, notas: '', porcentaje: '', porcentajeAMano: false }; }
  function textosVacios() { return { seneca: ['', '', '', '', ''], anexo: { IA: '', IB: '', IC: '', II: '', III: '', IV: '' } }; }

  function nueva(clase, sesionId, fecha, ahora) {
    var t = (ahora || new Date()).toISOString();
    return {
      formato: 1, id: 'evaluacion-' + marcaTiempo(ahora), curso: g.cursoEscolar(fecha), clase: String(clase || '').trim(), sesion: sesionId, fecha: fecha, estado: 'borrador',
      composicion: { chicas: '', chicos: '' }, areas: AREAS.map(areaVacia), areasQuitadas: [], alumnos: [], orientacion: '', observaciones: '', conclusiones: '',
      informesAnteriores: '', textos: textosVacios(), notasRedactadas: '', resumenCiclo: '', creada: null, creado: t, cambiado: t
    };
  }

  /* --- áreas --- */
  function quitarArea(e, i) {
    var a = e.areas.splice(i, 1)[0];
    if (a && e.areasQuitadas.indexOf(a.nombre) < 0) e.areasQuitadas.push(a.nombre);
  }
  function anadirArea(e, nombre) {
    var n = String(nombre || '').trim();
    if (!n || e.areas.some(function (a) { return A.normalizar(a.nombre) === A.normalizar(n); })) return false;
    e.areas.push(areaVacia(n));
    e.areasQuitadas = e.areasQuitadas.filter(function (x) { return A.normalizar(x) !== A.normalizar(n); });
    return true;
  }
  /* El porcentaje se escribe a mano: queda como número entre 0 y 100 (o vacío) y ya no lo pisará Rúbricas (fila 60). */
  function ponerPorcentaje(area, valor) {
    var t = String(valor == null ? '' : valor).replace(',', '.').trim(), n = Number(t);
    area.porcentaje = t === '' || isNaN(n) ? '' : Math.max(0, Math.min(100, Math.round(n * 10) / 10));
    area.porcentajeAMano = true;
  }
  function tienePorcentaje(a) { return a.porcentaje !== '' && a.porcentaje != null && !isNaN(Number(a.porcentaje)); }

  /* --- alumnado: solo salen los que tienen algo apuntado --- */
  function lleno(t) { return !!String(t || '').trim(); }
  function notasDe(e, alumno) {
    var x = (e.alumnos || []).filter(function (a) { return g.Tutoria.mismoAlumno(a, alumno); })[0];
    return x ? x.notas : '';
  }
  /* Pone las notas de un alumno; si las deja vacías, el alumno sale de la lista. */
  function ponerNotasAlumno(e, alumno, notas) {
    var i = -1;
    (e.alumnos || []).forEach(function (a, k) { if (g.Tutoria.mismoAlumno(a, alumno)) i = k; });
    if (!lleno(notas)) { if (i >= 0) e.alumnos.splice(i, 1); return; }
    if (i >= 0) e.alumnos[i].notas = notas; else e.alumnos.push({ nombre: alumno.nombre, grupo: alumno.grupo || '', notas: notas });
  }
  function areasConAlgo(e) { return e.areas.filter(function (a) { return lleno(a.notas) || tienePorcentaje(a); }); }
  function alumnosConNotas(e) { return (e.alumnos || []).filter(function (a) { return lleno(a.notas); }); }
  function conComposicion(e) { return lleno(e.composicion && e.composicion.chicas) || lleno(e.composicion && e.composicion.chicos); }

  /* ¿Hay algo apuntado que Claude pueda redactar? */
  function hayNotas(e) {
    return areasConAlgo(e).length > 0 || alumnosConNotas(e).length > 0 || lleno(e.orientacion) || lleno(e.observaciones) || lleno(e.conclusiones) || lleno(e.informesAnteriores) && e.sesion === 'inicial';
  }
  /* Todo lo apuntado como una cadena: sirve para saber si cambió desde la última redacción. */
  function firmaNotas(e) {
    return JSON.stringify([e.sesion, e.composicion, areasConAlgo(e).map(function (a) { return [a.nombre, a.notas, a.porcentaje]; }),
      alumnosConNotas(e).map(function (a) { return [a.nombre, a.grupo, a.notas]; }), e.orientacion, e.observaciones, e.conclusiones, e.sesion === 'inicial' ? e.informesAnteriores : '']);
  }
  function hayTextos(e) {
    var t = e.textos || {};
    return (t.seneca || []).some(lleno) || Object.keys(t.anexo || {}).some(function (k) { return lleno(t.anexo[k]); });
  }
  /* Pone lo redactado por Claude; la parte I.B solo existe en la sesión inicial. */
  function ponerRedaccion(e, res) {
    var t = textosVacios();
    CAJAS_SENECA.forEach(function (c, i) { t.seneca[i] = String(res.seneca[i] || ''); });
    PARTES_ANEXO.forEach(function (p) { t.anexo[p.id] = p.soloInicial && e.sesion !== 'inicial' ? '' : String((res.anexo || {})[p.id] || ''); });
    e.textos = t; e.resumenCiclo = String(res.resumenCiclo || ''); e.editado = false; e.notasRedactadas = firmaNotas(e);
  }

  /* El problema que impide crear el anexo, o ''. */
  function problema(e) {
    try { g.fechaCorta(e.fecha); } catch (x) { return 'La fecha de la sesión no es válida.'; }
    if (!lleno(e.clase)) return 'Falta la clase.';
    if (!(e.textos && e.textos.anexo && PARTES_ANEXO.some(function (p) { return lleno(e.textos.anexo[p.id]); }))) return 'Redacta antes el anexo con Claude, o escríbelo tú.';
    return '';
  }

  /* --- guardado --- */
  async function guardar(raiz, e, ahora) {
    e.cambiado = (ahora || new Date()).toISOString();
    await raiz.escribirJSON(DIR + '/' + e.id + '.json', e);
    return e;
  }
  async function leer(raiz, id) { return raiz.leerJSON(DIR + '/' + id + '.json'); }
  async function borrar(raiz, id) { await raiz.borrar(DIR + '/' + id + '.json', false); }
  /* Todas las actas de evaluación legibles, la de fecha más reciente primero. Un fichero roto se salta. */
  async function listar(raiz) {
    var nombres = await raiz.listarJSON(DIR), lista = [];
    for (var i = 0; i < nombres.length; i++) {
      try {
        var e = await raiz.leerJSON(DIR + '/' + nombres[i]);
        if (e && e.id && e.fecha && e.clase && e.sesion && Array.isArray(e.areas)) lista.push(e);
      } catch (x) { /* fichero a medias: no se enseña */ }
    }
    return lista.sort(function (a, b) { return a.fecha === b.fecha ? (a.cambiado < b.cambiado ? 1 : -1) : (a.fecha < b.fecha ? 1 : -1); });
  }
  function delCurso(lista, curso) { return g.Tutoria.delCurso(lista, curso); }
  /* Si ya hay un acta de esa clase y sesión en el curso de la fecha, esa; si no, null. */
  function existente(lista, clase, sesionId, fecha) {
    var curso = g.cursoEscolar(fecha);
    return (lista || []).filter(function (e) { return e.sesion === sesionId && A.normalizar(e.clase) === A.normalizar(clase) && g.cursoEscolar(e.fecha) === curso; })[0] || null;
  }

  g.Evaluacion = {
    DIR: DIR, SESIONES: SESIONES, AREAS: AREAS, CAJAS_SENECA: CAJAS_SENECA, PARTES_ANEXO: PARTES_ANEXO, sesion: sesion, sesionPorFecha: sesionPorFecha,
    evaluacionDeSesion: evaluacionDeSesion, nueva: nueva, areaVacia: areaVacia, quitarArea: quitarArea, anadirArea: anadirArea, ponerPorcentaje: ponerPorcentaje,
    tienePorcentaje: tienePorcentaje, notasDe: notasDe, ponerNotasAlumno: ponerNotasAlumno, areasConAlgo: areasConAlgo, alumnosConNotas: alumnosConNotas,
    conComposicion: conComposicion, hayNotas: hayNotas, firmaNotas: firmaNotas, hayTextos: hayTextos, ponerRedaccion: ponerRedaccion, problema: problema,
    guardar: guardar, leer: leer, borrar: borrar, listar: listar, delCurso: delCurso, existente: existente
  };
})(typeof window !== 'undefined' ? window : globalThis);
