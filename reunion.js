/* La reunión general con las familias (fila 42), la parte que calcula: los 14 puntos con su texto fijo, lo que Inma añade, los delegados, la asistencia
   y el envío que recoge el documento «Reuniones con familias <curso>». Sin pantalla ni red: se prueba con node --test.
   Cada reunión se guarda en ACTAS/reuniones/<id>.json: { formato, id, tipo, estado: 'borrador' | 'creada', fecha, grupo, tutora, localidad,
   puntos: [{ fijo (null = el texto del modelo), anadir (notas con marcas de alumnado), redactado (lo pulido por Claude), notasRedactadas, editado }],
   delegado / subdelegado: { tratamiento: '' | 'D.' | 'Dª.', nombre }, asistencia: [{ nombre: 'Apellidos, Nombre', asiste: true | false | null }], creada }. */
(function (g) {
  'use strict';
  var A = g.Alumnado, DIR = 'reuniones', TIPO = 'reunion-familias', PUNTO_RUEGOS = 13, PUNTO_DELEGADOS = 8;
  var SIN_CANDIDATURAS = 'No se presentan candidaturas, por lo que no se elige a ninguna persona delegada.';

  /* Los 14 puntos del modelo de Inma: título en la lista de temas, título en los acuerdos y el texto fijo (palabra por palabra). */
  var PUNTOS = [
    { titulo: 'Presentación del tutor/a y de los/as profesores/as que inciden en el nivel.', tituloAcuerdo: 'Presentación del tutor/a y de los/as maestros/as que inciden en el nivel.',
      texto: 'Se procede a aportar datos de identificación del propio tutor/a y de todo el profesorado que incide en el nivel.' },
    { titulo: 'Calendario escolar.', tituloAcuerdo: 'Calendario escolar.',
      texto: 'Se informa a las familias del calendario escolar aprobado en reunión de Consejo Escolar, con indicación de los días no lectivos correspondientes a fiestas locales y días de libre ubicación.' },
    { titulo: 'Horarios.', tituloAcuerdo: 'Horarios.',
      texto: 'Se reparte un horario del alumnado para cada familia, de tal forma que se sepa en cada momento qué materias pertenecen a cada día de la semana. Se les transmite a las familias la necesidad de que deben propiciar que el alumno/a sea responsable de organizarse su material, si bien son ellas las que deberán supervisar tal proceso de independencia.' },
    { titulo: 'La evaluación.', tituloAcuerdo: 'La evaluación.',
      texto: 'Se informa a las familias asistentes del procedimiento establecido para calificar al alumnado. Asimismo, se les informa de cómo se les notificarán las calificaciones de sus hijos e hijas.' },
    { titulo: 'Medidas de apoyo al alumnado y de atención a la diversidad que se pueden adoptar.', tituloAcuerdo: 'Medidas de apoyo al alumnado y de atención a la diversidad que se pueden adoptar.',
      texto: 'Se les resume a las familias las medidas contempladas en el Plan de Atención a la Diversidad para la atención a alumnado que presente algún tipo de NEAE.' },
    { titulo: 'Organización de la tutoría, así como el horario de atención a las familias.', tituloAcuerdo: 'Organización de la tutoría, así como el horario de atención a las familias.',
      texto: 'Se indica el horario de tutorías de todos los lunes lectivos. También se informa de las formas más usuales de solicitar una tutoría por ambas partes.' },
    { titulo: 'Procedimiento para facilitar la relación de las familias con el profesorado que integra el equipo docente que imparte docencia en el grupo y para ser oídas en las decisiones que afecten a la evolución escolar de los hijos e hijas.',
      tituloAcuerdo: 'Procedimiento para facilitar la relación de las familias con el profesorado que integra el equipo docente que imparte docencia en el grupo y para ser oídas en las decisiones que afecten a la evolución escolar de los hijos e hijas.',
      texto: 'Se informa del mismo a las familias.' },
    { titulo: 'Derechos y obligaciones de las familias.', tituloAcuerdo: 'Derechos y obligaciones de las familias.',
      texto: 'Se da lectura a lo contemplado en la normativa vigente al respecto.' },
    { titulo: 'Elección de las personas delegadas de los padres y madres en cada grupo. Funciones de las mismas.', tituloAcuerdo: 'Elección de las personas delegadas de los padres y madres en cada grupo. Funciones de las mismas.',
      texto: 'Se procede a la información de la necesidad de elegir a esta figura entre los asistentes y se procede a la misma.' },
    { titulo: 'Compromisos educativos.', tituloAcuerdo: 'Compromisos educativos.',
      texto: 'Se informa de la existencia de tales compromisos y se explica su finalidad, así como el procedimiento para su suscripción.' },
    { titulo: 'Normas básicas del Plan de Convivencia y otras de régimen interior.', tituloAcuerdo: 'Normas básicas del Plan de Convivencia y otras de régimen interior.',
      texto: 'Se da lectura a un resumen de las normas establecidas en el Plan de Convivencia y en el Reglamento de Organización y Funcionamiento del Centro, los cuales son de acceso público, y disponibles a través del sitio web del Centro.' },
    { titulo: 'Promoción del alumnado.', tituloAcuerdo: 'Promoción del alumnado.',
      texto: 'Se realiza un resumen de lo estipulado en el Proyecto Educativo del Centro.' },
    { titulo: 'Consejos finales para las familias.', tituloAcuerdo: 'Consejos finales para las familias.',
      texto: 'Se procede a dar unas orientaciones generales de ayuda a las familias y que repercutirán positivamente en la conducta y resultados del alumnado.' },
    { titulo: 'Cierre de la Reunión.', tituloAcuerdo: 'Ruegos y preguntas.', texto: 'No se realizan aportaciones.' }
  ];

  function dosCifras(n) { return (n < 10 ? '0' : '') + n; }
  function marcaTiempo(ahora) { return (ahora || new Date()).toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6); }

  function claveOrden(a) { return A.normalizar(a.apellidos + ' ' + a.pila); }
  /* Los alumnos del grupo (formato de Rúbricas) -> [{ nombre: 'Apellidos, Nombre', asiste }], por apellidos. Conserva lo ya marcado (por nombre). */
  function asistenciaDe(alumnos, antes) {
    var marcas = {};
    (antes || []).forEach(function (x) { marcas[A.normalizar(x.nombre)] = x.asiste; });
    return (alumnos || []).slice().sort(function (a, b) { var x = claveOrden(a), y = claveOrden(b); return x < y ? -1 : x > y ? 1 : 0; }).map(function (a) {
      var nombre = a.apellidos ? a.apellidos + ', ' + a.pila : a.nombre, m = marcas[A.normalizar(nombre)];
      return { nombre: nombre, asiste: m === true || m === false ? m : null };
    });
  }

  function nueva(tut, ficha, alumnos, hoyIso, ahora) {
    var t = (ahora || new Date()).toISOString();
    return {
      formato: 1, id: 'reunion-' + marcaTiempo(ahora), tipo: TIPO, estado: 'borrador', fecha: hoyIso,
      grupo: tut.grupo, tutora: tut.tutora || '', localidad: String((ficha && ficha.localidad) || '').trim(),
      puntos: PUNTOS.map(function () { return { fijo: null, anadir: '', redactado: '', notasRedactadas: '', editado: false }; }),
      delegado: { tratamiento: '', nombre: '' }, subdelegado: { tratamiento: '', nombre: '' },
      asistencia: asistenciaDe(alumnos), creada: null, creado: t, cambiado: t
    };
  }

  /* Al abrir una reunión sin crear: el grupo, la tutora y la localidad vuelven a ser los de ahora y la lista del grupo se pone al día (lo marcado se conserva). */
  function alinear(r, tut, ficha, alumnos) {
    if (r.estado === 'creada') return r;
    r.grupo = tut.grupo; r.tutora = tut.tutora || '';
    if (ficha && String(ficha.localidad || '').trim()) r.localidad = String(ficha.localidad).trim();
    if (alumnos && alumnos.length) r.asistencia = asistenciaDe(alumnos, r.asistencia);
    return r;
  }

  /* --- el texto de cada punto --- */
  function textoFijo(r, i) { var f = r.puntos[i].fijo; return f != null && String(f).trim() ? String(f).trim() : PUNTOS[i].texto; }
  function fijoCambiado(r, i) { return textoFijo(r, i) !== PUNTOS[i].texto; }
  function hayAnadir(p) { return !!String(p.anadir || '').trim(); }
  /* Lo que se añade al punto: lo pulido por Claude si lo hay; si no, lo que escribió Inma (con los alumnos por su nombre). */
  function anadido(p) {
    var red = String(p.redactado || '').trim();
    return red || A.aVisible(String(p.anadir || '')).trim();
  }
  function firmaNotas(p) { return String(p.anadir || ''); }
  function notasCambiadas(p) { return !!String(p.redactado || '').trim() && firmaNotas(p) !== p.notasRedactadas; }

  function cargoPersona(d) {
    var nombre = String((d && d.nombre) || '').trim();
    return nombre ? { genero: d.tratamiento === 'Dª.' ? 'a' : 'o', texto: (d.tratamiento ? d.tratamiento + ' ' : '') + nombre } : null;
  }
  /* Las líneas del punto 9 que salen de los dos cuadros de delegados. */
  function lineasDelegados(r) {
    var d = cargoPersona(r.delegado), s = cargoPersona(r.subdelegado);
    if (!d && !s) return [SIN_CANDIDATURAS];
    var l = ['Según estos resultados, las siguientes personas desempeñarán los siguientes cargos:'];
    if (d) l.push('• ' + (d.genero === 'a' ? 'Delegada' : 'Delegado') + ' de padres y madres: ' + d.texto);
    if (s) l.push('• ' + (s.genero === 'a' ? 'Subdelegada' : 'Subdelegado') + ': ' + s.texto);
    l.push('Se da lectura a las funciones que le pertenecen según normativa.');
    return l;
  }

  /* El texto final del punto i (párrafos separados por salto de línea; las líneas «• » son viñetas). */
  function parrafoDelPunto(r, i) {
    var extra = anadido(r.puntos[i]);
    if (i === PUNTO_RUEGOS) return extra || textoFijo(r, i);
    var partes = [textoFijo(r, i)];
    if (i === PUNTO_DELEGADOS) partes = partes.concat(lineasDelegados(r));
    if (extra) partes.push(extra);
    return partes.join('\n');
  }

  /* --- asistencia --- */
  function contarAsistencia(r) {
    var c = { si: 0, no: 0, sinMarcar: 0, total: (r.asistencia || []).length };
    (r.asistencia || []).forEach(function (a) { if (a.asiste === true) c.si++; else if (a.asiste === false) c.no++; else c.sinMarcar++; });
    return c;
  }

  /* El problema que impide crear el acta, o ''. */
  function problema(r) {
    try { g.fechaCorta(r.fecha); } catch (e) { return 'La fecha de la reunión no es válida.'; }
    if (!String(r.localidad || '').trim()) return 'Falta la localidad: se toma de los datos del curso del documento de actas.';
    if (!String(r.tutora || '').trim()) return 'Falta tu nombre como tutora. Ponlo en Ajustes.';
    var falta = [['delegado', 'Delegado/a de padres y madres'], ['subdelegado', 'Subdelegado/a']].filter(function (x) {
      var d = r[x[0]]; return String(d.nombre || '').trim() && !d.tratamiento;
    })[0];
    return falta ? 'Elige «D.» o «Dª.» para: ' + falta[1] + '.' : '';
  }

  /* El acta lista para el documento (ACTAS/para-el-documento/). */
  function armarEnvio(r, ahora) {
    return {
      formato: 1, id: 'reunion-envio-' + marcaTiempo(ahora), tipo: TIPO, enviado: (ahora || new Date()).toISOString(), fecha: r.fecha, curso: g.cursoEscolar(r.fecha),
      grupo: r.grupo, tutora: String(r.tutora || '').trim(), localidad: String(r.localidad).trim(),
      puntos: PUNTOS.map(function (p, i) { return { n: i + 1, titulo: p.titulo, tituloAcuerdo: p.tituloAcuerdo, parrafo: parrafoDelPunto(r, i) }; }),
      asistencia: (r.asistencia || []).map(function (a) { return { nombre: a.nombre, asiste: a.asiste === true }; })
    };
  }

  /* --- guardado --- */
  async function guardar(raiz, r, ahora) {
    r.cambiado = (ahora || new Date()).toISOString();
    await raiz.escribirJSON(DIR + '/' + r.id + '.json', r);
    return r;
  }
  async function leer(raiz, id) { return raiz.leerJSON(DIR + '/' + id + '.json'); }
  async function borrar(raiz, id) { await raiz.borrar(DIR + '/' + id + '.json', false); }
  /* Todas las reuniones legibles, la de fecha más reciente primero. Un fichero roto se salta. */
  async function listar(raiz) {
    var nombres = await raiz.listarJSON(DIR), lista = [];
    for (var i = 0; i < nombres.length; i++) {
      try {
        var r = await raiz.leerJSON(DIR + '/' + nombres[i]);
        if (r && r.id && r.fecha && Array.isArray(r.puntos)) lista.push(r);
      } catch (x) { /* fichero a medias: no se enseña */ }
    }
    return lista.sort(function (a, b) { return a.fecha === b.fecha ? (a.cambiado < b.cambiado ? 1 : -1) : (a.fecha < b.fecha ? 1 : -1); });
  }
  /* Las reuniones del curso (por la fecha, de septiembre a junio). */
  function delCurso(reuniones, curso) { return g.Tutoria.delCurso(reuniones, curso); }
  /* La reunión ya creada con esa fecha (otra, o esta misma si se vuelve a crear), o null: para el aviso «Esta reunión ya se creó el…». */
  function yaCreada(todas, r) {
    var hay = (todas || []).filter(function (x) { return x.estado === 'creada' && x.fecha === r.fecha; });
    if (r.estado === 'creada' && !hay.some(function (x) { return x.id === r.id; })) hay.push(r);
    return hay.sort(function (a, b) { return String(a.creada) < String(b.creada) ? -1 : 1; })[0] || null;
  }
  function marcarCreada(r, ahora) { r.estado = 'creada'; r.creada = (ahora || new Date()).toISOString(); return r; }

  g.Reunion = {
    DIR: DIR, TIPO: TIPO, PUNTOS: PUNTOS, PUNTO_RUEGOS: PUNTO_RUEGOS, PUNTO_DELEGADOS: PUNTO_DELEGADOS, SIN_CANDIDATURAS: SIN_CANDIDATURAS,
    asistenciaDe: asistenciaDe, nueva: nueva, alinear: alinear, textoFijo: textoFijo, fijoCambiado: fijoCambiado, hayAnadir: hayAnadir, anadido: anadido,
    firmaNotas: firmaNotas, notasCambiadas: notasCambiadas, lineasDelegados: lineasDelegados, parrafoDelPunto: parrafoDelPunto, contarAsistencia: contarAsistencia,
    problema: problema, armarEnvio: armarEnvio, guardar: guardar, leer: leer, borrar: borrar, listar: listar, delCurso: delCurso, yaCreada: yaCreada, marcarCreada: marcarCreada
  };
})(typeof window !== 'undefined' ? window : globalThis);
