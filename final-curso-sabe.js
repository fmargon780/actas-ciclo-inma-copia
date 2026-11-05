/* Informes de final de curso (fila 101): «Lo que la app ya sabe» de cada alumno, del curso actual: entrevistas terminadas, actas de evaluación con notas suyas,
   PRA, peticiones a orientación y Rúbricas. Lo que no existe, no sale. Cada dato lleva `linea` (lo que ve la tutora) y `texto` (lo que se le cuenta a Claude, que
   luego pasa por la anonimización de alumnado-claude.js). Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var A = g.Alumnado, T = g.Tutoria, MAX = 500;

  function corto(t, n) { var s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function dia(iso) { try { return g.fechaCorta(iso).slice(0, 5); } catch (e) { return ''; } }
  function juntar(partes) { return partes.filter(function (p) { return String(p || '').trim(); }).join(' '); }

  /* fuentes: { entrevistas, evaluaciones, pras, peticiones, rubricas: { nivel, debajo } | null }. Devuelve [{ fuente, linea, texto }]. */
  function sabe(alumno, curso, fuentes, hoy) {
    var f = fuentes || {}, res = [];
    var ent = T.terminadas(T.deAlumno((f.entrevistas || []).filter(function (e) { return g.cursoEscolar(e.fecha) === curso; }), alumno));
    if (ent.length) {
      res.push({ fuente: 'entrevistas', linea: 'Entrevistas: ' + ent.length + ' (la última, ' + dia(ent[0].fecha) + ')',
        texto: 'Entrevistas con la familia (' + ent.length + '): ' + corto(ent.slice(0, 3).map(function (e) {
          var t = e.textos || {}; return juntar([t.temas, t.decisiones]);
        }).join(' | '), MAX * 2) });
    }
    (f.evaluaciones || []).filter(function (e) { return e.curso === curso; }).forEach(function (e) {
      var notas = g.Evaluacion.notasDe(e, alumno);
      if (!String(notas || '').trim()) return;
      var nombre = (g.Evaluacion.sesion(e.sesion) || { nombre: e.sesion }).nombre.toLowerCase();
      res.push({ fuente: 'evaluacion', linea: 'Acta de evaluación ' + nombre + ': ' + corto(notas, 90), texto: 'Acta de evaluación ' + nombre + ': ' + corto(notas, MAX) });
    });
    (f.pras || []).filter(function (p) { return p.curso === curso && T.mismoAlumno(p.alumno, alumno); }).forEach(function (p) {
      var areas = g.Pra.resumenAreas(p);
      res.push({ fuente: 'pra', linea: 'PRA' + (areas.length ? ' de ' + areas.join(', ') : ''), texto: juntar(['Programa de refuerzo del aprendizaje' + (areas.length ? ' en ' + areas.join(', ') : '') + '.', corto(p.notas, MAX)]) });
    });
    (f.peticiones || []).filter(function (p) { return p.curso === curso && T.mismoAlumno(p.alumno, alumno); }).forEach(function (p) {
      var r = p.reunion || {}, est = g.Peticion.estadoTexto(p, hoy);
      res.push({ fuente: 'peticion', linea: 'Petición a orientación: ' + est.charAt(0).toLowerCase() + est.slice(1),
        texto: juntar(['Petición a orientación (' + est.toLowerCase() + ').', corto(r.observado, MAX), corto(r.medidas, MAX)]) });
    });
    var areasBajas = rubricasDe(f.rubricas, alumno);
    if (areasBajas.length) {
      var linea = 'Rúbricas: ' + areasBajas.join(', ') + ' por debajo de ' + (f.rubricas.nivel || 'Suficiente');
      res.push({ fuente: 'rubricas', linea: linea, texto: linea + '.' });
    }
    return res;
  }

  /* Las áreas en las que Rúbricas dice que el alumno está por debajo del nivel: `rubricas.debajo` es { nombre del alumno en Rúbricas: [áreas] }. */
  function rubricasDe(rubricas, alumno) {
    if (!rubricas || !rubricas.debajo) return [];
    var norm = function (t) { return A.normalizar(String(t || '').replace(/,/g, ' ')).replace(/\s+/g, ' ').trim(); };
    var claves = [norm(alumno.nombre), norm((alumno.apellidos || '') + ' ' + (alumno.pila || '')), norm((alumno.pila || '') + ' ' + (alumno.apellidos || ''))].filter(Boolean);
    var res = [];
    Object.keys(rubricas.debajo).forEach(function (k) { if (claves.indexOf(norm(k)) >= 0) res = res.concat(rubricas.debajo[k]); });
    return res.filter(function (a, i) { return res.indexOf(a) === i; });
  }

  /* «a» o «o» según lo que ya se eligió para ese alumno en sus entrevistas, PRA o peticiones (en cualquier curso); '' si no hay nada guardado. «a» manda sobre «o». */
  function generoDe(alumno, fuentes) {
    var f = fuentes || {}, vistos = [];
    [(f.entrevistas || []), (f.pras || []), (f.peticiones || [])].forEach(function (l) {
      l.forEach(function (x) { if (x.alumno && T.mismoAlumno(x.alumno, alumno) && (x.alumno.genero === 'a' || x.alumno.genero === 'o')) vistos.push(x.alumno.genero); });
    });
    return vistos.indexOf('a') >= 0 ? 'a' : vistos.length ? 'o' : '';
  }

  /* Lee todo lo guardado del curso: { entrevistas, evaluaciones, pras, peticiones, reuniones, rubricas }. `raizRubricas` (la carpeta RÚBRICAS, solo lectura) puede ser null. */
  async function leerFuentes(raiz, raizRubricas, grupo, curso, hoy) {
    var f = {};
    f.entrevistas = await T.listarEntrevistas(raiz);
    f.evaluaciones = await g.Evaluacion.listar(raiz);
    f.pras = await g.Pra.listar(raiz);
    f.peticiones = await g.Peticion.listar(raiz);
    f.reuniones = await g.Reunion.listar(raiz);
    f.rubricas = null;
    if (raizRubricas) {
      try {
        var r = await g.EvaluacionRubricas.leer(raizRubricas, { curso: curso, clase: grupo, sesion: 'inicial', fecha: hoy });
        if (r && r.estado === 'ok') f.rubricas = { nivel: r.nivel, debajo: r.debajo || {} };
      } catch (x) { f.rubricas = null; }
    }
    return f;
  }

  g.FinalCursoSabe = { sabe: sabe, generoDe: generoDe, rubricasDe: rubricasDe, leerFuentes: leerFuentes };
})(typeof window !== 'undefined' ? window : globalThis);
