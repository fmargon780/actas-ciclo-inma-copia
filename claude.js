/* La llamada a Claude, desde la página, con la clave de ACTAS/clave.json. Un único sitio para el modelo.
   Respuesta en JSON fijo y un reintento si llega mal. A Claude solo le llegan títulos y notas de los puntos. */
(function (g) {
  'use strict';
  var MODELO = 'claude-sonnet-5-5';
  var URL_API = 'https://api.anthropic.com/v1/messages';

  var INSTRUCCIONES = [
    'Eres quien redacta las actas del equipo de ciclo de un colegio público de Primaria de Andalucía (España).',
    'Recibes una lista JSON de puntos del orden del día, cada uno con n (número), titulo y notas cortas escritas o dictadas por la maestra.',
    'Para cada punto escribe el texto que irá en el acta.',
    'Reglas:',
    '- Estilo formal y sencillo, en pasado o presente impersonal: «Se informa de…», «Se acuerda…», «Se hace constar…», «Queda pendiente…».',
    '- Un párrafo por punto. Si las notas traen una lista (varias cosas enumeradas), puedes escribir una frase de introducción y después las viñetas, cada una en su línea y empezando por «• ».',
    '- Usa solo lo que dicen las notas: no inventes fechas, cifras, nombres ni acuerdos. Si una nota no se entiende, redáctala tal cual, sin rellenar.',
    '- Escribe las abreviaturas en su forma completa para un colegio de Primaria andaluz: «Cono» = Conocimiento del Medio, «Lengua» = Lengua Castellana, «profe» = profesorado, «3.º» = 3.º EP.',
    '- Las iniciales del alumnado se dejan como vienen.',
    '- No repitas el título del punto ni pongas numeración.',
    'Ejemplos del estilo:',
    '  notas: «faltan 2 guías profe: Lengua 3.º y Lengua 4.º» -> «Se hace constar que se precisa la reposición de dos guías didácticas para el profesorado (una de Lengua Castellana de 3.º EP y otra de 4.º EP).»',
    '  notas: «faltan libros: 3.º 5 Lengua, 6 Cono, 5 Inglés; 4.º 5 Lengua, 5 Cono» -> «Queda pendiente la recepción de los siguientes libros de texto para el alumnado: 5 de Lengua Castellana (3.º EP), 6 de Conocimiento del Medio (3.º EP), 5 de Inglés (3.º EP), 5 de Lengua Castellana (4.º EP) y 5 de Conocimiento del Medio (4.º EP).»',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"puntos":[{"n":1,"parrafo":"…"}]}, con un elemento por cada punto recibido.'
  ].join('\n');
  var OTRA_VERSION = 'Escribe una redacción distinta de la habitual, con otras palabras y otra estructura, sin cambiar lo que dicen las notas.';

  var FRASE_RED = 'Desde esta red no llego a Claude: redacta en casa o escribe tú el párrafo.';
  var FRASE_SIN_CLAVE = 'Falta la clave de Claude. Ponla en Ajustes.';

  /* El cuerpo exacto que se envía. Solo lleva INSTRUCCIONES y los puntos (n, titulo, notas). */
  function cuerpo(puntos, otraVersion) {
    return {
      model: MODELO, max_tokens: 4000, system: INSTRUCCIONES + (otraVersion ? '\n' + OTRA_VERSION : ''),
      messages: [{ role: 'user', content: JSON.stringify({ puntos: puntos }) }]
    };
  }

  /* Una llamada. Devuelve el texto de la respuesta. Lanza errores con frase en español (e.tipo: 'red' | 'clave' | 'servicio'). */
  async function llamar(clave, cuerpoPeticion, buscar) {
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
      var texto = await llamar(clave, cuerpo(puntos, opciones.otraVersion), opciones.buscar);
      try { return g.Redaccion.leerRespuesta(texto, indices); } catch (err) { ultimo = err; }
    }
    var f = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.tipo = 'formato'; f.detalle = ultimo; throw f;
  }

  g.Claude = { MODELO: MODELO, cuerpo: cuerpo, redactar: redactar, FRASE_RED: FRASE_RED, FRASE_SIN_CLAVE: FRASE_SIN_CLAVE };
})(typeof window !== 'undefined' ? window : globalThis);
