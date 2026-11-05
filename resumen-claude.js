/* «Resumir con Claude» un acta o unas notas en un bloque de clase del acta de ciclo (fila 106). Sin pantalla ni carpeta: se prueba con node --test.
   Los nombres van tapados en iniciales («[P.R.G.]») y se pueden cambiar a mano antes de enviar; al volver, cada marca recupera su nombre.
   - `trocear(texto, todos)`: el texto partido en palabras, con las que parecen nombres ya tapadas.
   - `armar(trozos)`: lo que sale hacia Claude (solo iniciales) y qué había debajo de cada marca.
   - `resumir(clave, trozos, clase, opciones)`: la llamada; devuelve el resumen con los nombres de nuevo en su sitio. */
(function (g) {
  'use strict';
  var A = g.Alumnado, AC = g.AlumnadoClaude;
  var PALABRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;
  /* Palabras que empiezan frase sin ser nombre: «En Lengua» no es una persona. */
  var DE_FRASE = ['en', 'el', 'la', 'los', 'las', 'se', 'un', 'una', 'y', 'de', 'del', 'con', 'por', 'para', 'a', 'al', 'es', 'son', 'hay', 'si', 'no', 'lo'];

  var INSTRUCCIONES = [
    'Eres quien prepara, para la coordinadora de un equipo de ciclo de un colegio público de Primaria de Andalucía (España), el resumen de la sesión de evaluación de una clase.',
    'Recibes un JSON con «clase» y «acta»: el acta o las notas que escribió la tutora de esa clase. Puede venir con errores de lectura, porque a veces se ha leído de una foto.',
    'Escribe un resumen de 4 a 8 líneas para el equipo de ciclo: el nivel del grupo en cada área (con su porcentaje si lo hay) y el alumnado con medidas.',
    'Reglas:',
    '- Usa solo lo que dice el texto: no inventes cifras, nombres ni acuerdos. Si algo no se entiende, déjalo fuera.',
    '- Estilo formal y sencillo, una idea por línea, sin título, sin viñetas y sin formato.',
    '- Las personas aparecen como marcas entre corchetes, por ejemplo [M.S.P.] o [L.G.R.2]. Copia cada marca exactamente igual, sin cambiarla ni añadirle nada, y no las uses para nada más.',
    'Responde SOLO con el texto del resumen, sin nada más.'
  ].join('\n');

  function clave(t) { return A.normalizar(t).replace(/\s+/g, ' ').trim(); }

  /* El texto -> [{ t, palabra, tapado }]. Un nombre de varias palabras («Pablo Ruiz Gil») es un solo trozo. Se tapan los nombres de la lista, las secuencias
     que parecen un nombre de persona (anonimizar.js) y los nombres sueltos a media frase (evaluacion-ciclo.js). Un nombre suelto al empezar frase puede escaparse. */
  function trocear(texto, todos) {
    var t = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n'), palabras = [], m, i, j;
    PALABRA.lastIndex = 0;
    while ((m = PALABRA.exec(t))) palabras.push({ t: m[0], desde: m.index, hasta: m.index + m[0].length, n: A.normalizar(m[0]) });
    var tapadas = g.Anonimizar.crear(todos).reversible(t).marcas, secuencias = [];
    Object.keys(tapadas).forEach(function (k) { secuencias.push(clave(tapadas[k]).split(' ')); });
    secuencias.sort(function (a, b) { return b.length - a.length; });
    var sueltos = {};
    g.EvaluacionCiclo.nombresSueltos([{ texto: t }]).forEach(function (w) { sueltos[A.normalizar(w)] = true; });

    var res = [], pos = 0;
    for (i = 0; i < palabras.length;) {
      var largo = 0;
      for (j = 0; j < secuencias.length && !largo; j++) {
        var s = secuencias[j], ok = i + s.length <= palabras.length;
        for (var k = 0; ok && k < s.length; k++) {
          if (palabras[i + k].n !== s[k]) ok = false;
          else if (k > 0 && !/^\s+$/.test(t.slice(palabras[i + k - 1].hasta, palabras[i + k].desde))) ok = false;
        }
        if (ok && DE_FRASE.indexOf(palabras[i].n) < 0) largo = s.length;
      }
      var ult = palabras[i + (largo || 1) - 1];
      if (!largo) {
        if (palabras[i].desde > pos) res.push({ t: t.slice(pos, palabras[i].desde), palabra: false, tapado: false });
        res.push({ t: t.slice(palabras[i].desde, ult.hasta), palabra: true, tapado: !!sueltos[palabras[i].n] });
        pos = ult.hasta; i++; continue;
      }
      /* Una secuencia puede juntar a dos personas con «y» («Pablo Ruiz Gil y Pedro Ramos»): se parte, y los «de» de delante se quedan fuera. */
      var grupos = [], actual = [];
      palabras.slice(i, i + largo).forEach(function (w) { if (w.n === 'y') { if (actual.length) grupos.push(actual); actual = []; } else actual.push(w); });
      if (actual.length) grupos.push(actual);
      grupos.forEach(function (gr) {
        while (gr.length && A.PARTICULAS.indexOf(gr[0].n) >= 0) gr = gr.slice(1);
        if (!gr.length) return;
        if (gr[0].desde > pos) res.push({ t: t.slice(pos, gr[0].desde), palabra: false, tapado: false });
        res.push({ t: t.slice(gr[0].desde, gr[gr.length - 1].hasta), palabra: true, tapado: true });
        pos = gr[gr.length - 1].hasta;
      });
      i += largo;
    }
    if (pos < t.length) res.push({ t: t.slice(pos), palabra: false, tapado: false });
    return res;
  }

  /* Los trozos -> { texto (lo que sale hacia Claude), marcas: { '[P.R.G.]': 'Pablo Ruiz Gil' } }. El mismo nombre lleva siempre la misma marca. */
  function armar(trozos) {
    var marcas = {}, porNombre = {}, usadas = {}, texto = '';
    trozos.forEach(function (x) {
      if (!x.tapado) { texto += x.t; return; }
      var k = clave(x.t), m = porNombre[k];
      if (!m) {
        var base = AC.iniciales(x.t) || 'X.', n = usadas[base] = (usadas[base] || 0) + 1;
        m = porNombre[k] = '[' + base + (n > 1 ? n : '') + ']'; marcas[m] = x.t;
      }
      texto += m;
    });
    return { texto: texto, marcas: marcas };
  }

  function cuerpo(clase, enviado) {
    return {
      model: g.Claude.MODELO, max_tokens: 1500, system: INSTRUCCIONES,
      messages: [{ role: 'user', content: JSON.stringify({ clase: clase, acta: enviado }) }]
    };
  }

  /* El resumen de Claude con los nombres de vuelta: { texto, aviso }. Si trae una marca que no se envió se pide otra vez; si sigue mal, se deja y se avisa. */
  async function resumir(claveClaude, trozos, clase, opciones) {
    opciones = opciones || {};
    if (!claveClaude) { var f0 = new Error(g.Claude.FRASE_SIN_CLAVE); f0.tipo = 'clave'; throw f0; }
    var env = armar(trozos), validas = Object.keys(env.marcas), texto = '', bien = false;
    if (!String(env.texto).trim()) { var v = new Error('No hay texto que resumir.'); v.tipo = 'vacio'; throw v; }
    for (var intento = 0; intento < 2 && !bien; intento++) {
      texto = String(await g.Claude.llamar(claveClaude, cuerpo(clase, env.texto), opciones.buscar)).trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
      bien = AC.marcasEn(texto).every(function (m) { return validas.indexOf(m) >= 0; });
    }
    if (!texto) { var f = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.tipo = 'formato'; throw f; }
    return { texto: AC.restaurar(texto, env.marcas), aviso: bien ? '' : AC.AVISO_NOMBRES };
  }

  g.ResumenClaude = { INSTRUCCIONES: INSTRUCCIONES, trocear: trocear, armar: armar, cuerpo: cuerpo, resumir: resumir };
})(typeof window !== 'undefined' ? window : globalThis);
