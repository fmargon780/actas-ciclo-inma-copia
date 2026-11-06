/* Claude (API de Anthropic) desde la página: la clave, la llamada y las dos propuestas (actividad y rúbrica) con forma fija.
   Sin pantalla: sirve en el navegador y en las pruebas. A Claude solo van criterio, área, curso e ideas de Inma; NUNCA nombres de alumnos. */
(function (g) {
  'use strict';

  var MODELO = 'claude-sonnet-5-5'; /* el único sitio donde se escribe el modelo */
  var URL_API = 'https://api.anthropic.com/v1/messages';
  var FICHERO_CLAVE = 'clave.json';
  var NIVELES = ['Insuficiente', 'Suficiente', 'Bien', 'Notable', 'Sobresaliente'];

  function ErrorClaude(codigo, mensaje) { var e = new Error(mensaje); e.codigo = codigo; return e; }

  /* La clave vive en la carpeta de Inma (clave.json), nunca en el programa. */
  async function leerClave(carpeta) { var d = await carpeta.leerJSON(FICHERO_CLAVE); return d && typeof d.clave === 'string' ? d.clave.trim() : ''; }
  function guardarClave(carpeta, clave) {
    clave = String(clave || '').trim();
    if (!/^sk-ant-[\w-]{10,}$/.test(clave)) throw new Error('Esa clave no parece buena: tiene que empezar por «sk-ant-». Cópiala entera.');
    return carpeta.escribirJSON(FICHERO_CLAVE, { clave: clave });
  }
  function quitarClave(carpeta) { return carpeta.escribirJSON(FICHERO_CLAVE, { clave: '' }); }

  function sinTildes(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim(); }
  /* Falla si el texto lleva el nombre de algún alumno (tal como está guardado, «Apellidos, Nombre», o «Nombre Apellidos»). */
  function vigilarNombres(texto, nombres) {
    var t = ' ' + sinTildes(texto) + ' ';
    (nombres || []).forEach(function (n) {
      var partes = String(n).split(','), variantes = [sinTildes(n)];
      if (partes.length === 2) variantes.push(sinTildes(partes[1] + ' ' + partes[0]));
      variantes.forEach(function (v) {
        if (v.length >= 5 && t.indexOf(' ' + v + ' ') >= 0) throw ErrorClaude('nombres', 'Tu texto lleva el nombre de un alumno («' + n + '»). Quítalo: a Claude no se le mandan nombres de niños.');
      });
    });
  }

  var SISTEMA = 'Eres un ayudante de una maestra de Primaria de Andalucía (CEIP, 3.º y 4.º). Hablas en español sencillo y práctico, con ideas que se puedan hacer en un aula real. ' +
    'Te doy el criterio de evaluación oficial (literal), el área, el curso y la idea de la maestra. Nunca hay nombres de alumnos: no los inventes ni los pidas. ' +
    'Si el área es Educación Artística, la maestra es de Música: piensa en música (ritmo, voz, instrumentos del aula, audición, creación), salvo que su idea diga otra cosa. ' +
    'Respondes SOLO con un objeto JSON válido, sin texto antes ni después y sin bloques de código.';

  /* Con `conId`, cada criterio va con su id exacto («area:código»): así Claude lo puede devolver en cada fila de la rúbrica. */
  function clave(k) { return k.id || k.codigo; }
  function textoCriterios(criterios, conId) { return criterios.map(function (c) { return '- ' + (conId ? clave(c) : c.codigo) + ': ' + c.texto; }).join('\n'); }
  function contexto(c, conId) { return 'Área: ' + c.area + '\nCurso: ' + c.curso + '.º de Primaria\nCriterio(s) de evaluación (texto oficial):\n' + textoCriterios(c.criterios, conId); }

  var FORMA_ACTIVIDAD = '{"titulo": "…", "duracion": "por ejemplo 2 sesiones de 45 minutos", "sesiones": número de sesiones (1 a 12), "producto": "producto final", "materiales": "materiales", ' +
    '"pasos": [{"texto": "qué se hace en la sesión", "minutos": número}], "porque": "por qué encaja con el criterio, en una o dos frases"}. "pasos" tiene exactamente "sesiones" elementos.';
  var FORMA_RUBRICA = '{"filas": [{"criterio": "id exacto de la lista", "texto": "qué se mira", "peso": 1, "celdas": ["Insuficiente", "Suficiente", "Bien", "Notable", "Sobresaliente"]}]}. ' +
    'De 3 a 8 filas, y como mínimo UNA fila para cada criterio de la lista (cada fila con el id de su criterio, tal cual está escrito; no añadas ni quites criterios). Cada fila lleva exactamente 5 textos en celdas, uno por nivel en ese orden (' + NIVELES.join(', ') + '), con lo que tiene que pasar en cada nivel, en frases cortas y observables.';

  function pedirActividad(c) {
    var m = contexto(c) + '\n\nIdea de la maestra: ' + c.idea;
    if (c.anterior && c.cambios) m += '\n\nPropuesta anterior:\n' + JSON.stringify(c.anterior) + '\n\nCambios que pide la maestra: ' + c.cambios + '\nDevuelve la propuesta completa con esos cambios.';
    return m + '\n\nDevuelve este JSON: ' + FORMA_ACTIVIDAD;
  }
  function pedirRubrica(c) {
    var a = c.actividad;
    return contexto(c, true) + '\n\nActividad: ' + a.titulo + '. Producto final: ' + a.producto + '. Materiales: ' + a.materiales + '.\nPasos:\n' +
      a.pasos.map(function (p, i) { return (i + 1) + '. ' + p; }).join('\n') + '\n\nCrea la rúbrica de esta actividad. Devuelve este JSON: ' + FORMA_RUBRICA;
  }

  function trozoJSON(texto) {
    var t = String(texto || '').replace(/```(?:json)?/gi, ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('no hay JSON');
    return JSON.parse(t.slice(a, b + 1));
  }
  function cadena(x, nombre) { if (typeof x !== 'string' || !x.trim()) throw new Error('falta ' + nombre); return x.trim(); }

  function validarActividad(o) {
    var n = Number(o.sesiones);
    if (!isFinite(n) || n < 1 || n > 12) throw new Error('sesiones');
    n = Math.round(n);
    if (!Array.isArray(o.pasos) || o.pasos.length < 1) throw new Error('pasos');
    var pasos = o.pasos.slice(0, n).map(function (p) {
      var txt = cadena(typeof p === 'string' ? p : p && p.texto, 'paso'), min = p && Number(p.minutos);
      return min > 0 ? txt + ' (' + Math.round(min) + ' min)' : txt;
    });
    while (pasos.length < n) pasos.push('');
    return { titulo: cadena(o.titulo, 'título'), duracion: cadena(o.duracion, 'duración'), sesiones: n, producto: cadena(o.producto, 'producto'),
      materiales: cadena(o.materiales, 'materiales'), pasos: pasos, porque: cadena(o.porque, 'porque') };
  }
  /* Cada fila lleva el id de su criterio. Sin criterio o con uno ajeno a la actividad: lo toma si la actividad tiene uno solo; si tiene varios, queda '' («Sin criterio»).
     Las filas salen en `filas`; `faltan` son los criterios de la actividad que se han quedado sin ninguna fila. */
  function validarRubrica(o, criterios) {
    if (!Array.isArray(o.filas) || o.filas.length < 1 || o.filas.length > 12) throw new Error('filas');
    var claves = (criterios || []).map(clave), usados = {};
    var filas = o.filas.map(function (f) {
      if (!Array.isArray(f.celdas) || f.celdas.length !== 5) throw new Error('celdas');
      var peso = Number(f.peso), k = String(f.criterio == null ? '' : f.criterio).trim();
      if (claves.indexOf(k) < 0) k = claves.length === 1 ? claves[0] : '';
      if (k) usados[k] = 1;
      return { criterio: k, texto: cadena(f.texto, 'texto'), peso: isFinite(peso) && peso > 0 ? peso : 1, celdas: f.celdas.map(function (x) { return cadena(x, 'celda'); }) };
    });
    return { filas: filas, faltan: claves.filter(function (k) { return !usados[k]; }) };
  }

  /* La app de internet (https) pide las redacciones al servicio, con la sesión de Google y sin clave; la copia sin internet (file:) y las pruebas en http
     siguen con la clave de la carpeta. */
  var AVISAR_DESDE = 5; /* si quedan tantas o menos, se avisa tras redactar */
  var FRASES_SERVICIO = {
    sesion: 'Tu sesión ha caducado. Recarga la página y vuelve a entrar.',
    'no-invitado': 'Tu cuenta ya no está en la lista de invitados.',
    'sin-saldo': 'Las redacciones de Claude no están disponibles ahora mismo. Vuelve a intentarlo más tarde o escribe tú el texto.',
    ocupado: 'Claude está muy ocupado ahora mismo. Vuelve a intentarlo en un momento.'
  };
  function enServicio() { return !!(g.location && g.location.protocol === 'https:' && g.Servicio); }
  function fraseTope(tope) { return 'Has usado tus ' + tope + ' redacciones de este mes. El día 1 vuelves a tener ' + tope + '. Mientras tanto, puedes escribir tú el texto.'; }
  function fraseQuedan(n) { return 'Te quedan ' + n + (n === 1 ? ' redacción' : ' redacciones') + ' este mes.'; }
  function pulsacionNueva() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  /* Lo que cada botón de Claude pasa como «clave»: en el servicio, una marca con el identificador de esa pulsación (los reintentos y la rúbrica que sigue
     a una propuesta cuentan como una sola redacción); en la copia, la clave de la carpeta. */
  async function claveDe(carpeta) { return enServicio() ? { servicio: true, pulsacion: pulsacionNueva() } : leerClave(carpeta); }

  function avisoPasajero(texto) {
    if (typeof document === 'undefined' || !document.body) return;
    var viejo = document.getElementById('avisoQuedan'); if (viejo) viejo.remove();
    var e = document.createElement('div'); e.id = 'avisoQuedan'; e.className = 'aviso ok saldo-claude'; e.setAttribute('role', 'status'); e.textContent = texto;
    document.body.appendChild(e);
    setTimeout(function () { if (e.parentNode) e.remove(); }, 9000);
  }

  async function llamarServicio(marca, mensaje, ajustes) {
    var r = await g.Servicio.llamar('redactar', { pulsacion: marca.pulsacion, system: SISTEMA, messages: [{ role: 'user', content: mensaje }], max_tokens: (ajustes && ajustes.maxTokens) || 4000 }, ajustes && ajustes.fetch);
    if (r && r.ok) {
      var quedan = typeof r.tope === 'number' ? r.tope - r.redacciones : null;
      g.Servicio.recordarSaldo({ tope: r.tope, redacciones: r.redacciones });
      if (quedan !== null && quedan <= AVISAR_DESDE) avisoPasajero(fraseQuedan(Math.max(quedan, 0)));
      return r.texto;
    }
    var motivo = r && r.motivo;
    if (motivo === 'red' || !r) throw ErrorClaude('red', 'No he podido hablar con Claude. Mira si hay internet.');
    if (motivo === 'tope') throw ErrorClaude('tope', fraseTope(r.tope));
    if (motivo === 'sesion') g.Servicio.olvidar();
    throw ErrorClaude(motivo === 'sin-saldo' ? 'saldo' : 'servicio', FRASES_SERVICIO[motivo] || 'Claude no está respondiendo bien ahora mismo. Vuelve a intentarlo en un momento.');
  }

  /* Una llamada a la API. `ajustes.fetch` permite poner una API de mentira en las pruebas. */
  async function llamar(clave, mensaje, ajustes) {
    if (clave && clave.servicio) return llamarServicio(clave, mensaje, ajustes);
    if (!clave) throw ErrorClaude('sin-clave', 'Falta la clave de Claude. Pégala una vez en «Ajustes».');
    var f = (ajustes && ajustes.fetch) || g.fetch.bind(g), r;
    try {
      r = await f(URL_API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: MODELO, max_tokens: (ajustes && ajustes.maxTokens) || 4000, system: SISTEMA, messages: [{ role: 'user', content: mensaje }] }) });
    } catch (e) { throw ErrorClaude('red', 'No he podido hablar con Claude. Mira si hay internet (la red del colegio puede bloquearlo).'); }
    if (r.status === 401 || r.status === 403) throw ErrorClaude('clave', 'Claude no acepta la clave. Revísala en «Ajustes».');
    if (r.status === 429 || r.status === 529) throw ErrorClaude('ocupado', 'Claude está ocupado o se ha llegado al tope de gasto. Prueba dentro de un rato.');
    if (!r.ok) throw ErrorClaude('api', 'Claude ha dado un error (' + r.status + '). Prueba otra vez.');
    var d = await r.json();
    return (d.content || []).map(function (x) { return x.text || ''; }).join('');
  }

  /* Pide, valida y, si la respuesta llega mal, reintenta UNA vez. Si sigue mal, avisa sin tocar lo que Inma tenía escrito. */
  async function pedir(clave, mensaje, validar, ajustes) {
    for (var intento = 0; intento < 2; intento++) {
      var texto = await llamar(clave, mensaje, ajustes);
      try { return validar(trozoJSON(texto)); } catch (e) { /* respuesta mal formada: otro intento */ }
    }
    throw ErrorClaude('forma', 'Claude no ha contestado de forma que yo la entienda. Prueba otra vez; lo que escribiste sigue ahí.');
  }

  /* c: { area, curso, criterios: [{codigo, texto}], idea, anterior?, cambios? }.  `nombres`: los de los niños, solo para vigilar que no se cuele. */
  async function proponerActividad(clave, c, nombres, ajustes) {
    vigilarNombres([c.idea, c.cambios, c.anterior ? JSON.stringify(c.anterior) : ''].join(' '), nombres);
    return pedir(clave, pedirActividad(c), validarActividad, ajustes);
  }
  /* Devuelve la lista de filas (cada una con su `criterio`). Si algún criterio se queda sin filas se reintenta una vez; si sigue faltando,
     la lista se devuelve igual con `faltan` (propiedad no enumerable) para que la pantalla la abra sin guardar y con aviso. */
  async function proponerRubrica(laClave, c, nombres, ajustes) {
    vigilarNombres([c.actividad.titulo, c.actividad.producto, c.actividad.materiales].concat(c.actividad.pasos).join(' '), nombres);
    var ultima = null;
    for (var intento = 0; intento < 2; intento++) {
      var texto = await llamar(laClave, pedirRubrica(c), ajustes), v;
      try { v = validarRubrica(trozoJSON(texto), c.criterios); } catch (e) { continue; }
      ultima = v;
      if (!v.faltan.length) break;
    }
    if (!ultima) throw ErrorClaude('forma', 'Claude no ha contestado de forma que yo la entienda. Prueba otra vez; lo que escribiste sigue ahí.');
    Object.defineProperty(ultima.filas, 'faltan', { value: ultima.faltan, enumerable: false });
    return ultima.filas;
  }

  /* Situación de Aprendizaje. c: { curso, areas: [{id, nombre}], criterios: [{id, area, codigo, texto}], idea, anterior?, cambios? }.
     Los criterios que Claude puede elegir son SOLO los de la lista; lo que no esté en ella se descarta. */
  var FORMA_SITUACION = '{"titulo": "…", "semanas": número (1 a 12), "sesiones": número total de sesiones (1 a 40), "producto": "producto final", "recursos": "materiales y recursos", ' +
    '"criterios": ["id exacto de la lista"], "actividades": [{"titulo": "…", "area": "id de área de la lista", "sesiones": número, "criterios": ["id exacto de la lista"]}]}. ' +
    'Entre 3 y 8 actividades. Cada actividad puede evaluar uno o varios criterios (también de otra área), pero al menos uno tiene que ser de su propia área. Usa solo ids de criterio de la lista, tal cual están escritos.';
  function pedirSituacion(c) {
    var m = 'Curso: ' + c.curso + '.º de Primaria\nÁreas de la maestra en este grupo: ' + c.areas.map(function (a) { return a.id + ' (' + a.nombre + ')'; }).join(', ') +
      '\nCriterios de evaluación oficiales que puedes elegir (id: texto literal):\n' + c.criterios.map(function (k) { return '- ' + k.id + ': ' + k.texto; }).join('\n') +
      '\n\nReto de la maestra: ' + c.idea + '\nPropón una Situación de Aprendizaje: un reto de la vida real con varias actividades, que puede mezclar áreas, y un producto final.';
    if (c.anterior && c.cambios) m += '\n\nPropuesta anterior:\n' + JSON.stringify(c.anterior) + '\n\nCambios que pide la maestra: ' + c.cambios + '\nDevuelve la propuesta completa con esos cambios.';
    return m + '\n\nDevuelve este JSON: ' + FORMA_SITUACION;
  }
  /* Devuelve la situación y, aparte, los criterios inventados descartados (`descartados`) y las actividades quitadas por quedarse sin criterio de su área (`actividadesDescartadas`).
     Cada actividad trae `criterios` (lista; se acepta también el `criterio` suelto de antes) y `criterio` = el primero. */
  function validarSituacion(o, c) {
    var validos = {}, areas = {}, descartados = [], quitadas = [];
    c.criterios.forEach(function (k) { validos[k.id] = k; }); c.areas.forEach(function (a) { areas[a.id] = 1; });
    var limpio = function (id) {
      id = String(id == null ? '' : id).trim();
      if (validos[id]) return id;
      if (id) descartados.push(id);
      return '';
    };
    var semanas = Math.round(Number(o.semanas)), sesiones = Math.round(Number(o.sesiones));
    if (!(semanas >= 1 && semanas <= 12) || !(sesiones >= 1 && sesiones <= 40)) throw new Error('duración');
    if (!Array.isArray(o.criterios) || !Array.isArray(o.actividades) || !o.actividades.length) throw new Error('actividades');
    var criterios = [];
    o.criterios.forEach(function (id) { id = limpio(id); if (id && criterios.indexOf(id) < 0) criterios.push(id); });
    var acts = [];
    o.actividades.slice(0, 12).forEach(function (a) {
      var lista = Array.isArray(a.criterios) ? a.criterios : (a.criterio != null ? [a.criterio] : []), buenos = [], n = Math.round(Number(a.sesiones));
      lista.forEach(function (id) { id = limpio(id); if (id && buenos.indexOf(id) < 0) buenos.push(id); });
      var titulo = cadena(a.titulo, 'título de actividad');
      var area = areas[a.area] ? a.area : (buenos.length ? validos[buenos[0]].area : '');
      /* La actividad tiene que evaluar al menos un criterio de su propia área; si no, se quita entera. */
      var propios = buenos.filter(function (id) { return validos[id].area === area; });
      if (!area || !propios.length) { quitadas.push(titulo); return; }
      buenos = propios.concat(buenos.filter(function (id) { return propios.indexOf(id) < 0; }));
      buenos.forEach(function (id) { if (criterios.indexOf(id) < 0) criterios.push(id); });
      acts.push({ titulo: titulo, area: area, sesiones: n >= 1 && n <= 40 ? n : 1, criterios: buenos, criterio: buenos[0] });
    });
    if (!acts.length || !criterios.length) throw new Error('criterios');
    return { situacion: { titulo: cadena(o.titulo, 'título'), semanas: semanas, sesiones: sesiones, producto: cadena(o.producto, 'producto'),
      recursos: typeof o.recursos === 'string' ? o.recursos.trim() : '', criterios: criterios, actividades: acts }, descartados: descartados, actividadesDescartadas: quitadas };
  }
  async function proponerSituacion(clave, c, nombres, ajustes) {
    vigilarNombres([c.idea, c.cambios, c.anterior ? JSON.stringify(c.anterior) : ''].join(' '), nombres);
    return pedir(clave, pedirSituacion(c), function (o) { return validarSituacion(o, c); }, ajustes);
  }

  var api = { MODELO: MODELO, enServicio: enServicio, claveDe: claveDe, leerClave: leerClave, guardarClave: guardarClave, quitarClave: quitarClave, vigilarNombres: vigilarNombres,
    proponerActividad: proponerActividad, proponerRubrica: proponerRubrica, proponerSituacion: proponerSituacion,
    pedir: pedir, ErrorClaude: ErrorClaude, trozoJSON: trozoJSON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.RubClaude = api;
})(typeof window !== 'undefined' ? window : globalThis);
