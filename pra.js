/* Programa de refuerzo del aprendizaje, PRA (fila 75), la parte que calcula: las cinco casillas de Séneca, las áreas marcadas, qué falta por redactar y cómo se guarda.
   Sin pantalla ni red: se prueba con node --test. Cada PRA se guarda en ACTAS/pra/<id>.json:
   { formato, id, curso ('2026-2027'), alumno: { nombre, grupo, enLista, genero }, notas (con marcas de alumnado), notasRedactadas,
     areas: [{ nombre, marcada, casillas: [5 textos], versiones? }], fecha, actualizado, creado }.
   Una área desmarcada conserva sus textos (se ocultan) y vuelven al marcarla otra vez. */
(function (g) {
  'use strict';
  var A = g.Alumnado, DIR = 'pra';
  var CASILLAS = [
    'Formas de acceso a la información', 'Tipos de actividades y tareas', 'Recursos didácticos',
    'Agrupamientos, distribución de espacios y tiempos', 'Instrumentos de evaluación'
  ];
  var AREAS = g.Evaluacion.AREAS;

  function lleno(t) { return !!String(t || '').trim(); }
  function marcaTiempo(ahora) { return (ahora || new Date()).toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6); }

  function nueva(alumno, fecha, ahora) {
    var t = (ahora || new Date()).toISOString();
    return {
      formato: 1, id: 'pra-' + marcaTiempo(ahora), curso: g.cursoEscolar(fecha),
      alumno: { nombre: alumno.nombre, grupo: alumno.grupo || '', enLista: alumno.enLista !== false, genero: alumno.genero === 'a' ? 'a' : 'o' },
      notas: '', notasRedactadas: '', areas: [], fecha: fecha, actualizado: t, creado: t
    };
  }

  /* --- áreas --- */
  function area(p, nombre) {
    var n = A.normalizar(nombre);
    return (p.areas || []).filter(function (a) { return A.normalizar(a.nombre) === n; })[0] || null;
  }
  function hayTextos(a) { return !!a && (a.casillas || []).some(lleno); }
  /* Marca o desmarca un área. Al desmarcarla no se borra nada. */
  function marcar(p, nombre, si) {
    var a = area(p, nombre);
    if (!a) { if (!si) return; a = { nombre: nombre, marcada: false, casillas: ['', '', '', '', ''] }; p.areas.push(a); }
    a.marcada = !!si;
  }
  function marcadas(p) { return (p.areas || []).filter(function (a) { return a.marcada; }); }
  function estaMarcada(p, nombre) { var a = area(p, nombre); return !!a && !!a.marcada; }
  /* Las marcadas que todavía no tienen ningún texto: son las que escribe «Redactar con Claude» sin tocar las demás. */
  function faltan(p) { return marcadas(p).filter(function (a) { return !hayTextos(a); }); }
  function hayRedactadas(p) { return marcadas(p).some(hayTextos); }
  /* Pone las cinco casillas de un área (vacía las que no vengan). `Retoque.cambiar` anota la versión anterior para «Deshacer». */
  function ponerCasillas(p, nombre, casillas) {
    var a = area(p, nombre);
    if (!a) { a = { nombre: nombre, marcada: true, casillas: ['', '', '', '', ''] }; p.areas.push(a); }
    for (var i = 0; i < 5; i++) {
      var antes = a.casillas[i] || '', ahora = String(casillas[i] == null ? '' : casillas[i]);
      a.casillas[i] = ahora;
      g.Retoque.cambiar(a, String(i), antes, ahora);
    }
  }

  /* --- notas --- */
  function hayNotas(p) { return lleno(p.notas); }
  function firmaNotas(p) { return String(p.notas || ''); }
  /* ¿Cambiaron las notas desde la última redacción y hay algo redactado? */
  function notasCambiaron(p) { return hayRedactadas(p) && firmaNotas(p) !== (p.notasRedactadas || ''); }
  function problema(p) {
    if (!marcadas(p).length) return 'Marca al menos un área.';
    if (!hayNotas(p)) return 'Cuenta primero, en dos o tres líneas, qué le pasa al alumno.';
    return '';
  }

  /* --- guardado --- */
  async function guardar(raiz, p, ahora) {
    p.actualizado = (ahora || new Date()).toISOString();
    await raiz.escribirJSON(DIR + '/' + p.id + '.json', p);
    return p;
  }
  async function leer(raiz, id) { return raiz.leerJSON(DIR + '/' + id + '.json'); }
  async function borrar(raiz, id) { await raiz.borrar(DIR + '/' + id + '.json', false); }
  /* Todos los PRA legibles, el cambiado más recientemente primero. Un fichero roto se salta. */
  async function listar(raiz) {
    var nombres = await raiz.listarJSON(DIR), lista = [];
    for (var i = 0; i < nombres.length; i++) {
      try {
        var p = await raiz.leerJSON(DIR + '/' + nombres[i]);
        if (p && p.id && p.alumno && p.alumno.nombre && Array.isArray(p.areas)) lista.push(p);
      } catch (x) { /* fichero a medias: no se enseña */ }
    }
    return lista.sort(function (a, b) { return a.actualizado < b.actualizado ? 1 : -1; });
  }
  function delCurso(lista, curso) { return (lista || []).filter(function (p) { return !curso || p.curso === curso; }); }
  /* Si ya hay un PRA de ese alumno en el curso, ese; si no, null. */
  function existente(lista, alumno, curso) {
    return delCurso(lista, curso).filter(function (p) { return g.Tutoria.mismoAlumno(p.alumno, alumno); })[0] || null;
  }
  /* Las áreas con algo redactado, para la lista. */
  function resumenAreas(p) { return marcadas(p).map(function (a) { return a.nombre; }); }

  g.Pra = {
    DIR: DIR, CASILLAS: CASILLAS, AREAS: AREAS, nueva: nueva, area: area, hayTextos: hayTextos, marcar: marcar, marcadas: marcadas, estaMarcada: estaMarcada,
    faltan: faltan, hayRedactadas: hayRedactadas, ponerCasillas: ponerCasillas, hayNotas: hayNotas, firmaNotas: firmaNotas, notasCambiaron: notasCambiaron,
    problema: problema, guardar: guardar, leer: leer, borrar: borrar, listar: listar, delCurso: delCurso, existente: existente, resumenAreas: resumenAreas
  };
})(typeof window !== 'undefined' ? window : globalThis);
