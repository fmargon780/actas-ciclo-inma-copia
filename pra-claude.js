/* Claude redacta el Programa de refuerzo (PRA, fila 75): las cinco casillas de Séneca de cada área marcada, adaptadas al alumno y al área.
   A Claude no viaja ningún nombre: solo «el alumno»/«la alumna», la clase, las áreas y lo que cuenta el docente con el alumnado en iniciales
   entre corchetes (alumnado-claude.js); al volver, las marcas vuelven a ser nombres.
   Toda la forma de pedirlo está aquí (`INSTRUCCIONES` y `cuerpo`), para que el estilo de redacción (tema 58) se añada en `opciones.estilo`.
   Una llamada por cada tanda de `AREAS_POR_LLAMADA` áreas. Sin pantalla: se prueba con node --test con un `buscar` falso. */
(function (g) {
  'use strict';
  var AC = g.AlumnadoClaude, P = g.Pra;
  var AREAS_POR_LLAMADA = 2;

  var INSTRUCCIONES = [
    'Eres quien redacta, para el docente de un colegio público de Primaria de Andalucía (España), las casillas de texto de un Programa de Refuerzo del Aprendizaje (PRA) que se pegan en Séneca.',
    'Recibes un JSON con «alumno» («el alumno» o «la alumna», como hay que llamarle), «clase», «queLePasa» (lo que cuenta el docente: qué le cuesta, qué le ayuda y qué ha probado) y «areas» (los nombres de las áreas para las que hay que escribir).',
    'Para CADA área escribes exactamente 5 casillas, en este orden y con estos nombres de Séneca: 1. Formas de acceso a la información; 2. Tipos de actividades y tareas; 3. Recursos didácticos; 4. Agrupamientos, distribución de espacios y tiempos; 5. Instrumentos de evaluación.',
    'Responde con «areas»: una entrada por cada área pedida, con su «nombre» (tal cual lo recibes) y sus «casillas» (una lista de exactamente 5 textos).',
    'Reglas:',
    '- Escribe sobre ESE alumno y ESA área: traslada lo que cuenta el docente a cada área. Por ejemplo, si le cuesta escribir con orden, en Lengua habla de planificar los textos con un esquema; en Ciencias, de apoyos visuales y esquemas para las respuestas escritas; en Matemáticas, de leer los enunciados en voz alta y subrayar los datos.',
    '- Llámale siempre con la expresión que viene en «alumno» («el alumno» o «la alumna»). Nunca escribas un nombre ni iniciales.',
    '- Lenguaje de documento oficial de Andalucía, en frases claras, en guiones, como en Séneca: cada idea en su línea y empezando por «- ».',
    '- Casillas breves: entre 300 y 900 caracteres cada una, sin pasar nunca de 1200.',
    '- Usa solo lo que dice el docente: no inventes diagnósticos, cifras, fechas ni datos que no ha dado. Puedes proponer medidas y recursos habituales que encajen con lo que cuenta.',
    '- Texto plano: sin negritas, sin títulos de formato ni numeración de casillas.',
    'Ejemplo de estilo (alumno: «el alumno»; área: Lengua; queLePasa: «le cuesta escribir con orden, trabaja mejor con modelos»), casilla 2:',
    '  «- Planificar el texto con un esquema antes de escribir.\n- Escribir a partir de modelos de textos del mismo tipo.\n- Revisar la ortografía y la puntuación con una guía de revisión.»',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"areas":[{"nombre":"…","casillas":["…","…","…","…","…"]}]}.'
  ].join('\n');
  var MAX_CASILLA = 1200;

  /* Lo que sale hacia Claude y cómo deshacerlo: { cuerpo, marcas ({ '[M.S.P.]': 'Nombre Apellidos (grupo)' }), avisos }. */
  function preparar(p, todos, nombresAreas) {
    var prep = AC.preparar([{ n: 1, titulo: 'Qué le pasa al alumno', notas: p.notas || '' }], todos);
    return {
      cuerpo: { alumno: p.alumno.genero === 'a' ? 'la alumna' : 'el alumno', clase: p.alumno.grupo || '', queLePasa: prep.puntos[0].notas, areas: nombresAreas.slice() },
      marcas: prep.marcas[1] || {}, avisos: prep.avisos
    };
  }

  /* La petición exacta. Lleva solo INSTRUCCIONES (más el estilo del tema 58, si se pasa) y lo que cuenta el docente; nunca un nombre. */
  function cuerpo(prep, opciones) {
    opciones = opciones || {};
    return {
      model: g.Claude.MODELO, max_tokens: 6000,
      system: INSTRUCCIONES + (opciones.estilo ? '\n' + opciones.estilo : ''),
      messages: [{ role: 'user', content: JSON.stringify(prep.cuerpo) }]
    };
  }

  function texto(x) { return typeof x === 'string' ? x.trim() : ''; }
  /* La respuesta de Claude -> [{ nombre, casillas: [5] }] en el orden pedido. Lanza si no es el JSON pedido o falta un área. */
  function leerRespuesta(crudo, nombresAreas) {
    var t = String(crudo || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var ini = t.indexOf('{'), fin = t.lastIndexOf('}'), o;
    if (ini < 0 || fin < ini) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    o = JSON.parse(t.slice(ini, fin + 1));
    if (!o || !Array.isArray(o.areas)) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    return nombresAreas.map(function (n, i) {
      var clave = g.Alumnado.normalizar(n);
      var x = o.areas.filter(function (a) { return a && g.Alumnado.normalizar(a.nombre) === clave; })[0] || (o.areas.length === nombresAreas.length ? o.areas[i] : null);
      if (!x || !Array.isArray(x.casillas) || x.casillas.length !== 5) throw new Error('La respuesta de Claude no tiene el formato pedido.');
      var c = x.casillas.map(texto);
      if (c.some(function (s) { return !s; })) throw new Error('La respuesta de Claude no tiene el formato pedido.');
      return { nombre: n, casillas: c };
    });
  }

  function marcasBien(res, prep) {
    var env = Object.keys(prep.marcas);
    return res.every(function (a) { return a.casillas.every(function (t) { return AC.marcasEn(t).every(function (m) { return env.indexOf(m) >= 0; }); }); });
  }
  function demasiado(res) { return res.some(function (a) { return a.casillas.some(function (t) { return t.length > g.Retoque.LIMITE_SENECA || t.length > MAX_CASILLA * 2; }); }); }

  /* Una tanda de áreas: un reintento si llega mal o con las marcas cambiadas. Devuelve { areas, aviso } o lanza. */
  async function tanda(clave, p, todos, nombres, opciones) {
    var prep = preparar(p, todos, nombres), ultimo = null, mal = null;
    for (var intento = 0; intento < 2; intento++) {
      var crudo = await g.Claude.llamar(clave, cuerpo(prep, opciones), opciones.buscar), res;
      try { res = leerRespuesta(crudo, nombres); } catch (err) { ultimo = err; continue; }
      if (demasiado(res)) { ultimo = new Error('Una casilla se pasa del límite de Séneca.'); continue; }
      if (marcasBien(res, prep)) return { res: res, prep: prep, aviso: Object.keys(prep.avisos || {}).map(function (n) { return prep.avisos[n]; })[0] || '' };
      mal = res;
    }
    if (mal) return { res: mal, prep: prep, aviso: AC.AVISO_NOMBRES };
    var f = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.tipo = 'formato'; f.detalle = ultimo; throw f;
  }

  /* Redacta las áreas pedidas (nombres), de dos en dos. Devuelve { areas: [{ nombre, casillas }], aviso }. Si una tanda falla, no se guarda nada de esa tanda ni de las siguientes. */
  async function redactar(clave, p, todos, nombresAreas, opciones) {
    opciones = opciones || {};
    if (!clave) { var f0 = new Error(g.Claude.FRASE_SIN_CLAVE); f0.tipo = 'clave'; throw f0; }
    if (!P.hayNotas(p)) { var v = new Error('Cuenta primero, en dos o tres líneas, qué le pasa al alumno.'); v.tipo = 'vacio'; throw v; }
    if (!nombresAreas.length) { var v2 = new Error('Marca al menos un área.'); v2.tipo = 'vacio'; throw v2; }
    var salida = [], aviso = '';
    for (var i = 0; i < nombresAreas.length; i += AREAS_POR_LLAMADA) {
      var t = await tanda(clave, p, todos, nombresAreas.slice(i, i + AREAS_POR_LLAMADA), opciones);
      t.res.forEach(function (a) { salida.push({ nombre: a.nombre, casillas: a.casillas.map(function (s) { return AC.restaurar(s, t.prep.marcas); }) }); });
      aviso = aviso || t.aviso;
    }
    return { areas: salida, aviso: aviso };
  }

  g.PraClaude = { INSTRUCCIONES: INSTRUCCIONES, AREAS_POR_LLAMADA: AREAS_POR_LLAMADA, preparar: preparar, cuerpo: cuerpo, leerRespuesta: leerRespuesta, redactar: redactar };
})(typeof window !== 'undefined' ? window : globalThis);
