/* La hoja del alumno, sin pantalla: los once tipos de ejercicio, su forma fija, guardar y leer, soluciones legibles y avisos de caras.
   Hoja: { actividad, porIA, caras, ejercicios: [{ id, tipo, enunciado, contenido, solucion, fila? }], adaptada: null | {porIA, caras, ejercicios} }, en hojas/<actividad>.json.
   `adaptada` es la versión sencilla de la misma actividad (menos ejercicios, letra grande), con la misma forma de ejercicios.
   Contenido y solución por tipo (los números empiezan en 1):
     elegir   {opciones:[2 a 4]}                         → número de la opción correcta
     vf       {frases:[…]}                               → [true|false por frase]
     huecos   {texto con «____»}                         → [texto de cada hueco]
     unir     {izq:[…], der:[…]}                         → [número de der que corresponde a cada izq]
     ordenar  {elementos:[…]}                            → [número de orden de cada elemento]
     rodear   {elementos:[…]}                            → [números de los elementos a rodear]
     corta    {lineas:1-3}                               → texto
     problema {}                                         → {datos, operacion, solucion}
     dibujo   {recta:{marcas:[…]}|null, tabla:{filas,columnas}|null} → texto
     musica   {modo:'pentagrama'|'ritmo', figuras:[…]}   → texto
     libre    {lineas:1-10}                              → texto */
