/* Retoque de un texto ya redactado (tema 58, fila 64): «Más escueto», «Desarrolla más», «Más técnico», «Más sencillo» y «Otro cambio…».
   Claude parte del texto tal como está ahora (con las correcciones a mano) y cambia solo lo pedido; no vuelve a las notas. El estilo de Ajustes viaja como base,
   pero la orden del botón manda. A Claude solo llegan iniciales (la misma ruta de nombres que las notas, pero reversible) y al volver se ponen los nombres.
   También guarda las versiones anteriores de cada texto (`o.versiones[clave]`, se guardan con el borrador) para «Deshacer». Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var AC = g.AlumnadoClaude;
  /* Tope prudente para las cajas de Séneca (el código no tenía ninguno): «Desarrolla más» no pasa de aquí. */
  var LIMITE_SENECA = 4000;
  var MAX_VERSIONES = 40, MAX_LIBRE = 300, SEP = '\n\u0001\n';
  var ORDENES = [['escueto', 'Más escueto'], ['desarrolla', 'Desarrolla más'], ['tecnico', 'Más técnico'], ['sencillo', 'Más sencillo']];
  var FRASES = {
    escueto: 'Hazlo más escueto: quita lo accesorio y acorta las frases, sin perder ningún dato.',
    desarrolla: 'Desarróllalo más: añade contexto y usa frases completas, sin inventar nada que no esté ya en el texto.',
    tecnico: 'Hazlo más técnico: usa el vocabulario propio de la normativa educativa andaluza.',
    sencillo: 'Hazlo más sencillo: palabras corrientes y frases claras, sin tecnicismos.'
  };
  var INSTRUCCIONES = [
    'Eres quien revisa los textos de las actas de una maestra de un colegio público de Primaria de Andalucía (España).',
    'Recibes un JSON con «texto» (el texto tal como está ahora, con las correcciones a mano de la maestra) y «orden» (el cambio que pide).',
    'Devuelve el mismo texto cambiado SOLO en lo que pide la orden. Parte del texto que recibes: no lo escribas desde cero y conserva las palabras y correcciones de la maestra que la orden no toque.',
    'Reglas:',
    '- La orden manda sobre cualquier estilo general que se indique más abajo.',
    '- Usa solo lo que dice el texto: no inventes fechas, cifras, nombres ni acuerdos.',
    '- Conserva los saltos de línea, los párrafos y las viñetas (cada una en su línea y empezando por «• ») salvo que la orden pida otra cosa.',
    '- El alumnado aparece como marcas entre corchetes, por ejemplo [M.S.P.]. Copia cada marca exactamente igual, sin cambiarla ni añadirle nada. Si la orden pide quitar la frase donde sale, puede desaparecer.',
    '- Si viene «maximoCaracteres», el texto que devuelvas no puede pasar de esa cantidad de caracteres.',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"texto":"…"}.'
  ].join('\n');
  var FRASE_BASE = 'Estilo general elegido en Ajustes (sirve de base; la orden de arriba manda):';

  /* --- Versiones para «Deshacer» --- */
  function lista(o, k, crear) {
    if (!o.versiones || typeof o.versiones !== 'object') { if (!crear) return []; o.versiones = {}; }
    if (!Array.isArray(o.versiones[k])) { if (!crear) return []; o.versiones[k] = []; }
    return o.versiones[k];
  }
  /* Guarda el texto que hay ahora (con lo corregido a mano), antes de cambiarlo. Un texto vacío o igual al último guardado no se guarda. */
  function guardarVersion(o, k, texto) {
    var t = String(texto == null ? '' : texto);
    if (!t.trim()) return;
    var l = lista(o, k, true);
    if (l.length && l[l.length - 1] === t) return;
    l.push(t);
    while (l.length > MAX_VERSIONES) l.shift();
  }
  function hayVersiones(o, k) { return lista(o, k, false).length > 0; }
  /* El texto tal como lo dejó el último cambio automático (botón, redactar o deshacer): sirve para saber si la maestra ha escrito encima desde entonces. */
  function fijar(o, k, texto) { lista(o, k + '@', true).splice(0, 1, String(texto == null ? '' : texto)); }
  /* Un cambio automático: guarda el texto de antes (con lo corregido a mano) y anota el de ahora. Si la maestra había escrito encima del último
     texto automático, ese también se guarda, para que «Deshacer» llegue hasta el primer texto que redactó Claude. */
  function cambiar(o, k, antes, ahora) {
    var marca = lista(o, k + '@', false)[0];
    if (marca != null && marca.trim() && marca !== String(antes == null ? '' : antes)) guardarVersion(o, k, marca);
    guardarVersion(o, k, antes); fijar(o, k, ahora);
  }
  /* Devuelve la versión anterior (y la quita de la lista) o null si no hay. Salta las iguales al texto actual.
     Si la maestra escribió encima desde el último cambio, ese texto no se pierde: queda guardado para el siguiente «Deshacer». */
  function deshacer(o, k, actual) {
    var l = lista(o, k, false), a = String(actual == null ? '' : actual), marca = lista(o, k + '@', false)[0];
    var escrito = marca != null && marca !== a && a.trim() !== '';
    while (l.length && l[l.length - 1] === a) l.pop();
    var antes = l.length ? l.pop() : null;
    if (antes == null) return null;
    if (escrito) guardarVersion(o, k, a);
    fijar(o, k, antes);
    return antes;
  }

  /* --- La llamada --- */
  function leerRespuesta(texto) {
    var t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var ini = t.indexOf('{'), fin = t.lastIndexOf('}');
    if (ini < 0 || fin < ini) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    var o = JSON.parse(t.slice(ini, fin + 1));
    if (!o || typeof o.texto !== 'string' || !o.texto.trim()) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    return o.texto.trim();
  }

  /* La petición exacta: INSTRUCCIONES (+ estilo de Ajustes) y { orden, texto, maximoCaracteres? }; el texto y la orden ya van en iniciales. */
  function cuerpo(texto, orden, limite, estilo) {
    var o = { orden: orden, texto: texto };
    if (limite) o.maximoCaracteres = limite;
    return {
      model: g.Claude.MODELO, max_tokens: 4000, system: INSTRUCCIONES + (estilo ? '\n' + FRASE_BASE + '\n' + estilo : ''),
      messages: [{ role: 'user', content: JSON.stringify(o) }]
    };
  }

  function error(tipo, mensaje) { var e = new Error(mensaje); e.tipo = tipo; return e; }

  /* orden: { id: 'escueto' | 'desarrolla' | 'tecnico' | 'sencillo' } o { libre: 'quita la última frase' }.
     opciones: { estilo (líneas de Estilo.paraClaude), todos (alumnado de Rúbricas o null), limite (caracteres), buscar }.
     Devuelve { texto (con los nombres puestos), aviso }. Un reintento si llega mal, con marcas inventadas o pasado del límite. */
  async function retocar(clave, texto, orden, opciones) {
    opciones = opciones || {}; orden = orden || {};
    if (!clave) throw error('clave', g.Claude.FRASE_SIN_CLAVE);
    var actual = String(texto == null ? '' : texto).trim();
    if (!actual) throw error('vacio', 'Todavía no hay texto que cambiar.');
    var libre = '';
    if (orden.libre !== undefined) {
      libre = String(orden.libre || '').trim().slice(0, MAX_LIBRE);
      if (!libre) throw error('vacio', 'Escribe qué quieres cambiar.');
    } else if (!FRASES[orden.id]) throw error('orden', 'No conozco ese cambio.');
    var tapado = g.Anonimizar.crear(opciones.todos || []).reversible(libre ? actual + SEP + libre : actual);
    var partes = tapado.texto.split(SEP), aClaude = partes[0];
    var frase = libre ? 'Cambio que pide la maestra: ' + partes[1] : FRASES[orden.id];
    var ultimo = null, mal = null, largo = false;
    for (var intento = 0; intento < 2; intento++) {
      var respuesta = await g.Claude.llamar(clave, cuerpo(aClaude, frase, opciones.limite, opciones.estilo), opciones.buscar), nuevo;
      try { nuevo = leerRespuesta(respuesta); } catch (err) { ultimo = err; continue; }
      var puesto = AC.restaurar(nuevo, tapado.marcas);
      if (opciones.limite && puesto.length > opciones.limite) { largo = true; continue; }
      largo = false;
      if (AC.marcasEn(nuevo).every(function (m) { return tapado.marcas[m] != null; })) return { texto: puesto, aviso: '' };
      mal = puesto;
    }
    if (largo) throw error('limite', 'El texto nuevo se pasaría de los ' + opciones.limite + ' caracteres que admite Séneca. Prueba con «Más escueto».');
    if (mal) return { texto: mal, aviso: AC.AVISO_NOMBRES };
    var f = error('formato', 'Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.detalle = ultimo; throw f;
  }

  g.Retoque = {
    ORDENES: ORDENES, FRASES: FRASES, INSTRUCCIONES: INSTRUCCIONES, MAX_VERSIONES: MAX_VERSIONES, LIMITE_SENECA: LIMITE_SENECA, MAX_LIBRE: MAX_LIBRE,
    guardarVersion: guardarVersion, fijar: fijar, cambiar: cambiar, hayVersiones: hayVersiones, deshacer: deshacer, leerRespuesta: leerRespuesta, cuerpo: cuerpo, retocar: retocar
  };
})(typeof window !== 'undefined' ? window : globalThis);
