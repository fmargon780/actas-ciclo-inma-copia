/* Claude pule lo que Inma añade a los puntos del acta de la reunión general con las familias (fila 42). A Claude solo viajan el título del punto y las notas
   de lo añadido, con el alumnado en iniciales entre corchetes (la ruta de la fila 15); nunca un nombre. Los textos fijos no viajan: ya están escritos.
   Sin pantalla: se prueba con node --test con un `buscar` falso. */
(function (g) {
  'use strict';
  var AC = g.AlumnadoClaude, R = g.Reunion;

  var INSTRUCCIONES = [
    'Eres quien redacta las actas de la reunión general con las familias que hace una maestra tutora de un colegio público de Primaria de Andalucía (España).',
    'Recibes una lista JSON de puntos del acta, cada uno con n (número), titulo (el punto que se trató) y notas cortas escritas o dictadas por la maestra: lo que se ha de añadir a ese punto.',
    'Para cada punto escribe el texto que se añadirá al acta, a continuación del texto fijo que ya lleva el punto (no lo repitas).',
    'Reglas:',
    '- Estilo formal y sencillo, en impersonal: «Se informa de que…», «Se hace constar que…», «Las familias preguntan por…», «Se aclara que…».',
    '- Un párrafo corto por punto, de una o dos frases. Si las notas traen una lista, puedes escribir una frase de introducción y después las viñetas, cada una en su línea y empezando por «• ».',
    '- Usa solo lo que dicen las notas: no inventes fechas, cifras, nombres ni acuerdos. Si una nota no se entiende, redáctala tal cual, sin rellenar.',
    '- Escribe las abreviaturas en su forma completa («profe» = profesorado, «3.º» = 3.º EP).',
    '- El alumnado y las familias aparecen, si aparecen, como marcas entre corchetes, por ejemplo [M.S.P.]. Copia cada marca exactamente igual, sin cambiarla ni añadirle nada.',
    '- No repitas el título del punto ni pongas numeración.',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"puntos":[{"n":1,"parrafo":"…"}]}, con un elemento por cada punto recibido.'
  ].join('\n');
  var OTRA_VERSION = 'Escribe una redacción distinta de la habitual, con otras palabras y otra estructura, sin cambiar lo que dicen las notas.';

  /* Lo que sale hacia Claude: los puntos pedidos (índices 0..13) con notas, en iniciales. Devuelve { puntos, marcas, avisos }. */
  function preparar(r, indices, todos) {
    var crudos = indices.filter(function (i) { return R.hayAnadir(r.puntos[i]); }).map(function (i) {
      return { n: i + 1, titulo: R.PUNTOS[i].tituloAcuerdo, notas: String(r.puntos[i].anadir) };
    });
    return AC.preparar(crudos, todos);
  }

  /* La petición exacta que se manda: INSTRUCCIONES y los puntos (n, titulo, notas). */
  function cuerpo(puntos, otraVersion) {
    return {
      model: g.Claude.MODELO, max_tokens: 3000, system: INSTRUCCIONES + (otraVersion ? '\n' + OTRA_VERSION : ''),
      messages: [{ role: 'user', content: JSON.stringify({ puntos: puntos }) }]
    };
  }

  async function pedir(clave, puntos, opciones) {
    var indices = puntos.map(function (p) { return p.n - 1; }), ultimo = null;
    for (var intento = 0; intento < 2; intento++) {
      var texto = await g.Claude.llamar(clave, cuerpo(puntos, opciones.otraVersion), opciones.buscar);
      try { return g.Redaccion.leerRespuesta(texto, indices); } catch (err) { ultimo = err; }
    }
    var f = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.tipo = 'formato'; f.detalle = ultimo; throw f;
  }

  /* Redacta lo añadido en los puntos `indices` que tengan notas. Devuelve { parrafos: { n: texto con nombres }, avisos: { n: texto } }.
     Si a un párrafo le falta una marca o trae una que no se envió, se pide otra vez ese punto; si sigue mal, se queda con las iniciales y un aviso. */
  async function redactar(clave, r, indices, todos, opciones) {
    opciones = opciones || {};
    if (!clave) { var f0 = new Error(g.Claude.FRASE_SIN_CLAVE); f0.tipo = 'clave'; throw f0; }
    var prep = preparar(r, indices, todos);
    if (!prep.puntos.length) { var v = new Error('Escribe primero lo que quieras añadir en algún punto.'); v.tipo = 'vacio'; throw v; }
    var res = await pedir(clave, prep.puntos, opciones), mal = [];
    prep.puntos.forEach(function (p) { if (!AC.marcasBien(res[p.n], prep.marcas[p.n])) mal.push(p); });
    if (mal.length) {
      var otra = await pedir(clave, mal, opciones);
      mal.forEach(function (p) { res[p.n] = otra[p.n]; });
    }
    var parrafos = {}, avisos = {};
    prep.puntos.forEach(function (p) {
      if (AC.marcasBien(res[p.n], prep.marcas[p.n])) parrafos[p.n] = AC.restaurar(res[p.n], prep.marcas[p.n]);
      else { parrafos[p.n] = res[p.n]; avisos[p.n] = AC.AVISO_NOMBRES; }
      if (prep.avisos[p.n]) avisos[p.n] = avisos[p.n] ? avisos[p.n] + '. ' + prep.avisos[p.n] : prep.avisos[p.n];
    });
    return { parrafos: parrafos, avisos: avisos };
  }

  g.ReunionClaude = { INSTRUCCIONES: INSTRUCCIONES, preparar: preparar, cuerpo: cuerpo, redactar: redactar };
})(typeof window !== 'undefined' ? window : globalThis);
