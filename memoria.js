/* Memoria final de tutoría (fila 108), la parte que calcula: lo que la app ya sabe del grupo (las cifras y la tabla las calcula la app, nunca Claude), los cinco apartados,
   el estado de la memoria y cómo se guarda. Sin pantalla ni red: se prueba con node --test.
   Hay una sola memoria por grupo de tutoría y curso escolar, en ACTAS/memoria-tutoria/<id>.json:
   { formato, id ('memoria-<curso>-<grupo>'), curso ('2026-2027'), grupo, notas, notasRedactadas, datosRedactados (firma de las cifras al redactar), editado (¿se tocó a mano un texto?),
     textos: { <id del apartado>: texto }, fecha, documentos?: { curso, base, pdf, docx, firma }, versiones?, actualizado, creado }.
   APARTADOS es lo único que habría que tocar para cambiar los apartados (nombre y guía que lee Claude de cada uno). Las actas de ciclo no se usan. */
(function (g) {
  'use strict';
  var A = g.Alumnado, T = g.Tutoria, DIR = 'memoria-tutoria';
  var NOMBRE = 'Memoria final de tutoría';
  var APARTADOS = [
    { id: 'grupo', titulo: 'El grupo y su clima', guia: 'cómo es el grupo y cómo ha sido el clima de clase y la convivencia durante el curso' },
    { id: 'aprendizaje', titulo: 'Cómo ha evolucionado el aprendizaje', guia: 'cómo ha evolucionado el aprendizaje del grupo a lo largo del curso, apoyándose en la tabla de porcentajes con dificultades y en las actas de evaluación' },
    { id: 'diversidad', titulo: 'Atención a la diversidad', guia: 'las medidas de atención a la diversidad del grupo: programas de refuerzo del aprendizaje y peticiones a orientación, o que no han sido necesarias' },
    { id: 'familias', titulo: 'Relación con las familias', guia: 'la relación con las familias: reuniones generales, entrevistas y compromisos educativos' },
    { id: 'mejora', titulo: 'Propuestas para el curso que viene', guia: 'las propuestas de mejora para el curso que viene' }
  ];
  var ESTADOS = { nada: 'Sin empezar', notas: 'Con notas', redactado: 'Redactada', hecho: 'Hecha' };
  var FRASE_NADA = 'Escribe alguna nota: de este grupo no hay nada guardado.';

  function lleno(t) { return !!String(t || '').trim(); }
  /* «6º A», «6.º A» y «6ºa» son el mismo grupo. */
  function claveGrupo(t) { return A.normalizar(t).replace(/[^a-z0-9]+/g, ''); }
  function mismoGrupo(a, b) { return claveGrupo(a) !== '' && claveGrupo(a) === claveGrupo(b); }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  function num(v) { return String(v).replace('.', ','); }
  function ponerPorcentaje(v) { return num(v) + ' %'; }

  /* --- lo que la app ya sabe del grupo --- */
  /* fuentes: { entrevistas, evaluaciones, pras, peticiones, reuniones } (FinalCursoSabe.leerFuentes); alumnos: el grupo de tutoría; curso: '2026-2027'; grupo: «6º A»;
     informes: { hechos, total } de los informes de final de curso.
     Devuelve { hayDatos, alumnado, cifras: [{ id, etiqueta, valor }], sesiones: [{ id, nombre, hecha }], faltan: [nombres de sesión sin acta], tabla: null | { sesiones: [ids], areas: [{ nombre, valores: [número | null | 'falta'] }] } }. */
  function datos(fuentes, alumnos, curso, grupo, informes) {
    var f = fuentes || {}, lista = alumnos || [], E = g.Evaluacion;
    function delGrupo(x) { return lista.some(function (a) { return T.mismoAlumno(x, a); }); }

    var ents = T.terminadas((f.entrevistas || []).filter(function (e) { return g.cursoEscolar(e.fecha) === curso && delGrupo(e.alumno); }));
    var conEntrevista = lista.filter(function (a) { return ents.some(function (e) { return T.mismoAlumno(e.alumno, a); }); }).length;
    var compromisos = 0, cumplidos = 0;
    ents.forEach(function (e) { (e.compromisos || []).forEach(function (c) { compromisos++; if (c.hecho) cumplidos++; }); });

    var reus = (f.reuniones || []).filter(function (r) { return r.estado === 'creada' && g.cursoEscolar(r.fecha) === curso && mismoGrupo(r.grupo, grupo); });
    var marcadas = reus.map(function (r) { return g.Reunion.contarAsistencia(r); }).filter(function (c) { return c.si + c.no > 0; });
    var media = marcadas.length ? Math.round(marcadas.reduce(function (s, c) { return s + c.si; }, 0) / marcadas.length) : null;

    var pras = lista.filter(function (a) { return (f.pras || []).some(function (p) { return p.curso === curso && T.mismoAlumno(p.alumno, a); }); }).length;

    var peticiones = (f.peticiones || []).filter(function (p) { return p.curso === curso && p.estado !== 'borrador' && delGrupo(p.alumno); });
    var porEstado = { solicitada: 0, medidas: 0, cerrada: 0 };
    peticiones.forEach(function (p) { if (porEstado[p.estado] != null) porEstado[p.estado]++; });
    var partesPeticion = [];
    if (porEstado.solicitada) partesPeticion.push(plural(porEstado.solicitada, 'solicitud', 'solicitudes'));
    if (porEstado.medidas) partesPeticion.push(porEstado.medidas + ' en marcha');
    if (porEstado.cerrada) partesPeticion.push(plural(porEstado.cerrada, 'cerrada', 'cerradas'));

    /* El acta de cada sesión: la última del grupo y del curso con algo apuntado. */
    var sesiones = E.SESIONES.map(function (s) {
      var acta = (f.evaluaciones || []).filter(function (e) { return e.sesion === s.id && e.curso === curso && mismoGrupo(e.clase, grupo) && E.hayNotas(e); })[0] || null;
      return { id: s.id, nombre: s.nombre, acta: acta, hecha: !!acta };
    });
    var faltan = sesiones.filter(function (s) { return !s.hecha; }).map(function (s) { return s.nombre; });
    var hechas = sesiones.length - faltan.length;

    var nombresAreas = [];
    sesiones.forEach(function (s) {
      if (s.acta) s.acta.areas.forEach(function (a) { if (E.tienePorcentaje(a) && nombresAreas.indexOf(a.nombre) < 0) nombresAreas.push(a.nombre); });
    });
    nombresAreas.sort(function (a, b) {
      var x = E.AREAS.indexOf(a), y = E.AREAS.indexOf(b);
      return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
    });
    var tabla = nombresAreas.length ? {
      sesiones: sesiones.map(function (s) { return s.id; }),
      areas: nombresAreas.map(function (n) {
        return { nombre: n, valores: sesiones.map(function (s) {
          if (!s.acta) return 'falta';
          var a = s.acta.areas.filter(function (x) { return x.nombre === n; })[0];
          return a && E.tienePorcentaje(a) ? Number(a.porcentaje) : null;
        }) };
      })
    } : null;

    /* Alumnas y alumnos, solo si lo dice un acta de evaluación del grupo (la más reciente). */
    var composicion = null;
    sesiones.slice().reverse().some(function (s) {
      var c = s.acta && s.acta.composicion;
      if (c && lleno(c.chicas) && lleno(c.chicos) && !isNaN(Number(c.chicas)) && !isNaN(Number(c.chicos))) { composicion = { chicas: Number(c.chicas), chicos: Number(c.chicos) }; return true; }
      return false;
    });
    var inf = informes || { hechos: 0, total: lista.length };

    var cifras = [
      { id: 'alumnado', etiqueta: 'Alumnado', valor: lista.length + (composicion ? ' (' + plural(composicion.chicas, 'alumna', 'alumnas') + ', ' + plural(composicion.chicos, 'alumno', 'alumnos') + ')' : '') },
      { id: 'entrevistas', etiqueta: 'Entrevistas', valor: ents.length ? ents.length + ', con ' + conEntrevista + ' de ' + lista.length + ' alumnos' : 'ninguna' },
      { id: 'compromisos', etiqueta: 'Compromisos cumplidos', valor: compromisos ? cumplidos + ' de ' + compromisos : 'ninguno' },
      { id: 'reuniones', etiqueta: 'Reuniones con familias', valor: reus.length ? reus.length + (media != null ? ', media de ' + plural(media, 'asistente', 'asistentes') : '') : 'ninguna' },
      { id: 'pra', etiqueta: 'PRA', valor: pras ? plural(pras, 'alumno', 'alumnos') : 'ninguno' },
      { id: 'peticiones', etiqueta: 'Peticiones a orientación', valor: peticiones.length ? peticiones.length + (partesPeticion.length ? ' (' + partesPeticion.join(', ') + ')' : '') : 'ninguna' },
      { id: 'actas', etiqueta: 'Actas de evaluación', valor: hechas + ' de ' + sesiones.length },
      { id: 'informes', etiqueta: 'Informes de final de curso', valor: inf.hechos + ' de ' + inf.total + ' hechos' }
    ];
    var hayDatos = ents.length > 0 || compromisos > 0 || reus.length > 0 || pras > 0 || peticiones.length > 0 || hechas > 0 || inf.hechos > 0;
    return {
      hayDatos: hayDatos, alumnado: lista.length, cifras: cifras, composicion: composicion, faltan: faltan,
      sesiones: sesiones.map(function (s) { return { id: s.id, nombre: s.nombre, hecha: s.hecha, acta: s.acta }; }), tabla: tabla
    };
  }
  /* Cómo se escribe una casilla de la tabla. */
  function casilla(v) { return v === 'falta' ? 'falta' : v == null ? '—' : ponerPorcentaje(v); }
  /* Lo que dice el aviso cuando falta algún acta de evaluación, o ''. */
  function avisoFaltan(d) {
    if (!d || !d.hayDatos || !d.faltan.length) return '';
    var n = d.faltan.map(function (x) { return x.toLowerCase(); });
    return d.faltan.length === 1
      ? 'Falta el acta de evaluación ' + n[0] + '. Puedes redactar sin ella, pero la memoria no contará esa evaluación.'
      : 'Faltan las actas de evaluación ' + n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1] + '. Puedes redactar sin ellas, pero la memoria no contará esas evaluaciones.';
  }
  /* Las cifras y la tabla como una cadena: sirve para saber si cambiaron desde la última redacción. */
  function firmaDatos(d) { return JSON.stringify([d.cifras.map(function (c) { return [c.etiqueta, c.valor]; }), d.tabla]); }

  /* --- la memoria --- */
  function idDe(grupo, curso) { return 'memoria-' + curso + '-' + claveGrupo(grupo); }
  function nueva(grupo, curso, fecha, ahora) {
    var t = (ahora || new Date()).toISOString();
    return { formato: 1, id: idDe(grupo, curso), curso: curso, grupo: String(grupo || '').trim(), notas: '', notasRedactadas: '', datosRedactados: '', editado: false, textos: {}, fecha: fecha, documentos: null, actualizado: t, creado: t };
  }

  function texto(m, id) { return String((m.textos || {})[id] || ''); }
  function hayTextos(m) { return !!m && APARTADOS.some(function (a) { return lleno(texto(m, a.id)); }); }
  function hayNotas(m) { return !!m && lleno(m.notas); }
  function notasCambiaron(m) { return hayTextos(m) && String(m.notas || '') !== (m.notasRedactadas || ''); }
  function datosCambiaron(m, d) { return hayTextos(m) && !!d && firmaDatos(d) !== (m.datosRedactados || ''); }
  /* Todo lo que sale en el papel: si cambia después de crear PDF y Word, la memoria deja de estar «Hecha». */
  function firmaPapel(m, d) { return JSON.stringify([m.grupo, m.fecha, APARTADOS.map(function (a) { return texto(m, a.id); }), d ? firmaDatos(d) : '']); }
  function creado(m, d) { return !!m && !!m.documentos && m.documentos.firma === firmaPapel(m, d); }
  /* 'nada' | 'notas' | 'redactado' | 'hecho' */
  function estado(m, d) {
    if (!m) return 'nada';
    if (hayTextos(m)) return creado(m, d) ? 'hecho' : 'redactado';
    return hayNotas(m) ? 'notas' : 'nada';
  }
  function etiqueta(m, d) { return ESTADOS[estado(m, d)]; }
  /* ¿Se puede redactar? Hace falta alguna nota o algo guardado del grupo. */
  function problema(m, d) { return hayNotas(m) || (d && d.hayDatos) ? '' : FRASE_NADA; }

  /* Pone lo redactado por Claude ({ id: texto }); cada texto anterior queda para «Deshacer» (Retoque). Los datos de ese momento quedan apuntados. */
  function ponerRedaccion(m, res, d) {
    if (!m.textos) m.textos = {};
    APARTADOS.forEach(function (a) {
      var antes = texto(m, a.id), ahora = String(res[a.id] == null ? '' : res[a.id]);
      m.textos[a.id] = ahora; g.Retoque.cambiar(m, a.id, antes, ahora);
    });
    m.notasRedactadas = String(m.notas || ''); m.datosRedactados = d ? firmaDatos(d) : ''; m.editado = false;
  }

  /* --- guardado --- */
  async function guardar(raiz, m, ahora) {
    m.actualizado = (ahora || new Date()).toISOString();
    await raiz.escribirJSON(DIR + '/' + m.id + '.json', m);
    return m;
  }
  async function leer(raiz, id) { return raiz.leerJSON(DIR + '/' + id + '.json'); }
  async function borrar(raiz, id) { await raiz.borrar(DIR + '/' + id + '.json', false); }
  /* La memoria guardada de ese grupo y curso, o null. */
  async function existente(raiz, grupo, curso) {
    var m = await leer(raiz, idDe(grupo, curso));
    return m && m.id && m.textos ? m : null;
  }

  g.Memoria = {
    DIR: DIR, NOMBRE: NOMBRE, APARTADOS: APARTADOS, ESTADOS: ESTADOS, FRASE_NADA: FRASE_NADA, claveGrupo: claveGrupo, mismoGrupo: mismoGrupo,
    datos: datos, casilla: casilla, avisoFaltan: avisoFaltan, firmaDatos: firmaDatos, idDe: idDe, nueva: nueva, texto: texto, hayTextos: hayTextos, hayNotas: hayNotas,
    notasCambiaron: notasCambiaron, datosCambiaron: datosCambiaron, firmaPapel: firmaPapel, creado: creado, estado: estado, etiqueta: etiqueta, problema: problema,
    ponerRedaccion: ponerRedaccion, guardar: guardar, leer: leer, borrar: borrar, existente: existente
  };
})(typeof window !== 'undefined' ? window : globalThis);
