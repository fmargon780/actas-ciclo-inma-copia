/* Claude redacta el texto de una circular o de una autorización de salida (fila 109): una sola llamada, en tono formal de centro educativo. A Claude solo viajan el tipo, el título,
   el grupo, los datos de la salida y las notas, con los nombres del alumnado tapados («[alumno]»): nunca un nombre. La respuesta se revisa: si trae algún nombre de la lista de Rúbricas,
   un reintento y, si sigue, el nombre se quita y sale un aviso. Toda la forma de pedirlo está aquí (`INSTRUCCIONES` y `cuerpo`); el estilo de Ajustes (tema 58) va en `opciones.estilo`.
   Los cambios de estilo («Más escueto»…) usan retoque.js. Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var C = g.Comunicacion, MC = g.MemoriaClaude, MAX_TEXTO = 3000;

  var INSTRUCCIONES = [
    'Eres quien redacta, para la tutora de un grupo de un colegio público de Primaria de Andalucía (España), una comunicación escrita a las familias del alumnado.',
    'Recibes un JSON con «tipo» («circular» o «autorización de salida»), «titulo», «grupo» y «notasDeLaTutora» (lo que quiere contar); en una autorización, además, «salida» con los datos de la actividad.',
    'Escribe el texto de la comunicación.',
    'Reglas:',
    '- Tono formal de centro educativo, cercano y claro. Empieza con «Estimadas familias:» y termina con una despedida cordial («Reciban un cordial saludo.»).',
    '- No pongas título, ni fecha, ni lugar, ni firma, ni el nombre de la tutora: eso ya lo añade el documento.',
    '- Usa solo lo que dicen los datos y las notas. No inventes fechas, horas, precios, lugares, normas ni ningún otro dato. Si un dato no viene, no lo menciones.',
    '- Menciona el grupo cuando venga a cuento. No nombres a ningún alumno, alumna, familia ni docente. «[alumno]» es alguien cuyo nombre se ha quitado: no lo menciones.',
    '- En una autorización de salida, cuenta qué actividad es, dónde, el día y las horas de salida y de vuelta, el transporte, el coste y qué deben traer (solo lo que venga), y pide entregar firmada la autorización de abajo antes de la fecha límite. No escribas la autorización ni el talón: ya van en el documento.',
    '- Párrafos cortos, separados por una línea en blanco. Texto plano: sin negritas ni títulos de formato. Si hay una lista, cada elemento va en su línea y empieza por «• ».',
    '- Entre 400 y 1500 caracteres, sin pasar nunca de 2500.',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"texto":"…"}.'
  ].join('\n');

  /* Lo que sale hacia Claude. c: la comunicación; todos: todo el alumnado de Rúbricas (o []). */
  function preparar(c, todos) {
    var o = {
      tipo: C.esAutorizacion(c) ? 'autorización de salida' : 'circular', titulo: MC.ocultar(C.tituloDe(c), todos), grupo: c.grupo,
      notasDeLaTutora: MC.ocultar(c.notas || '', todos)
    };
    if (C.esAutorizacion(c)) {
      var s = c.salida, v = {};
      C.CAMPOS_SALIDA.forEach(function (k) { if (k !== 'actividad' && String(s[k] || '').trim()) v[k] = MC.ocultar(s[k], todos); });
      v.actividad = MC.ocultar(s.actividad, todos);
      o.salida = v;
    }
    return o;
  }

  /* La petición exacta: INSTRUCCIONES (más el estilo, si se pasa) y los datos de arriba; nunca un nombre. */
  function cuerpo(prep, opciones) {
    opciones = opciones || {};
    return {
      model: g.Claude.MODELO, max_tokens: 3000, system: INSTRUCCIONES + (opciones.estilo ? '\n' + opciones.estilo : ''),
      messages: [{ role: 'user', content: JSON.stringify(prep) }]
    };
  }

  /* Redacta el texto. Un reintento si llega mal, demasiado largo o con algún nombre. Devuelve { texto, aviso } o lanza. */
  async function redactar(clave, c, todos, opciones) {
    opciones = opciones || {};
    if (!clave) { var f0 = new Error(g.Claude.FRASE_SIN_CLAVE); f0.tipo = 'clave'; throw f0; }
    var falta = C.faltas(c).filter(function (x) { return x !== 'texto redactado'; });
    if (falta.length) { var v = new Error('Falta: ' + falta.join(', ') + '.'); v.tipo = 'vacio'; throw v; }
    var prep = preparar(c, todos), ultimo = null, mal = null;
    for (var intento = 0; intento < 2; intento++) {
      var crudo = await g.Claude.llamar(clave, cuerpo(prep, opciones), opciones.buscar), texto;
      try { texto = g.Retoque.leerRespuesta(crudo); } catch (err) { ultimo = err; continue; }
      if (texto.length > MAX_TEXTO) { ultimo = new Error('El texto se pasa de largo.'); continue; }
      if (!MC.nombresEn({ texto: texto }, todos).length) return { texto: texto, aviso: '' };
      mal = texto;
    }
    if (mal) return { texto: MC.quitarNombres({ texto: mal }, todos).texto, aviso: MC.AVISO_NOMBRES };
    var e = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); e.tipo = 'formato'; e.detalle = ultimo; throw e;
  }

  /* Redacta y pone el texto en la comunicación (sin guardarla). Devuelve el aviso de nombres, o ''. */
  async function redactarComunicacion(raiz, c, todos) {
    var clave = await g.Claude.claveDe(raiz);
    var r = await redactar(clave, c, todos, { estilo: await g.Estilo.paraClaude(raiz, todos) });
    g.Retoque.cambiar(c, 'texto', c.texto, r.texto); /* «Deshacer» guarda el texto de antes, con lo corregido a mano */
    c.texto = r.texto;
    return r.aviso || '';
  }

  g.ComunicacionClaude = { INSTRUCCIONES: INSTRUCCIONES, preparar: preparar, cuerpo: cuerpo, redactar: redactar, redactarComunicacion: redactarComunicacion };
})(typeof window !== 'undefined' ? window : globalThis);