(function (g) {
  'use strict';

  var TIPOS = [
    { id: 'elegir', nombre: 'Elegir la respuesta correcta' }, { id: 'vf', nombre: 'Verdadero o falso' }, { id: 'huecos', nombre: 'Completar huecos' },
    { id: 'unir', nombre: 'Unir con flechas' }, { id: 'ordenar', nombre: 'Ordenar' }, { id: 'rodear', nombre: 'Rodear o colorear' },
    { id: 'corta', nombre: 'Respuesta corta' }, { id: 'problema', nombre: 'Problema' }, { id: 'dibujo', nombre: 'Representar con un dibujo' },
    { id: 'musica', nombre: 'Pentagrama o línea de ritmo' }, { id: 'libre', nombre: 'Ejercicio libre' }
  ];
  var FIGURAS = [{ id: 'negra', nombre: 'Negra' }, { id: 'corchea', nombre: 'Corchea' }, { id: 'parcorcheas', nombre: 'Par de corcheas' }, { id: 'blanca', nombre: 'Blanca' }, { id: 'silencio', nombre: 'Silencio de negra' }];
  var COLEGIO = ''; /* sin colegio puesto de antemano: lo escribe cada docente en Ajustes */
  var MAX_EJERCICIOS = 30;

  function nuevoId() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function texto(x) { return typeof x === 'string' ? x.trim() : (typeof x === 'number' ? String(x) : ''); }
  /* Una lista de textos; si llega un texto con saltos de línea, cada línea es un elemento. */
  function lista(x) {
    if (typeof x === 'string') x = x.split('\n');
    return Array.isArray(x) ? x.map(function (t) { return texto(t); }) : [];
  }
  function entero(x, min, max, por) { var n = Math.round(Number(x)); return isFinite(n) && n >= min && n <= max ? n : por; }
  function ids(l) { return l.map(function (t) { return t.id; }); }
  function esV(v) { return v === true || (typeof v === 'string' && /^(v|verdadero|true|sí|si)/i.test(v.trim())); }
  function huecosDe(t) { return (t.match(/_{3,}/g) || []).length; }

  /* Deja un ejercicio con su forma fija, venga como venga. Tipo desconocido → libre. `filasIds`: filas de la rúbrica (si se da, la `fila` que no esté se quita). */
  function normalizarEjercicio(o, filasIds) {
    o = o && typeof o === 'object' ? o : {};
    var tipo = ids(TIPOS).indexOf(o.tipo) >= 0 ? o.tipo : 'libre';
    var c = o.contenido && typeof o.contenido === 'object' ? o.contenido : {}, s = o.solucion;
    var e = { id: typeof o.id === 'string' && o.id ? o.id : nuevoId(), tipo: tipo, enunciado: texto(o.enunciado), contenido: {}, solucion: '' };
    var arr = Array.isArray(s) ? s : [];
    if (tipo === 'elegir') {
      var ops = lista(c.opciones).slice(0, 4); while (ops.length < 2) ops.push('');
      e.contenido = { opciones: ops }; e.solucion = entero(s, 1, ops.length, 1);
    } else if (tipo === 'vf') {
      var fr = lista(c.frases); if (!fr.length) fr = [''];
      e.contenido = { frases: fr }; e.solucion = fr.map(function (_, i) { return esV(arr[i]); });
    } else if (tipo === 'huecos') {
      var tx = texto(c.texto); e.contenido = { texto: tx };
      e.solucion = []; for (var i = 0; i < huecosDe(tx); i++) e.solucion.push(texto(arr[i]));
    } else if (tipo === 'unir') {
      var izq = lista(c.izq), der = lista(c.der); if (!izq.length) izq = ['']; if (!der.length) der = [''];
      e.contenido = { izq: izq, der: der }; e.solucion = izq.map(function (_, k) { return entero(arr[k], 1, der.length, Math.min(k + 1, der.length)); });
    } else if (tipo === 'ordenar') {
      var el = lista(c.elementos); if (!el.length) el = [''];
      e.contenido = { elementos: el }; e.solucion = el.map(function (_, k) { return entero(arr[k], 1, el.length, k + 1); });
    } else if (tipo === 'rodear') {
      var el2 = lista(c.elementos); if (!el2.length) el2 = [''];
      e.contenido = { elementos: el2 };
      e.solucion = arr.map(Number).filter(function (n, k, a) { return Number.isInteger(n) && n >= 1 && n <= el2.length && a.indexOf(n) === k; }).sort(function (a, b) { return a - b; });
    } else if (tipo === 'problema') {
      var p = s && typeof s === 'object' && !Array.isArray(s) ? s : { solucion: s };
      e.solucion = { datos: texto(p.datos), operacion: texto(p.operacion), solucion: texto(p.solucion) };
    } else if (tipo === 'dibujo') {
      var marcas = c.recta && typeof c.recta === 'object' ? lista(c.recta.marcas).slice(0, 12) : [];
      var tb = c.tabla && typeof c.tabla === 'object' ? c.tabla : null;
      e.contenido = { recta: marcas.length >= 2 ? { marcas: marcas } : null,
        tabla: tb && entero(tb.filas, 1, 12, 0) && entero(tb.columnas, 1, 8, 0) ? { filas: entero(tb.filas, 1, 12, 1), columnas: entero(tb.columnas, 1, 8, 1) } : null };
      e.solucion = texto(s);
    } else if (tipo === 'musica') {
      e.contenido = { modo: c.modo === 'ritmo' ? 'ritmo' : 'pentagrama', figuras: lista(c.figuras).filter(function (f) { return ids(FIGURAS).indexOf(f) >= 0; }).slice(0, 16) };
      e.solucion = texto(s);
    } else if (tipo === 'corta') { e.contenido = { lineas: entero(c.lineas, 1, 3, 2) }; e.solucion = texto(s); }
    else { e.contenido = { lineas: entero(c.lineas, 1, 10, 4) }; e.solucion = texto(s); }
    var f = typeof o.fila === 'string' ? o.fila.trim() : '';
    if (f && (!filasIds || filasIds.indexOf(f) >= 0)) e.fila = f;
    return e;
  }
  /* La versión adaptada: {porIA, caras, ejercicios}. Si no está o viene sin ejercicios, null. */
  function normalizarAdaptada(a, filasIds) {
    if (!a || !Array.isArray(a.ejercicios) || !a.ejercicios.length || a.ejercicios.length > MAX_EJERCICIOS) return null;
    return { porIA: !!a.porIA, caras: entero(a.caras, 1, 10, 1), ejercicios: a.ejercicios.map(function (e) { return normalizarEjercicio(e, filasIds); }) };
  }
  /* Lo mismo para la hoja entera. Sin ejercicios no vale (lanza). */
  function normalizarHoja(o, actividad, filasIds) {
    if (!o || !Array.isArray(o.ejercicios) || !o.ejercicios.length || o.ejercicios.length > MAX_EJERCICIOS) throw new Error('ejercicios');
    return { actividad: actividad, porIA: !!o.porIA, caras: entero(o.caras, 1, 10, 1),
      ejercicios: o.ejercicios.map(function (e) { return normalizarEjercicio(e, filasIds); }), adaptada: normalizarAdaptada(o.adaptada, filasIds) };
  }
  function ejercicioNuevo(tipo) { return normalizarEjercicio({ tipo: tipo, enunciado: '' }); }
  function hojaNueva(actividad, caras) { return { actividad: actividad, porIA: false, caras: caras || 1, ejercicios: [ejercicioNuevo('libre')], adaptada: null }; }
  /* Cambia el tipo de un ejercicio: queda el enunciado y la fila; lo demás empieza vacío. */
  function cambiarTipo(e, tipo) { return normalizarEjercicio({ tipo: tipo, enunciado: e.enunciado, id: e.id, fila: e.fila }); }

  async function leer(carpeta, actividadId) {
    var h = await carpeta.leerJSON('hojas/' + actividadId + '.json');
    return h && Array.isArray(h.ejercicios) && h.ejercicios.length ? normalizarHoja(h, actividadId, null) : null;
  }
  function guardar(carpeta, hoja) { return carpeta.escribirJSON('hojas/' + hoja.actividad + '.json', hoja); }

  /* La solución como texto para editarla a mano, y vuelta. */
  function solucionATexto(e) {
    var s = e.solucion;
    if (e.tipo === 'elegir') return String(s);
    if (e.tipo === 'vf') return s.map(function (v) { return v ? 'V' : 'F'; }).join('\n');
    if (e.tipo === 'huecos') return s.join('\n');
    if (e.tipo === 'unir' || e.tipo === 'ordenar') return s.join('\n');
    if (e.tipo === 'rodear') return s.join(', ');
    if (e.tipo === 'problema') return [s.datos, s.operacion, s.solucion].join('\n');
    return s;
  }
  function textoASolucion(e, t) {
    var l = String(t).split('\n'), raw = t;
    if (e.tipo === 'vf' || e.tipo === 'huecos' || e.tipo === 'unir' || e.tipo === 'ordenar') raw = l;
    else if (e.tipo === 'rodear') raw = String(t).split(/[,\s]+/).filter(Boolean);
    else if (e.tipo === 'problema') raw = { datos: l[0] || '', operacion: l[1] || '', solucion: l.slice(2).join(' ') };
    return normalizarEjercicio({ id: e.id, tipo: e.tipo, enunciado: e.enunciado, contenido: e.contenido, solucion: raw }).solucion;
  }
  /* La solución para la hoja de soluciones, en líneas legibles. Los ejercicios abiertos sin respuesta dicen «Respuesta abierta». */
  function solucionLegible(e) {
    var s = e.solucion, c = e.contenido, f = function (l, i) { return l[i - 1] || ''; };
    if (e.tipo === 'elegir') return 'Opción ' + s + (f(c.opciones, s) ? ': ' + f(c.opciones, s) : '');
    if (e.tipo === 'vf') return c.frases.map(function (fr, i) { return (i + 1) + '. ' + (s[i] ? 'Verdadero' : 'Falso'); }).join('\n');
    if (e.tipo === 'huecos') return s.length ? s.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n') : 'Sin huecos';
    if (e.tipo === 'unir') return c.izq.map(function (x, i) { return x + ' → ' + f(c.der, s[i]); }).join('\n');
    if (e.tipo === 'ordenar') return c.elementos.map(function (x, i) { return s[i] + '. ' + x; }).slice().sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); }).join('\n');
    if (e.tipo === 'rodear') return s.length ? s.map(function (n) { return f(c.elementos, n); }).join(', ') : 'Ninguno';
    if (e.tipo === 'problema') return ['Datos: ' + s.datos, 'Operación: ' + s.operacion, 'Solución: ' + s.solucion].join('\n');
    return s || 'Respuesta abierta';
  }

  /* Caras que ocupa la hoja. `alturas`: alto de cada bloque (cabecera y ejercicios) y `alto`: lo que cabe en una cara.
     Un bloque no se parte: si no cabe en lo que queda de la cara, pasa a la siguiente (como al imprimir). */
  function paginar(alturas, alto) {
    var y = 0;
    alturas.forEach(function (h) {
      var resto = y % alto;
      if (resto > 0.5 && h <= alto && resto + h > alto + 0.5) y += alto - resto;
      y += h;
    });
    var caras = Math.max(1, Math.ceil(y / alto - 1e-6));
    return { caras: caras, ocupacionUltima: Math.min(1, (y - (caras - 1) * alto) / alto) };
  }
  function textoCaras(medida, previstas) {
    var c = function (n) { return n + (n === 1 ? ' cara' : ' caras'); };
    return 'Ocupa ' + c(medida.caras) + ' de ' + previstas + (previstas === 1 ? ' prevista' : ' previstas');
  }
  /* Avisos solo informativos: nunca impiden guardar ni imprimir. */
  function avisosCaras(medida, previstas) {
    var out = [];
    if (medida.caras > previstas) out.push('Tenías prevista una prueba de ' + previstas + (previstas === 1 ? ' cara' : ' caras') + ' y ya ocupa ' + medida.caras);
    if (medida.caras >= 2 && medida.ocupacionUltima < 0.5) out.push('La cara ' + medida.caras + ' está casi vacía');
    return out;
  }

  var api = { TIPOS: TIPOS, FIGURAS: FIGURAS, COLEGIO: COLEGIO, MAX_EJERCICIOS: MAX_EJERCICIOS, normalizarEjercicio: normalizarEjercicio, normalizarHoja: normalizarHoja, normalizarAdaptada: normalizarAdaptada,
    ejercicioNuevo: ejercicioNuevo, hojaNueva: hojaNueva, cambiarTipo: cambiarTipo, leer: leer, guardar: guardar, solucionATexto: solucionATexto, textoASolucion: textoASolucion,
    solucionLegible: solucionLegible, paginar: paginar, textoCaras: textoCaras, avisosCaras: avisosCaras, huecosDe: huecosDe, nuevoId: nuevoId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.Hoja = api;
})(typeof window !== 'undefined' ? window : globalThis);
