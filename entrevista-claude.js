/* Claude redacta los tres textos de la entrevista con la familia (fila 40). A Claude no viaja ningún nombre: el alumno de la entrevista va como
   «el alumno» o «la alumna» y el resto del alumnado como iniciales entre corchetes (la misma ruta de la fila 15); al volver, las marcas vuelven a ser nombres.
   Una caja de notas vacía no se manda y su texto queda vacío. Sin pantalla: se prueba con node --test con un `buscar` falso. */
(function (g) {
  'use strict';
  var A = g.Alumnado, AC = g.AlumnadoClaude, T = g.Tutoria;
  var CAJAS = [{ n: 1, nota: 'temas', titulo: 'Temas tratados' }, { n: 2, nota: 'tutora', titulo: 'Compromisos de la tutora' },
    { n: 3, nota: 'familia', titulo: 'Compromisos de la familia' }, { n: 4, nota: 'otros', titulo: 'Otros datos de interés' }];

  var INSTRUCCIONES = [
    'Eres quien redacta, para una maestra tutora de un colegio público de Primaria de Andalucía (España), los tres textos del acta de una entrevista con la familia de un alumno, que se pegarán en Séneca.',
    'Recibes un JSON con «alumno» (cómo llamar al alumno de la entrevista: «el alumno» o «la alumna») y «cajas» con las notas cortas de la maestra: «temas» (temas tratados), «compromisosTutora», «compromisosFamilia» y «otros» (otros datos de interés, lo que aporta la familia). Solo vienen las cajas con algo escrito.',
    'Responde con tres textos: «temas», «decisiones» y «otros».',
    'Reglas de estilo:',
    '- Tercera persona impersonal y tono formal y sencillo: «Se informa de que…», «Se comunica…», «Se traslada…», «Se señalan…», «Se recomienda…», «La madre manifiesta que…».',
    '- Cada idea empieza con una etiqueta corta y dos puntos, por ejemplo «Actitud y conducta en el aula: …», «Hábito de trabajo y presentación de tareas: …». Si una idea tiene varias medidas, puedes poner la etiqueta sola en una línea («Medidas de atención a la diversidad y refuerzo:») y cada medida en su párrafo.',
    '- Separa los párrafos con una línea en blanco. Texto plano: sin viñetas, sin negritas, sin títulos de formato.',
    '- En «decisiones» escribe primero «Compromisos de la tutora:» y después, cada uno en su párrafo y con su etiqueta corta y dos puntos, los compromisos de la tutora; luego «Compromisos de la familia:» y los de la familia, igual. Pon cada rótulo solo si hay compromisos de ese grupo. Puedes cerrar con una frase de seguimiento sin etiqueta («Mantener un contacto periódico para…»), que se entiende de la familia.',
    '- Usa solo lo que dicen las notas: no inventes datos, fechas, cifras, nombres ni acuerdos. Si algo no se entiende, redáctalo tal cual, sin rellenar.',
    '- Llama al alumno de la entrevista siempre con el valor de «alumno»; nunca escribas su nombre. No nombres a nadie más que a las personas que aparezcan en las notas.',
    '- El resto del alumnado aparece como marcas entre corchetes, por ejemplo [M.S.P.]. Copia cada marca exactamente igual, sin cambiarla ni añadirle nada.',
    '- Escribe las abreviaturas completas: «Cono» = Conocimiento del Medio, «Lengua» = Lengua Castellana, «PRA» = Programa de Refuerzo para el Aprendizaje (PRA) la primera vez.',
    'Si una caja no viene, su texto es "" (cadena vacía).',
    'Ejemplo de estilo (notas: «le cuesta escribir en castellano por el holandés; le abrimos PRA de lengua»):',
    '  temas: «Competencia lingüística y rendimiento académico: Se informa de que el alumno presenta dificultades en la expresión oral y escrita en lengua castellana, motivadas por la influencia de su lengua materna (holandés).\\n\\nMedidas de atención a la diversidad y refuerzo: Se comunica la apertura de un Programa de Refuerzo para el Aprendizaje (PRA) en el área de Lengua.»',
    '  decisiones: «Compromisos de la tutora:\\n\\nIntervención educativa: Elaborar e implementar el PRA en el área de Lengua Castellana para reforzar la expresión oral y escrita.\\n\\nCompromisos de la familia:\\n\\nDiálogo en el hogar: Conversar con el alumno sobre la importancia de cumplir las normas de convivencia del aula.»',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"temas":"…","decisiones":"…","otros":"…"}.'
  ].join('\n');
  var OTRA_VERSION = 'Escribe una redacción distinta de la habitual, con otras palabras y otra estructura, sin cambiar lo que dicen las notas.';

  function generoPalabra(alumno) { return alumno && alumno.genero === 'a' ? 'la alumna' : 'el alumno'; }

  /* Cambia por «el alumno» todo lo que sea el nombre del alumno de la entrevista, aunque Inma lo haya escrito suelto (solo el nombre de pila, solo un apellido
     o el nombre entero): las palabras de su nombre seguidas (con «de», «del»… entre medias) pasan a una sola. */
  function sustituirNombre(texto, alumno, palabra) {
    var propias = A.palabras(A.normalizar(alumno.nombre)).filter(function (w) { return A.PARTICULAS.indexOf(w) < 0 && Array.from(w).length >= 2; });
    var t = String(texto), n = A.normalizar(t), re = /[a-z0-9ñ]+/g, m, trozos = [];
    if (!propias.length) return t;
    while ((m = re.exec(n))) if (propias.indexOf(m[0]) >= 0) trozos.push({ ini: m.index, fin: m.index + m[0].length });
    var res = '', ultimo = 0;
    for (var i = 0; i < trozos.length; i++) {
      var ini = trozos[i].ini, fin = trozos[i].fin;
      while (i + 1 < trozos.length && /^\s+(?:(?:de|del|la|las|los|y)\s+)?$/.test(n.slice(fin, trozos[i + 1].ini))) { fin = trozos[i + 1].fin; i++; }
      res += t.slice(ultimo, ini) + palabra; ultimo = fin;
    }
    return res + t.slice(ultimo);
  }

  /* Una caja de notas con marcas -> texto para Claude: el alumno de la entrevista como «el alumno» y los demás marcados con A.marca (los resuelve preparar). */
  function sinAlumno(notas, alumno, palabra) {
    var s = '';
    A.trozos(notas).forEach(function (x) {
      if (x.alumno) s += T.mismoAlumno(x.alumno, alumno) ? palabra : A.marca(x.alumno);
      else s += sustituirNombre(x.texto, alumno, palabra);
    });
    return s;
  }

  /* Lo que sale hacia Claude y cómo deshacerlo: { cuerpo (el JSON de la petición), puntos, marcas (todas juntas), envia: { temas, decisiones, otros } }. */
  function preparar(e, todos) {
    var alumno = e.alumno, palabra = generoPalabra(alumno);
    var otros = (todos || []).filter(function (a) { return !T.mismoAlumno(a, alumno); });
    var puntos = [];
    CAJAS.forEach(function (c) {
      var t = sinAlumno((e.notas && e.notas[c.nota]) || '', alumno, palabra);
      if (t.trim()) puntos.push({ n: c.n, titulo: c.titulo, notas: t });
    });
    var prep = AC.preparar(puntos, otros), cajas = {}, marcas = {};
    var clave = { 1: 'temas', 2: 'compromisosTutora', 3: 'compromisosFamilia', 4: 'otros' };
    prep.puntos.forEach(function (p) { cajas[clave[p.n]] = p.notas; Object.keys(prep.marcas[p.n]).forEach(function (m) { marcas[m] = prep.marcas[p.n][m]; }); });
    var envia = { temas: !!cajas.temas, decisiones: !!(cajas.compromisosTutora || cajas.compromisosFamilia), otros: !!cajas.otros };
    return { cuerpo: { alumno: palabra, cajas: cajas }, marcas: marcas, envia: envia, avisos: prep.avisos };
  }

  /* La petición exacta que se manda. Lleva solo INSTRUCCIONES y las cajas; nunca el nombre del alumno. */
  function cuerpo(prep, otraVersion, estilo) {
    return {
      model: g.Claude.MODELO, max_tokens: 4000, system: INSTRUCCIONES + (estilo ? '\n' + estilo : '') + (otraVersion ? '\n' + OTRA_VERSION : ''),
      messages: [{ role: 'user', content: JSON.stringify(prep.cuerpo) }]
    };
  }

  /* La respuesta de Claude -> { temas, decisiones, otros } (cadenas). Lanza si no es el JSON pedido o falta el texto de una caja con notas. */
  function leerRespuesta(texto, envia) {
    var t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var ini = t.indexOf('{'), fin = t.lastIndexOf('}');
    if (ini < 0 || fin < ini) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    var o = JSON.parse(t.slice(ini, fin + 1)), res = {};
    if (!o || typeof o !== 'object') throw new Error('La respuesta de Claude no tiene el formato pedido.');
    ['temas', 'decisiones', 'otros'].forEach(function (k) {
      var v = typeof o[k] === 'string' ? o[k].trim() : '';
      if (envia[k] && !v) throw new Error('A la respuesta de Claude le falta el texto de «' + k + '».');
      res[k] = envia[k] ? v : '';
    });
    return res;
  }

  /* Redacta la entrevista: { textos: { temas, decisiones, otros }, aviso }. Un reintento si llega mal o con los nombres cambiados. */
  async function redactar(clave, e, todos, opciones) {
    opciones = opciones || {};
    if (!clave) { var f0 = new Error(g.Claude.FRASE_SIN_CLAVE); f0.tipo = 'clave'; throw f0; }
    var prep = preparar(e, todos);
    if (!prep.envia.temas && !prep.envia.decisiones && !prep.envia.otros) { var v = new Error('Escribe primero alguna nota para que Claude la redacte.'); v.tipo = 'vacio'; throw v; }
    var ultimo = null, mal = null;
    for (var intento = 0; intento < 2; intento++) {
      var texto = await g.Claude.llamar(clave, cuerpo(prep, opciones.otraVersion, opciones.estilo), opciones.buscar), res;
      try { res = leerRespuesta(texto, prep.envia); } catch (err) { ultimo = err; continue; }
      if (marcasBien(res, prep.marcas)) return { textos: restaurar(res, prep.marcas), aviso: avisoDe(prep) };
      mal = res;
    }
    if (mal) return { textos: restaurar(mal, prep.marcas), aviso: AC.AVISO_NOMBRES };
    var f = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.tipo = 'formato'; f.detalle = ultimo; throw f;
  }
  /* Las marcas de los tres textos: ninguna inventada y ninguna de las enviadas perdida (puede cambiar de caja). */
  function marcasBien(res, enviadas) {
    var hay = [];
    ['temas', 'decisiones', 'otros'].forEach(function (k) { hay = hay.concat(AC.marcasEn(res[k])); });
    var env = Object.keys(enviadas);
    return hay.every(function (m) { return env.indexOf(m) >= 0; }) && env.every(function (m) { return hay.indexOf(m) >= 0; });
  }
  function restaurar(res, marcas) {
    var r = {};
    Object.keys(res).forEach(function (k) { r[k] = AC.restaurar(res[k], marcas); });
    return r;
  }
  function avisoDe(prep) { var l = Object.keys(prep.avisos || {}).map(function (n) { return prep.avisos[n]; }); return l.length ? l[0] : ''; }

  g.EntrevistaClaude = { INSTRUCCIONES: INSTRUCCIONES, preparar: preparar, cuerpo: cuerpo, leerRespuesta: leerRespuesta, redactar: redactar, generoPalabra: generoPalabra };
})(typeof window !== 'undefined' ? window : globalThis);
