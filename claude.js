/* La llamada a Claude, desde la página. En la app de internet (https) pasa por el servicio, con la sesión y sin clave; en la copia sin internet (file:)
   sigue con la clave de ACTAS/clave.json. Un único sitio para el modelo.
   Respuesta en JSON fijo y un reintento si llega mal. A Claude solo le llegan títulos y notas de los puntos. */
(function (g) {
  'use strict';
  var MODELO = 'claude-sonnet-5-5';
  var URL_API = 'https://api.anthropic.com/v1/messages';

  var INSTRUCCIONES = [
    'Eres quien redacta las actas del equipo de ciclo de un colegio público de Primaria de Andalucía (España).',
    'Recibes una lista JSON de puntos del orden del día, cada uno con n (número), titulo y notas cortas escritas o dictadas por la maestra.',
    'Un punto puede traer además «huecos» (cada uno con su titulo y sus notas: lo que se tomó sobre ese aspecto del punto) y «grupos» (cada grupo con sus huecos). Usa todo junto con las notas del punto y únelo en párrafos seguidos, sin copiar los títulos de los huecos.',
    'Para cada punto escribe el texto que irá en el acta.',
    'Reglas:',
    '- Estilo formal y sencillo, en pasado o presente impersonal: «Se informa de…», «Se acuerda…», «Se hace constar…», «Queda pendiente…».',
    '- Un párrafo por punto. Si las notas traen una lista (varias cosas enumeradas), puedes escribir una frase de introducción y después las viñetas, cada una en su línea y empezando por «• ».',
    '- Usa solo lo que dicen las notas: no inventes fechas, cifras, nombres ni acuerdos. Si una nota no se entiende, redáctala tal cual, sin rellenar.',
    '- Escribe las abreviaturas en su forma completa para un colegio de Primaria andaluz: «Cono» = Conocimiento del Medio, «Lengua» = Lengua Castellana, «profe» = profesorado, «3.º» = 3.º EP.',
    '- El alumnado aparece como marcas entre corchetes, por ejemplo [M.S.P.] o [L.G.R.2]. Copia cada marca exactamente igual, sin cambiarla ni añadirle nada, y no las uses para nada más.',
    '- No repitas el título del punto ni pongas numeración.',
    'Ejemplos del estilo:',
    '  notas: «faltan 2 guías profe: Lengua 3.º y Lengua 4.º» -> «Se hace constar que se precisa la reposición de dos guías didácticas para el profesorado (una de Lengua Castellana de 3.º EP y otra de 4.º EP).»',
    '  notas: «faltan libros: 3.º 5 Lengua, 6 Cono, 5 Inglés; 4.º 5 Lengua, 5 Cono» -> «Queda pendiente la recepción de los siguientes libros de texto para el alumnado: 5 de Lengua Castellana (3.º EP), 6 de Conocimiento del Medio (3.º EP), 5 de Inglés (3.º EP), 5 de Lengua Castellana (4.º EP) y 5 de Conocimiento del Medio (4.º EP).»',
    'Si un punto trae "bloques":true (sesión de evaluación), en vez de "parrafo" responde con "bloques": un bloque por cada grupo con algo escrito, con "titulo" igual al nombre del grupo, y después un bloque por cada hueco general con algo escrito (por ejemplo «Acuerdos y propuestas de mejora»), con "titulo" igual al título del hueco: {"n":3,"bloques":[{"titulo":"3.º A","parrafo":"…"}]}.',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"puntos":[{"n":1,"parrafo":"…"}]}, con un elemento por cada punto recibido.'
  ].join('\n');
  var OTRA_VERSION = 'Escribe una redacción distinta de la habitual, con otras palabras y otra estructura, sin cambiar lo que dicen las notas.';

  var FRASE_RED = 'Desde esta red no llego a Claude: redacta en casa o escribe tú el párrafo.';
  var FRASE_SIN_CLAVE = 'Falta la clave de Claude. Ponla en Ajustes.';
  var AVISAR_DESDE = 5; /* si quedan tantas o menos, se avisa tras redactar */
  var FRASES_SERVICIO = {
    sesion: 'Tu sesión ha caducado. Recarga la página y vuelve a entrar.',
    'no-invitado': 'Tu cuenta ya no está en la lista de invitados.',
    'sin-saldo': 'Las redacciones de Claude no están disponibles ahora mismo. Vuelve a intentarlo más tarde o escribe tú el texto.',
    ocupado: 'Claude está muy ocupado ahora mismo. Vuelve a intentarlo en un momento.'
  };

  /* La app de internet usa el servicio; la copia (file:) y las pruebas en http siguen con la clave de la carpeta. */
  function enServicio() { return !!(g.location && g.location.protocol === 'https:' && g.Servicio); }
  function fraseTope(tope) { return 'Has usado tus ' + tope + ' redacciones de este mes. El día 1 vuelves a tener ' + tope + '. Mientras tanto, puedes escribir tú el texto.'; }
  function fraseQuedan(n) { return 'Te quedan ' + n + (n === 1 ? ' redacción' : ' redacciones') + ' este mes.'; }
  function pulsacionNueva() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

  /* Lo que cada pantalla pasa como «clave» al pulsar un botón de redactar: en el servicio, una marca con el identificador de esa pulsación
     (varias llamadas de la misma pulsación cuentan como una sola redacción); en la copia, la clave de la carpeta. */
  async function claveDe(raiz) {
    if (enServicio()) return { servicio: true, pulsacion: pulsacionNueva() };
    return g.Datos.leerClave(raiz);
  }

  /* Aviso pequeño y pasajero junto a la pantalla (no depende de qué pantalla pidió la redacción). */
  function avisoPasajero(texto) {
    if (typeof document === 'undefined' || !document.body) return;
    var viejo = document.getElementById('avisoQuedan'); if (viejo) viejo.remove();
    var e = document.createElement('div'); e.id = 'avisoQuedan'; e.className = 'aviso ok saldo-claude'; e.setAttribute('role', 'status'); e.textContent = texto;
    document.body.appendChild(e);
    /* El botón «Soporte» sube por encima del aviso mientras se ve. */
    var raiz = document.documentElement, estilo = raiz && raiz.style;
    if (estilo) estilo.setProperty('--soporte-abajo', (e.offsetHeight + 32) + 'px');
    setTimeout(function () { if (e.parentNode) e.remove(); if (estilo) estilo.removeProperty('--soporte-abajo'); }, 9000);
  }

  /* Una llamada por el servicio. Mismos errores (e.tipo) que la llamada directa, con frases del servicio. */
  async function llamarServicio(marca, cuerpoPeticion, buscar) {
    var datos = { pulsacion: marca.pulsacion, messages: cuerpoPeticion.messages, max_tokens: cuerpoPeticion.max_tokens };
    if (cuerpoPeticion.system) datos.system = cuerpoPeticion.system;
    var r = await g.Servicio.llamar('redactar', datos, buscar);
    if (r && r.ok) {
      var quedan = typeof r.tope === 'number' ? r.tope - r.redacciones : null;
      g.Servicio.recordarSaldo({ tope: r.tope, redacciones: r.redacciones });
      if (quedan !== null && quedan <= AVISAR_DESDE) avisoPasajero(fraseQuedan(Math.max(quedan, 0)));
      return r.texto;
    }
    var motivo = r && r.motivo, e;
    if (motivo === 'red' || !r) { e = new Error(FRASE_RED); e.tipo = 'red'; throw e; }
    if (motivo === 'tope') { e = new Error(fraseTope(r.tope)); e.tipo = 'tope'; throw e; }
    if (motivo === 'sesion') g.Servicio.olvidar();
    e = new Error(FRASES_SERVICIO[motivo] || 'Claude no está respondiendo bien ahora mismo. Vuelve a intentarlo en un momento.');
    e.tipo = motivo === 'sin-saldo' ? 'saldo' : 'servicio';
    throw e;
  }

  /* El cuerpo exacto que se envía. Solo lleva INSTRUCCIONES y los puntos (n, titulo, notas). */
  function cuerpo(puntos, otraVersion, estilo) {
    return {
      model: MODELO, max_tokens: 4000, system: INSTRUCCIONES + (estilo ? '\n' + estilo : '') + (otraVersion ? '\n' + OTRA_VERSION : ''),
      messages: [{ role: 'user', content: JSON.stringify({ puntos: puntos }) }]
    };
  }

  /* Una llamada. Devuelve el texto de la respuesta. Lanza errores con frase en español (e.tipo: 'red' | 'clave' | 'servicio'). */
  async function llamar(clave, cuerpoPeticion, buscar) {
    if (clave && clave.servicio) return llamarServicio(clave, cuerpoPeticion, buscar);
    var resp;
    try {
      resp = await (buscar || g.fetch.bind(g))(URL_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(cuerpoPeticion)
      });
    } catch (e) { var r = new Error(FRASE_RED); r.tipo = 'red'; throw r; }
    if (resp.status === 401 || resp.status === 403) { var c = new Error('Claude no ha aceptado la clave. Revísala en Ajustes.'); c.tipo = 'clave'; throw c; }
    if (!resp.ok) { var s = new Error('Claude no está respondiendo bien ahora mismo (código ' + resp.status + '). Vuelve a intentarlo en un momento.'); s.tipo = 'servicio'; throw s; }
    var j = await resp.json();
    return (j.content || []).filter(function (x) { return x.type === 'text'; }).map(function (x) { return x.text; }).join('');
  }

  /* Redacta los puntos que se piden: { n: párrafo }. Si la respuesta llega mal, un reintento. */
  async function redactar(clave, puntos, opciones) {
    opciones = opciones || {};
    if (!clave) { var e = new Error(FRASE_SIN_CLAVE); e.tipo = 'clave'; throw e; }
    var indices = puntos.map(function (p) { return p.n - 1; });
    var ultimo = null;
    for (var intento = 0; intento < 2; intento++) {
      var texto = await llamar(clave, cuerpo(puntos, opciones.otraVersion, opciones.estilo), opciones.buscar);
      try { return g.Redaccion.leerRespuesta(texto, indices); } catch (err) { ultimo = err; }
    }
    var f = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.tipo = 'formato'; f.detalle = ultimo; throw f;
  }

  /* Como `redactar`, pero con el alumnado: a Claude van solo iniciales y los párrafos vuelven con «Nombre Apellidos (grupo)».
     b: el borrador; todos: todo el alumnado de Rúbricas (o null). Devuelve { parrafos: { n: texto }, avisos: { n: texto }, notasMarcadas: { n: notas } }.
     Si a un párrafo le falta una marca o trae una que no se envió, se pide otra vez ese párrafo; si sigue mal, se queda con las iniciales y un aviso. */
  async function redactarConAlumnado(clave, b, indices, todos, opciones) {
    var AC = g.AlumnadoClaude, prep = g.Redaccion.prepararPeticion(b, indices, todos);
    var res = await redactar(clave, prep.puntos, opciones), mal = [];
    prep.puntos.forEach(function (p) { if (!AC.marcasBien(res[p.n], prep.marcas[p.n])) mal.push(p); });
    if (mal.length) {
      var otra = await redactar(clave, mal, opciones);
      mal.forEach(function (p) { res[p.n] = otra[p.n]; });
    }
    var parrafos = {}, avisos = {};
    prep.puntos.forEach(function (p) {
      if (AC.marcasBien(res[p.n], prep.marcas[p.n])) parrafos[p.n] = AC.restaurar(res[p.n], prep.marcas[p.n]);
      else { parrafos[p.n] = res[p.n]; avisos[p.n] = AC.AVISO_NOMBRES; }
      if (prep.avisos[p.n]) avisos[p.n] = avisos[p.n] ? avisos[p.n] + '. ' + prep.avisos[p.n] : prep.avisos[p.n];
    });
    return { parrafos: parrafos, avisos: avisos, notasMarcadas: prep.notasMarcadas, marcados: prep.marcados };
  }

  g.Claude = { MODELO: MODELO, URL_API: URL_API, llamar: llamar, claveDe: claveDe, enServicio: enServicio, cuerpo: cuerpo, redactar: redactar, redactarConAlumnado: redactarConAlumnado, FRASE_RED: FRASE_RED, FRASE_SIN_CLAVE: FRASE_SIN_CLAVE };
})(typeof window !== 'undefined' ? window : globalThis);
