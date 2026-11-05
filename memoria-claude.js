/* Claude redacta la memoria final de tutoría (fila 108): un texto por apartado, a partir de las cifras y la tabla que calcula la app, las conclusiones de las actas de
   evaluación y las notas de la tutora. A Claude no viaja ningún nombre de alumnado: los nombres (los marcados en las notas y los de la lista de Rúbricas escritos sueltos) se
   cambian por «[alumno]». La respuesta se revisa: si trae algún nombre de la lista, un reintento y, si sigue, el nombre se quita y sale un aviso. Una llamada por memoria.
   Toda la forma de pedirlo está aquí (`INSTRUCCIONES` y `cuerpo`); el estilo de redacción (tema 58) se añade en `opciones.estilo`. Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var A = g.Alumnado, M = g.Memoria, MAX_APARTADO = 1500, TAPA = '[alumno]';
  var AVISO_NOMBRES = 'Claude ha escrito el nombre de algún alumno o alumna y lo he quitado. Revisa el texto.';

  var INSTRUCCIONES = [
    'Eres quien redacta, para la tutora de un grupo de un colegio público de Primaria de Andalucía (España), la memoria final de tutoría del curso: un texto sobre todo el grupo.',
    'Recibes un JSON con «grupo», «curso», «notasDeLaTutora» (lo que destaca la tutora), «elCursoEnCifras» (cifras ya calculadas), «tablaDificultades» (por área, el porcentaje de alumnado con dificultades en cada sesión de evaluación; «falta» si esa acta no existe), «actasDeEvaluacion» (conclusiones y notas de cada acta) y «apartados» (los apartados que hay que escribir, cada uno con su «id», su «titulo» y de qué trata en «guia»).',
    'Responde con «apartados»: un objeto con una clave por cada «id» recibido y, como valor, el texto de ese apartado.',
    'Reglas:',
    '- Escribe SIEMPRE todos los apartados, aunque haya pocos datos.',
    '- Habla del grupo, no de cada alumno. No nombres a ningún alumno, alumna, familia ni docente, ni des iniciales. «[alumno]» es alguien cuyo nombre se ha quitado: no lo menciones.',
    '- Usa solo las cifras y los porcentajes recibidos, tal cual, y lo que dicen las notas y las actas. No calcules, no redondees, no inventes cifras, fechas, medidas ni hechos que no estén. Si una cifra no viene, no la menciones. Con pocos datos, escribe un texto breve, prudente y general. Si en la tabla pone «falta», no cuentes esa evaluación.',
    '- Lenguaje de documento escolar de Andalucía, en frases claras, en párrafos breves. Cada apartado, entre 300 y 900 caracteres, sin pasar nunca de 1300.',
    '- Texto plano: sin negritas, sin títulos de formato, sin listas numeradas ni repetir el título del apartado.',
    '- No hables de calificaciones numéricas ni de lo que decide la dirección: eso está en Séneca.',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"apartados":{"<id>":"…"}}.'
  ].join('\n');

  /* --- ningún nombre hacia Claude --- */
  /* Las palabras (sin tildes ni mayúsculas) que son nombre de pila o apellido de alguien de la lista de Rúbricas. */
  function palabrasDeNombres(todos) {
    var set = {};
    (todos || []).forEach(function (a) {
      [a.pila].concat(A.palabras(a.apellidos || '')).concat(A.palabras(a.nombre || '')).forEach(function (w) {
        var n = A.normalizar(w || '');
        if (Array.from(n).length >= 3 && A.PARTICULAS.indexOf(n) < 0) set[n] = true;
      });
    });
    return set;
  }
  function tapar(texto, set) {
    return String(texto).replace(/[A-Za-zÀ-ÿ]+/g, function (w) { return set[A.normalizar(w)] ? TAPA : w; });
  }
  /* Un texto de la tutora o de un acta, sin ningún nombre: los alumnos marcados y los nombres sueltos pasan a «[alumno]». */
  function ocultar(texto, todos) {
    var set = palabrasDeNombres(todos);
    var t = A.trozos(texto).map(function (x) { return x.alumno ? TAPA : x.texto; }).join('');
    return tapar(t, set).trim();
  }

  /* Los nombres (y las marcas de nombre) que aparezcan en las respuestas. */
  function nombresEn(res, todos) {
    var set = palabrasDeNombres(todos), hay = [];
    Object.keys(res || {}).forEach(function (k) {
      (String(res[k]).match(/[A-Za-zÀ-ÿ]+/g) || []).forEach(function (w) { if (set[A.normalizar(w)] && hay.indexOf(w) < 0) hay.push(w); });
      (String(res[k]).match(/\[[^\]]*\]/g) || []).forEach(function (m) { if (hay.indexOf(m) < 0) hay.push(m); });
    });
    return hay;
  }
  function quitarNombres(res, todos) {
    var set = palabrasDeNombres(todos), salida = {};
    Object.keys(res).forEach(function (k) {
      salida[k] = String(res[k]).replace(/\[[^\]]*\]/g, '').replace(/[A-Za-zÀ-ÿ]+/g, function (w) { return set[A.normalizar(w)] ? '' : w; }).replace(/[ \t]{2,}/g, ' ').replace(/ ([,.;:])/g, '$1').trim();
    });
    return salida;
  }

  /* Lo que sale hacia Claude. m: la memoria; d: lo que la app sabe (Memoria.datos); todos: todo el alumnado de Rúbricas (o []). */
  function preparar(m, d, todos) {
    var o = (d && d.sesiones || []).filter(function (s) { return s.acta; }).map(function (s) {
      var e = s.acta, partes = {
        sesion: s.nombre,
        areas: g.Evaluacion.areasConAlgo(e).map(function (a) {
          var r = { area: a.nombre }; if (g.Evaluacion.tienePorcentaje(a)) r.porcentajeConDificultades = Number(a.porcentaje);
          if (String(a.notas || '').trim()) r.notas = ocultar(a.notas, todos);
          return r;
        })
      };
      if (String(e.observaciones || '').trim()) partes.observaciones = ocultar(e.observaciones, todos);
      if (String(e.conclusiones || '').trim()) partes.conclusiones = ocultar(e.conclusiones, todos);
      return partes;
    });
    var nombres = d && d.sesiones ? d.sesiones.map(function (s) { return s.nombre; }) : [];
    return {
      grupo: m.grupo, curso: m.curso, notasDeLaTutora: ocultar(m.notas || '', todos),
      elCursoEnCifras: (d ? d.cifras : []).map(function (c) { return c.etiqueta + ': ' + c.valor; }),
      tablaDificultades: d && d.tabla ? d.tabla.areas.map(function (a) {
        var f = { area: a.nombre }; nombres.forEach(function (n, i) { f[n] = M.casilla(a.valores[i]); }); return f;
      }) : [],
      actasDeEvaluacion: o,
      apartados: M.APARTADOS.map(function (a) { return { id: a.id, titulo: a.titulo, guia: a.guia }; })
    };
  }

  /* La petición exacta. Lleva solo INSTRUCCIONES (más el estilo del tema 58, si se pasa) y los datos de arriba; nunca un nombre. */
  function cuerpo(prep, opciones) {
    opciones = opciones || {};
    return {
      model: g.Claude.MODELO, max_tokens: 6000,
      system: INSTRUCCIONES + (opciones.estilo ? '\n' + opciones.estilo : ''),
      messages: [{ role: 'user', content: JSON.stringify(prep) }]
    };
  }

  function demasiado(res) { return Object.keys(res).some(function (k) { return res[k].length > MAX_APARTADO * 2; }); }

  /* Redacta la memoria. Un reintento si llega mal, demasiado larga o con algún nombre. Devuelve { textos: { id: texto }, aviso } o lanza. */
  async function redactar(clave, m, d, todos, opciones) {
    opciones = opciones || {};
    if (!clave) { var f0 = new Error(g.Claude.FRASE_SIN_CLAVE); f0.tipo = 'clave'; throw f0; }
    var pr = M.problema(m, d);
    if (pr) { var v = new Error(pr); v.tipo = 'vacio'; throw v; }
    var prep = preparar(m, d, todos), ultimo = null, mal = null;
    for (var intento = 0; intento < 2; intento++) {
      var crudo = await g.Claude.llamar(clave, cuerpo(prep, opciones), opciones.buscar), res;
      try { res = g.FinalCursoClaude.leerRespuesta(crudo, { apartados: M.APARTADOS }); } catch (err) { ultimo = err; continue; }
      if (demasiado(res)) { ultimo = new Error('Un apartado se pasa de largo.'); continue; }
      if (!nombresEn(res, todos).length) return { textos: res, aviso: '' };
      mal = res;
    }
    if (mal) return { textos: quitarNombres(mal, todos), aviso: AVISO_NOMBRES };
    var e = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); e.tipo = 'formato'; e.detalle = ultimo; throw e;
  }

  /* Redacta y pone los textos en la memoria (sin guardarla). Devuelve el aviso de nombres, o ''. */
  async function redactarMemoria(raiz, m, d, todos) {
    var clave = await g.Claude.claveDe(raiz);
    var r = await redactar(clave, m, d, todos, { estilo: await g.Estilo.paraClaude(raiz, todos) });
    M.ponerRedaccion(m, r.textos, d);
    return r.aviso || '';
  }

  g.MemoriaClaude = { INSTRUCCIONES: INSTRUCCIONES, AVISO_NOMBRES: AVISO_NOMBRES, ocultar: ocultar, nombresEn: nombresEn, quitarNombres: quitarNombres, preparar: preparar, cuerpo: cuerpo, redactar: redactar, redactarMemoria: redactarMemoria };
})(typeof window !== 'undefined' ? window : globalThis);
