/* Claude redacta el informe de final de curso, de ciclo o de etapa (fila 101): un texto por apartado, con las notas de la tutora y lo que la app ya sabe del alumno.
   A Claude no viaja ningún nombre: solo «el alumno»/«la alumna», la clase, y las notas y lo guardado con el alumnado en iniciales entre corchetes
   (alumnado-claude.js); al volver, las marcas vuelven a ser nombres. Una llamada por alumno.
   Toda la forma de pedirlo está aquí (`INSTRUCCIONES` y `cuerpo`); el estilo de redacción (tema 58) se añade en `opciones.estilo`. Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var AC = g.AlumnadoClaude, F = g.FinalCurso;

  var INSTRUCCIONES = [
    'Eres quien redacta, para el docente de un colegio público de Primaria de Andalucía (España), un informe individual de final de curso, de ciclo o de etapa de un alumno o una alumna.',
    'Recibes un JSON con «alumno» («el alumno» o «la alumna», como hay que llamarle), «clase», «informe» (cuál es), «notasDelDocente» (lo que destaca el docente), «loQueSeSabe» (datos guardados del curso) y «apartados» (los apartados que hay que escribir, cada uno con su «id», su «titulo» y de qué trata en «guia»).',
    'Responde con «apartados»: un objeto con una clave por cada «id» recibido y, como valor, el texto de ese apartado.',
    'Reglas:',
    '- Escribe SIEMPRE todos los apartados, aunque haya pocos datos.',
    '- Usa solo lo que dicen las notas del docente y lo guardado: no inventes diagnósticos, notas, cifras, fechas, medidas ni hechos que no estén. Con pocos datos, escribe un texto breve, prudente y general.',
    '- Si «alumno» es «el alumno» o «la alumna», llámale siempre así. Si dice que no se sabe el género, escribe sin marcarlo (usa «el alumnado», «su», «ha mostrado»…) y evita adjetivos y participios con género. Nunca escribas un nombre ni iniciales.',
    '- Lenguaje de documento escolar de Andalucía, en frases claras, en párrafos breves. Cada apartado, entre 250 y 800 caracteres, sin pasar nunca de 1200.',
    '- Texto plano: sin negritas, sin títulos de formato, sin listas numeradas ni repetir el título del apartado.',
    '- No hables de calificaciones numéricas ni de lo que decide la dirección: eso está en Séneca.',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"apartados":{"<id>":"…"}}.'
  ].join('\n');
  var MAX_APARTADO = 1200;

  var SIN_GENERO = 'el alumno o la alumna (no se sabe cuál: escribe sin marcar el género)';
  function palabra(alumno) { return alumno && alumno.genero === 'a' ? 'la alumna' : alumno && alumno.genero === 'o' ? 'el alumno' : SIN_GENERO; }

  /* Red de seguridad extra: un nombre de pila o un apellido suelto («Se lleva mal con Daniela») también se tapa con una marca; al volver, la marca recupera la palabra tal como estaba escrita. */
  function taparSueltos(textos, todos, marcas) {
    var A = g.Alumnado, palabras = {};
    (todos || []).forEach(function (a) {
      [a.pila].concat(A.palabras(a.apellidos || '')).forEach(function (w) {
        var n = A.normalizar(w || '');
        if (Array.from(n).length >= 3 && A.PARTICULAS.indexOf(n) < 0) palabras[n] = true;
      });
    });
    var usadas = {}, siguiente = 101;
    var tapar = function (t) {
      return String(t).replace(/[A-Za-zÀ-ÿ]+/g, function (w) {
        var n = A.normalizar(w);
        if (!palabras[n]) return w;
        if (!usadas[n]) { usadas[n] = '[' + w.charAt(0).toUpperCase() + '.' + (siguiente++) + ']'; marcas[usadas[n]] = w; }
        return usadas[n];
      });
    };
    return textos.map(tapar);
  }

  /* Lo que sale hacia Claude y cómo deshacerlo: { cuerpo, marcas ({ '[M.S.P.]': 'Nombre Apellidos (grupo)' }), avisos }.
     sabe: [{ texto }] de FinalCursoSabe.sabe; todos: todo el alumnado de Rúbricas (o null). */
  function preparar(f, sabe, todos) {
    var prep = AC.preparar([{ n: 1, titulo: 'Notas del docente', notas: f.notas || '' }, { n: 2, titulo: 'Lo que se sabe', notas: (sabe || []).map(function (s) { return s.texto; }).join('\n') }], todos);
    var t = F.tipo(f), marcas = Object.assign({}, prep.marcas[1] || {}, prep.marcas[2] || {});
    var tapados = taparSueltos([prep.puntos[0].notas, prep.puntos[1].notas], todos, marcas);
    var notas = tapados[0], guardado = tapados[1];
    return {
      cuerpo: {
        alumno: palabra(f.alumno), clase: f.alumno.grupo || '', informe: t.nombre,
        notasDelDocente: notas, loQueSeSabe: guardado ? guardado.split('\n') : [],
        apartados: t.apartados.map(function (a) { return { id: a.id, titulo: a.titulo, guia: a.guia }; })
      },
      marcas: marcas, avisos: prep.avisos
    };
  }

  /* La petición exacta. Lleva solo INSTRUCCIONES (más el estilo del tema 58, si se pasa) y los datos de arriba; nunca un nombre. */
  function cuerpo(prep, opciones) {
    opciones = opciones || {};
    return {
      model: g.Claude.MODELO, max_tokens: 6000,
      system: INSTRUCCIONES + (opciones.estilo ? '\n' + opciones.estilo : ''),
      messages: [{ role: 'user', content: JSON.stringify(prep.cuerpo) }]
    };
  }

  /* La respuesta de Claude -> { id: texto }. Lanza si no es el JSON pedido o falta un apartado. */
  function leerRespuesta(crudo, tipo) {
    var t = String(crudo || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var ini = t.indexOf('{'), fin = t.lastIndexOf('}'), o;
    if (ini < 0 || fin < ini) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    o = JSON.parse(t.slice(ini, fin + 1));
    if (!o || !o.apartados || typeof o.apartados !== 'object') throw new Error('La respuesta de Claude no tiene el formato pedido.');
    var res = {};
    tipo.apartados.forEach(function (a) {
      var x = o.apartados[a.id];
      if (typeof x !== 'string' || !x.trim()) throw new Error('La respuesta de Claude no tiene el formato pedido.');
      res[a.id] = x.trim();
    });
    return res;
  }
  function marcasBien(res, prep) {
    var env = Object.keys(prep.marcas);
    return Object.keys(res).every(function (k) { return AC.marcasEn(res[k]).every(function (m) { return env.indexOf(m) >= 0; }); });
  }
  function demasiado(res) { return Object.keys(res).some(function (k) { return res[k].length > MAX_APARTADO * 2; }); }

  /* Redacta un informe. Un reintento si llega mal o con las marcas cambiadas. Devuelve { textos: { id: texto }, aviso } o lanza. */
  async function redactar(clave, f, sabe, todos, opciones) {
    opciones = opciones || {};
    if (!clave) { var f0 = new Error(g.Claude.FRASE_SIN_CLAVE); f0.tipo = 'clave'; throw f0; }
    var pr = F.problema(f, sabe);
    if (pr) { var v = new Error(pr); v.tipo = 'vacio'; throw v; }
    var prep = preparar(f, sabe, todos), ultimo = null, mal = null;
    for (var intento = 0; intento < 2; intento++) {
      var crudo = await g.Claude.llamar(clave, cuerpo(prep, opciones), opciones.buscar), res;
      try { res = leerRespuesta(crudo, F.tipo(f)); } catch (err) { ultimo = err; continue; }
      if (demasiado(res)) { ultimo = new Error('Un apartado se pasa de largo.'); continue; }
      if (marcasBien(res, prep)) return salida(res, prep, Object.keys(prep.avisos || {}).map(function (n) { return prep.avisos[n]; })[0] || '');
      mal = res;
    }
    if (mal) return salida(mal, prep, AC.AVISO_NOMBRES);
    var e = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); e.tipo = 'formato'; e.detalle = ultimo; throw e;
  }
  function salida(res, prep, aviso) {
    var textos = {};
    Object.keys(res).forEach(function (k) { textos[k] = AC.restaurar(res[k], prep.marcas); });
    return { textos: textos, aviso: aviso };
  }

  /* Redacta y pone los textos en el informe (sin guardarlo). Devuelve el aviso de nombres, o ''. Lo usan el botón de un alumno y «Redactar todos». */
  async function redactarInforme(raiz, f, sabe, todos) {
    var clave = await g.Claude.claveDe(raiz);
    var r = await redactar(clave, f, sabe, todos, { estilo: await g.Estilo.paraClaude(raiz, todos) });
    F.ponerRedaccion(f, r.textos);
    return r.aviso || '';
  }

  g.FinalCursoClaude = { INSTRUCCIONES: INSTRUCCIONES, preparar: preparar, cuerpo: cuerpo, leerRespuesta: leerRespuesta, redactar: redactar, redactarInforme: redactarInforme, palabra: palabra };
})(typeof window !== 'undefined' ? window : globalThis);
