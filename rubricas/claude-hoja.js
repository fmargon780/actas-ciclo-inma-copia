/* Claude propone la hoja del alumno (`proponerHoja`) y la cambia cuando Inma lo pide (`cambiarHoja`). Usa la llamada de claude.js.
   A Claude van la actividad, sus criterios, las filas de la rúbrica (id y texto) y, al cambiar, la hoja tal como está; NUNCA nombres de alumnos. */
(function (g) {
  'use strict';
  var Cl = typeof module !== 'undefined' && module.exports ? require('./claude.js') : g.RubClaude;
  var H = typeof module !== 'undefined' && module.exports ? require('./hoja.js') : g.Hoja;

  var FORMA = '{"ejercicios": [{"tipo": "uno de los once", "enunciado": "…", "contenido": {…}, "solucion": …, "fila": "id de una fila de la rúbrica, o vacío"}]}. ' +
    'Los once tipos, con su "contenido" y su "solucion" (los números empiezan en 1): ' +
    '"elegir" {"opciones": [2 a 4 textos]} → número de la opción correcta; ' +
    '"vf" (verdadero o falso) {"frases": [textos]} → lista de true/false, una por frase; ' +
    '"huecos" {"texto": "frase con huecos escritos como ____"} → lista con el texto de cada hueco; ' +
    '"unir" {"izq": [textos], "der": [textos]} → lista con el número de "der" que corresponde a cada "izq"; ' +
    '"ordenar" {"elementos": [textos]} → lista con el número de orden de cada elemento; ' +
    '"rodear" (rodear, subrayar o colorear, solo con palabras o elementos escritos, nunca imágenes) {"elementos": [textos]} → lista con los números de los elementos que hay que rodear; ' +
    '"corta" {"lineas": 1 a 3} → respuesta orientativa en texto; ' +
    '"problema" {} → {"datos": "…", "operacion": "…", "solucion": "…"}; ' +
    '"dibujo" (representar con un dibujo; para Matemáticas manipulativas) {"recta": null o {"marcas": ["0", "10", "20"]}, "tabla": null o {"filas": n, "columnas": n}} → respuesta orientativa en texto; ' +
    '"musica" {"modo": "pentagrama" o "ritmo", "figuras": lista con "negra", "corchea", "parcorcheas", "blanca" o "silencio" (las que ya van puestas; vacía si el niño lo escribe todo)} → respuesta orientativa en texto; ' +
    '"libre" {"lineas": 1 a 10} → respuesta orientativa en texto, para lo que no encaje en los otros diez.';

  function contextoHoja(c) {
    var m = 'Área: ' + c.area + '\nCurso: ' + c.curso + '.º de Primaria\nActividad: ' + c.actividad.titulo + '. Producto final: ' + c.actividad.producto + '. Materiales: ' + c.actividad.materiales +
      '\nPasos:\n' + c.actividad.pasos.map(function (p, i) { return (i + 1) + '. ' + p; }).join('\n') +
      '\nCriterio(s) de evaluación (texto oficial):\n' + c.criterios.map(function (k) { return '- ' + (k.codigo || k.id) + ': ' + k.texto; }).join('\n');
    m += c.filas.length ? '\nFilas de la rúbrica de la actividad (id: qué se mira):\n' + c.filas.map(function (f) { return '- ' + f.id + ': ' + f.texto; }).join('\n') +
      '\nHaz los ejercicios pensando en esas filas y pon en "fila" el id de la fila a la que ayuda cada ejercicio.' : '\nLa actividad aún no tiene rúbrica: deja "fila" vacío.';
    return m;
  }
  var PIDE = '\nEs una hoja para niños de 3.º-4.º de Primaria: enunciados cortos y claros, con espacio para escribir. La maestra prevé que ocupe ' + 'CARAS' + '.';
  function caras(n) { return n + (n === 1 ? ' cara' : ' caras') + ' de folio'; }

  /* La versión adaptada: para los niños que necesitan una hoja más sencilla. Es una hoja más, no la de un niño concreto. */
  var PIDE_ADAPTADA = '\nEsta es la VERSIÓN ADAPTADA de la hoja, para los niños que necesitan una más sencilla: menos ejercicios que la hoja normal, enunciados más cortos y fáciles, ' +
    'ejercicios de los mismos tipos o más sencillos (elegir, verdadero o falso, unir, huecos) y mucho espacio para escribir. Mantén en "fila" la fila de la rúbrica a la que ayuda cada ejercicio, cuando aplique.';

  function validar(o, c) { var h = H.normalizarHoja(o, c.actividad.id, c.filas.map(function (f) { return f.id; })); h.porIA = true; h.caras = c.caras; return h; }
  function vigilar(c, nombres, extra) {
    Cl.vigilarNombres([c.actividad.titulo, c.actividad.producto, c.actividad.materiales, extra || ''].concat(c.actividad.pasos).join(' '), nombres);
  }
  /* La adaptada tal como la guarda la hoja: {porIA, caras, ejercicios}. Sin ejercicios no vale (lanza, y se reintenta). */
  function validarAdaptada(o, c) {
    var a = H.normalizarAdaptada(o, c.filas.map(function (f) { return f.id; }));
    if (!a) throw new Error('ejercicios');
    a.porIA = true; a.caras = c.caras; return a;
  }
  var AJ = function (a) { return Object.assign({ maxTokens: 8000 }, a || {}); };

  /* c: { area, curso, actividad: {id, titulo, producto, materiales, pasos}, criterios: [{id, codigo, texto}], filas: [{id, texto}], caras, idea? } → hoja ya con su forma fija. */
  async function proponerHoja(clave, c, nombres, ajustes) {
    vigilar(c, nombres, c.idea);
    var m = contextoHoja(c) + PIDE.replace('CARAS', caras(c.caras)) + (c.idea ? '\nLa maestra pide además: ' + c.idea : '') + '\n\nCrea la hoja del alumno. Devuelve este JSON: ' + FORMA;
    return Cl.pedir(clave, m, function (o) { return validar(o, c); }, AJ(ajustes));
  }
  /* c además: { hoja: la hoja tal como está ahora (con los cambios a mano), cambios: lo que pide la maestra }. Devuelve la hoja entera. */
  async function cambiarHoja(clave, c, nombres, ajustes) {
    var actual = JSON.stringify({ ejercicios: c.hoja.ejercicios });
    vigilar(c, nombres, c.cambios + ' ' + actual);
    var m = contextoHoja(c) + PIDE.replace('CARAS', caras(c.caras)) + (c.adaptada ? PIDE_ADAPTADA : '') + '\n\nHoja actual (con los retoques de la maestra):\n' + actual + '\n\nCambios que pide la maestra: ' + c.cambios +
      '\nNo toques lo que no te pide. Devuelve la hoja entera ya cambiada con este JSON: ' + FORMA;
    return Cl.pedir(clave, m, function (o) { return validar(o, c); }, AJ(ajustes));
  }

  /* c: como en proponerHoja, más { hoja: la hoja normal tal como está } (sin nombres). Devuelve la adaptada: {porIA, caras, ejercicios}. */
  async function proponerAdaptada(clave, c, nombres, ajustes) {
    var normal = JSON.stringify({ ejercicios: c.hoja.ejercicios });
    vigilar(c, nombres, normal);
    var m = contextoHoja(c) + PIDE.replace('CARAS', caras(c.caras)) + PIDE_ADAPTADA + '\n\nHoja normal de la que partes:\n' + normal + '\n\nCrea la versión adaptada. Devuelve este JSON: ' + FORMA;
    return Cl.pedir(clave, m, function (o) { return validarAdaptada(o, c); }, AJ(ajustes));
  }

  var api = { proponerHoja: proponerHoja, cambiarHoja: cambiarHoja, proponerAdaptada: proponerAdaptada, aAdaptada: function (hoja) { return { porIA: true, caras: hoja.caras, ejercicios: hoja.ejercicios }; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.ClaudeHoja = api;
})(typeof window !== 'undefined' ? window : globalThis);
