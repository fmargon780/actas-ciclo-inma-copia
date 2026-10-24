/* Claude redacta los dos papeles de la petición a orientación (fila 76): el acta de la reunión del equipo docente y la solicitud de evaluación psicopedagógica.
   A Claude no viaja ningún nombre: solo «el alumno»/«la alumna», la clase, las fechas y las notas del docente con el alumnado en iniciales entre corchetes
   (alumnado-claude.js); al volver, las marcas vuelven a ser nombres. Los nombres del profesorado asistente no viajan: los pone la app en la cabecera del documento.
   Toda la forma de pedirlo está aquí (`INSTRUCCIONES_ACTA`, `INSTRUCCIONES_SOLICITUD`, `cuerpo*`); el estilo de redacción (tema 58) se añade en `opciones.estilo`.
   Sin pantalla: se prueba con node --test con un `buscar` falso. */
(function (g) {
  'use strict';
  var AC = g.AlumnadoClaude;

  var COMUN = [
    'Reglas:',
    '- Llama al alumno siempre con la expresión que viene en «alumno» («el alumno» o «la alumna»). Nunca escribas un nombre ni iniciales de él.',
    '- Lenguaje de documento oficial de Andalucía, en tercera persona, claro y sencillo, en párrafos separados por una línea en blanco. Texto plano: sin negritas, sin viñetas de formato.',
    '- Usa solo lo que dicen las notas: no inventes diagnósticos, cifras, fechas, nombres ni acuerdos. Si algo no se entiende, redáctalo tal cual, sin rellenar.',
    '- El resto del alumnado, si aparece, va como marcas entre corchetes, por ejemplo [M.S.P.]. Copia cada marca exactamente igual, sin cambiarla ni añadirle nada.',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"texto":"…"}.'
  ];
  var INSTRUCCIONES_ACTA = [
    'Eres quien redacta, para el tutor o la tutora de un colegio público de Primaria de Andalucía (España), el acta de la reunión del equipo docente en la que se analizan los indicios de necesidades específicas de apoyo educativo (NEAE) de un alumno, según las Instrucciones de 8 de marzo de 2017 (apartado 2.3).',
    'Recibes un JSON con «alumno», «clase», «fechaReunion», «fechaRevision», «ambitos» (los ámbitos en los que el equipo docente ha visto indicios), «observado» (lo que se ha observado) y «medidas» (las medidas generales que se van a aplicar).',
    'Escribe el acta con estas partes, cada una en su párrafo o párrafos y sin títulos de formato: 1) los indicios detectados, ordenados por los ámbitos indicados; 2) las medidas generales acordadas, con quién las aplica y cómo, tal como las cuentan las notas; 3) el cronograma de seguimiento: las medidas se aplicarán al menos durante tres meses y se revisarán en la fecha de revisión; 4) que el tutor o la tutora informará a la jefatura de estudios y a la familia.'
  ].concat(COMUN).join('\n');
  var INSTRUCCIONES_SOLICITUD = [
    'Eres quien redacta, para el tutor o la tutora de un colegio público de Primaria de Andalucía (España), la solicitud de evaluación psicopedagógica de un alumno, dirigida a la jefatura de estudios, según las Instrucciones de 8 de marzo de 2017 (apartado 2.3).',
    'Recibes un JSON con «alumno», «clase», «fechaReunion» (cuando el equipo docente acordó las medidas), «fechaSolicitud», «ambitos» (ámbitos con indicios), «observado», «medidas» (las medidas aplicadas), «comoHaIdo» (cómo han ido las medidas, según el docente) y, si la solicitud se adelanta antes de los tres meses, «motivoAdelanto».',
    'Escribe la solicitud con estas partes, cada una en su párrafo o párrafos y sin títulos de formato: 1) una frase que presente al alumno y la clase; 2) los indicios detectados, por ámbitos; 3) las medidas aplicadas y desde cuándo (desde «fechaReunion»); 4) por qué esas medidas no han dado el resultado esperado, según «comoHaIdo»; si viene «motivoAdelanto», di que se adelanta la solicitud por ese motivo; 5) la petición de evaluación psicopedagógica a la jefatura de estudios.'
  ].concat(COMUN).join('\n');

  function palabra(p) { return p.alumno.genero === 'a' ? 'la alumna' : 'el alumno'; }
  function fecha(iso) { try { return g.fechaLarga(iso); } catch (e) { return iso || ''; } }

  /* Las notas con marcas de alumnado -> { notas: { clave: texto para Claude }, marcas: todas juntas, avisos }. */
  function prepararNotas(listaNotas, todos) {
    var prep = AC.preparar(listaNotas.map(function (x, i) { return { n: i + 1, titulo: x[0], notas: x[1] || '' }; }), todos), notas = {}, marcas = {};
    listaNotas.forEach(function (x, i) { notas[x[0]] = prep.puntos[i].notas; Object.keys(prep.marcas[i + 1] || {}).forEach(function (m) { marcas[m] = prep.marcas[i + 1][m]; }); });
    return { notas: notas, marcas: marcas, avisos: prep.avisos };
  }

  /* Lo que sale hacia Claude y cómo deshacerlo: { cuerpo (el JSON), marcas, avisos }. */
  function prepararActa(p, todos) {
    var n = prepararNotas([['observado', p.reunion.observado], ['medidas', p.reunion.medidas]], todos);
    return {
      cuerpo: { alumno: palabra(p), clase: p.alumno.grupo || '', fechaReunion: fecha(p.reunion.fecha), fechaRevision: fecha(p.revision), ambitos: p.reunion.ambitos.slice(), observado: n.notas.observado, medidas: n.notas.medidas },
      marcas: n.marcas, avisos: n.avisos
    };
  }
  function prepararSolicitud(p, todos) {
    var s = p.solicitud || {}, n = prepararNotas([['observado', s.observado], ['medidas', s.medidas], ['comoHaIdo', s.comoHaIdo]], todos);
    var c = { alumno: palabra(p), clase: p.alumno.grupo || '', fechaReunion: fecha(p.reunion.fecha), fechaSolicitud: fecha(s.fecha), ambitos: p.reunion.ambitos.slice(), observado: n.notas.observado, medidas: n.notas.medidas, comoHaIdo: n.notas.comoHaIdo };
    if (s.motivoAdelanto) c.motivoAdelanto = s.motivoAdelanto;
    return { cuerpo: c, marcas: n.marcas, avisos: n.avisos };
  }

  /* La petición exacta. Lleva solo las instrucciones (más el estilo del tema 58, si se pasa) y las notas; nunca un nombre. */
  function cuerpo(instrucciones, prep, opciones) {
    opciones = opciones || {};
    return { model: g.Claude.MODELO, max_tokens: 4000, system: instrucciones + (opciones.estilo ? '\n' + opciones.estilo : ''), messages: [{ role: 'user', content: JSON.stringify(prep.cuerpo) }] };
  }
  function cuerpoActa(prep, opciones) { return cuerpo(INSTRUCCIONES_ACTA, prep, opciones); }
  function cuerpoSolicitud(prep, opciones) { return cuerpo(INSTRUCCIONES_SOLICITUD, prep, opciones); }

  /* La respuesta de Claude -> el texto. Lanza si no es el JSON pedido. */
  function leerRespuesta(crudo) {
    var t = String(crudo || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var ini = t.indexOf('{'), fin = t.lastIndexOf('}'), o;
    if (ini < 0 || fin < ini) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    o = JSON.parse(t.slice(ini, fin + 1));
    var v = o && typeof o.texto === 'string' ? o.texto.trim() : '';
    if (!v) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    return v;
  }

  /* Un reintento si llega mal o con las marcas cambiadas. Devuelve { texto, aviso } o lanza. */
  async function pedir(clave, hacerCuerpo, prep, opciones) {
    opciones = opciones || {};
    if (!clave) { var f0 = new Error(g.Claude.FRASE_SIN_CLAVE); f0.tipo = 'clave'; throw f0; }
    var ultimo = null, mal = null;
    for (var intento = 0; intento < 2; intento++) {
      var crudo = await g.Claude.llamar(clave, hacerCuerpo(prep, opciones), opciones.buscar), texto;
      try { texto = leerRespuesta(crudo); } catch (err) { ultimo = err; continue; }
      if (AC.marcasBien(texto, prep.marcas)) return { texto: AC.restaurar(texto, prep.marcas), aviso: Object.keys(prep.avisos || {}).map(function (n) { return prep.avisos[n]; })[0] || '' };
      mal = texto;
    }
    if (mal) return { texto: AC.restaurar(mal, prep.marcas), aviso: AC.AVISO_NOMBRES };
    var f = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.tipo = 'formato'; f.detalle = ultimo; throw f;
  }

  async function redactarActa(clave, p, todos, opciones) {
    var pr = g.Peticion.problemaActa(p);
    if (pr) { var v = new Error(pr); v.tipo = 'vacio'; throw v; }
    return pedir(clave, cuerpoActa, prepararActa(p, todos), opciones);
  }
  async function redactarSolicitud(clave, p, todos, opciones) {
    var pr = g.Peticion.problemaSolicitud(p);
    if (pr) { var v = new Error(pr); v.tipo = 'vacio'; throw v; }
    return pedir(clave, cuerpoSolicitud, prepararSolicitud(p, todos), opciones);
  }

  g.PeticionClaude = {
    INSTRUCCIONES_ACTA: INSTRUCCIONES_ACTA, INSTRUCCIONES_SOLICITUD: INSTRUCCIONES_SOLICITUD, prepararActa: prepararActa, prepararSolicitud: prepararSolicitud,
    cuerpoActa: cuerpoActa, cuerpoSolicitud: cuerpoSolicitud, leerRespuesta: leerRespuesta, redactarActa: redactarActa, redactarSolicitud: redactarSolicitud
  };
})(typeof window !== 'undefined' ? window : globalThis);
