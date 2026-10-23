/* Claude redacta el acta de evaluación (fila 59): las cinco cajas de Séneca, el anexo I-IV y el resumen para el ciclo, en una sola llamada.
   A Claude no viaja ningún nombre: todo el alumnado va como iniciales entre corchetes (alumnado-claude.js) y al volver las marcas vuelven a ser nombres.
   Toda la forma de pedirlo está aquí (`INSTRUCCIONES` y `cuerpo`), para que el estilo de redacción (tema 58) se añada en `opciones.estilo`.
   Sin pantalla: se prueba con node --test con un `buscar` falso. */
(function (g) {
  'use strict';
  var A = g.Alumnado, AC = g.AlumnadoClaude, E = g.Evaluacion;

  var INSTRUCCIONES = [
    'Eres quien redacta, para la maestra tutora de una clase de un colegio público de Primaria de Andalucía (España), el acta de una sesión de evaluación: las cinco cajas de texto que se pegan en Séneca, el anexo que se adjunta y un resumen para el equipo de ciclo.',
    'Recibes un JSON con «sesion» (inicial, primera, segunda o final), «clase», «composicion» (n.º de alumnas y de alumnos, si la maestra lo ha puesto) y las notas cortas de la maestra: «areas» (cada una con «nombre», «porcentajeConDificultades» si lo hay y «notas»), «alumnado» (una entrada por alumno con algo apuntado, con «notas» que empiezan por su marca), «orientacion», «observaciones», «conclusiones» y, solo en la sesión inicial, «informesCursoAnterior». Solo vienen las partes con algo escrito.',
    'Responde con tres cosas: «seneca» (una lista de exactamente 5 textos), «anexo» y «resumenCiclo».',
    '«seneca» son las cajas de Séneca, en este orden: 1. Acuerdos y decisiones de carácter general para el grupo (un párrafo por área: nivel del grupo, porcentaje de dificultades si lo hay, dificultades concretas, y «Alumnado al que se le abrirá PRA: …» si procede); 2. Acuerdos y decisiones de carácter individual (un párrafo por alumno con algo apuntado: «Nombre: situación y medida acordada»); 3. Asesoramiento del departamento de orientación (un párrafo corto); 4. Observaciones (las medidas para el trimestre, numeradas); 5. Conclusiones (composición del grupo si se da, actitud y necesidades). Son el resumen del anexo: el mismo contenido, más corto. Texto plano: sin viñetas, sin negritas ni títulos de formato.',
    '«anexo» es un objeto con estas partes: «IA» (valoración por área, con sus porcentajes: un párrafo por área), «IB» (información de los informes del curso anterior: clima de aula, casos del curso pasado, nuevas incorporaciones; solo en la sesión inicial, si no ""), «IC» (medidas de atención a la diversidad grupales, cada una en su línea y empezando por «• »), «II» (acuerdos individuales: una viñeta por alumno con algo apuntado, cada una en su línea y empezando por «• »), «III» (observaciones: las mismas medidas numeradas que la caja 4, cada una en su línea y empezando por su número y un punto) y «IV» (conclusiones).',
    '«resumenCiclo» son de 4 a 8 líneas para el equipo de ciclo: el nivel del grupo en cada área (con su porcentaje si lo hay) y el alumnado con medidas.',
    'Reglas de estilo:',
    '- Tercera persona impersonal y tono formal y sencillo: «Se observa que…», «Se acuerda…», «Se informa de que…», «Se recomienda…».',
    '- Usa solo lo que dicen las notas: no inventes datos, cifras, fechas, nombres ni acuerdos. Si un área no trae porcentaje, no pongas ninguno. Si algo no se entiende, redáctalo tal cual, sin rellenar.',
    '- Solo aparece en el acta el alumnado que viene en «alumnado». No añadas a nadie más ni menciones a quien no esté en las notas.',
    '- El alumnado aparece como marcas entre corchetes, por ejemplo [M.S.P.]. Copia cada marca exactamente igual, sin cambiarla ni añadirle nada. Nunca escribas un nombre.',
    '- Escribe las abreviaturas completas: «Cono» = Conocimiento del Medio, «Lengua» = Lengua Castellana, «PRA» = Programa de Refuerzo para el Aprendizaje (PRA) la primera vez.',
    '- Si una parte no tiene notas, su texto es "" (cadena vacía), salvo que las notas de otras partes permitan escribirla sin inventar nada.',
    'Ejemplo de estilo (notas: «llegó tarde al curso y no domina el idioma; PRA en Lengua y Matemáticas»; Matemáticas, 30 % con dificultades, «cálculo mental flojo, problemas de dos pasos»):',
    '  caja 1: «Matemáticas: El 30 % del grupo presenta dificultades, sobre todo en el cálculo mental y en los problemas de dos pasos.»',
    '  caja 2: «[P.R.]: incorporación tardía y dificultades con el idioma; se acuerda un Programa de Refuerzo para el Aprendizaje (PRA) en Lengua y Matemáticas.»',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"seneca":["…","…","…","…","…"],"anexo":{"IA":"…","IB":"…","IC":"…","II":"…","III":"…","IV":"…"},"resumenCiclo":"…"}.'
  ].join('\n');
  var OTRA_VERSION = 'Escribe una redacción distinta de la habitual, con otras palabras y otra estructura, sin cambiar lo que dicen las notas.';

  /* Lo que sale hacia Claude y cómo deshacerlo. Cada caja de notas es un «punto» de alumnado-claude.js (así las iniciales se reparten una sola vez para toda la petición).
     Devuelve { cuerpo (el JSON del usuario), marcas ({ '[M.S.P.]': 'Nombre Apellidos (grupo)' }), alumnos ([marcas de los alumnos con notas]), hay: bool }. */
  function preparar(e, todos) {
    var puntos = [], quien = {}, n = 0;
    function punto(clave, titulo, notas) { n++; puntos.push({ n: n, titulo: titulo, notas: notas }); quien[n] = clave; }
    E.areasConAlgo(e).forEach(function (a, i) { punto('area' + i, a.nombre, a.notas || ''); });
    E.alumnosConNotas(e).forEach(function (a, i) { punto('alumno' + i, 'Alumno', A.marca({ nombre: a.nombre, grupo: a.grupo, enLista: true }) + ': ' + a.notas); });
    punto('orientacion', 'Orientación', e.orientacion || ''); punto('observaciones', 'Observaciones', e.observaciones || ''); punto('conclusiones', 'Conclusiones', e.conclusiones || '');
    if (e.sesion === 'inicial') punto('informes', 'Informes del curso anterior', e.informesAnteriores || '');
    var prep = AC.preparar(puntos, todos), notas = {}, marcas = {}, delAlumno = [];
    prep.puntos.forEach(function (p) {
      notas[quien[p.n]] = p.notas;
      Object.keys(prep.marcas[p.n]).forEach(function (m) { marcas[m] = prep.marcas[p.n][m]; });
      if (/^alumno/.test(quien[p.n])) { var m1 = /^\[[^\]]+\]/.exec(p.notas); if (m1) delAlumno.push(m1[0]); }
    });
    var cuerpo = { sesion: e.sesion, clase: e.clase };
    if (E.conComposicion(e)) cuerpo.composicion = { alumnas: String(e.composicion.chicas || '').trim(), alumnos: String(e.composicion.chicos || '').trim() };
    cuerpo.areas = E.areasConAlgo(e).map(function (a, i) {
      var x = { nombre: a.nombre };
      if (E.tienePorcentaje(a)) x.porcentajeConDificultades = Number(a.porcentaje);
      if (notas['area' + i]) x.notas = notas['area' + i];
      return x;
    });
    cuerpo.alumnado = E.alumnosConNotas(e).map(function (a, i) { return { notas: notas['alumno' + i] }; });
    ['orientacion', 'observaciones', 'conclusiones'].forEach(function (k) { if (notas[k]) cuerpo[k] = notas[k]; });
    if (notas.informes) cuerpo.informesCursoAnterior = notas.informes;
    return { cuerpo: cuerpo, marcas: marcas, alumnos: delAlumno, avisos: prep.avisos };
  }

  /* La petición exacta. Lleva solo INSTRUCCIONES (más el estilo del tema 58, si se pasa) y las notas; nunca un nombre. */
  function cuerpo(prep, opciones) {
    opciones = opciones || {};
    return {
      model: g.Claude.MODELO, max_tokens: 8000,
      system: INSTRUCCIONES + (opciones.estilo ? '\n' + opciones.estilo : '') + (opciones.otraVersion ? '\n' + OTRA_VERSION : ''),
      messages: [{ role: 'user', content: JSON.stringify(prep.cuerpo) }]
    };
  }

  function texto(x) { return typeof x === 'string' ? x.trim() : ''; }
  /* La respuesta de Claude -> { seneca: [5], anexo: { IA…IV }, resumenCiclo }. Lanza si no es el JSON pedido. */
  function leerRespuesta(crudo, sesion) {
    var t = String(crudo || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var ini = t.indexOf('{'), fin = t.lastIndexOf('}'), o;
    if (ini < 0 || fin < ini) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    o = JSON.parse(t.slice(ini, fin + 1));
    if (!o || !Array.isArray(o.seneca) || o.seneca.length !== 5 || !o.anexo || typeof o.anexo !== 'object') throw new Error('La respuesta de Claude no tiene el formato pedido.');
    var anexo = {};
    E.PARTES_ANEXO.forEach(function (p) { anexo[p.id] = p.soloInicial && sesion !== 'inicial' ? '' : texto(o.anexo[p.id]); });
    return { seneca: o.seneca.map(texto), anexo: anexo, resumenCiclo: texto(o.resumenCiclo) };
  }

  function todosLosTextos(res) { return res.seneca.concat(E.PARTES_ANEXO.map(function (p) { return res.anexo[p.id]; }), [res.resumenCiclo]); }
  /* Ninguna marca inventada y cada alumno con notas en el apartado II del anexo. */
  function marcasBien(res, prep) {
    var env = Object.keys(prep.marcas);
    return todosLosTextos(res).every(function (t) { return AC.marcasEn(t).every(function (m) { return env.indexOf(m) >= 0; }); }) &&
      prep.alumnos.every(function (m) { return res.anexo.II.indexOf(m) >= 0; });
  }
  /* Las marcas vuelven a ser «Nombre Apellidos (grupo)»; en el resumen para el ciclo, a la marca de alumnado del editor (⟦Nombre|grupo|1⟧), para que al volver a Claude vayan iniciales. */
  function restaurar(res, prep, e, todos) {
    var comoMarca = {};
    (todos || []).concat((e.alumnos || []).map(function (a) { return { nombre: a.nombre, grupo: a.grupo }; })).forEach(function (a) { comoMarca[A.etiqueta(a)] = A.marca({ nombre: a.nombre, grupo: a.grupo, enLista: true }); });
    var paraResumen = {};
    Object.keys(prep.marcas).forEach(function (m) { paraResumen[m] = comoMarca[prep.marcas[m]] || prep.marcas[m]; });
    var r = { seneca: res.seneca.map(function (t) { return AC.restaurar(t, prep.marcas); }), anexo: {}, resumenCiclo: AC.restaurar(res.resumenCiclo, paraResumen) };
    E.PARTES_ANEXO.forEach(function (p) { r.anexo[p.id] = AC.restaurar(res.anexo[p.id], prep.marcas); });
    return r;
  }

  /* Redacta: { textos: { seneca, anexo, resumenCiclo }, aviso }. Un reintento si llega mal o con los nombres cambiados. */
  async function redactar(clave, e, todos, opciones) {
    opciones = opciones || {};
    if (!clave) { var f0 = new Error(g.Claude.FRASE_SIN_CLAVE); f0.tipo = 'clave'; throw f0; }
    if (!E.hayNotas(e)) { var v = new Error('Escribe primero alguna nota para que Claude la redacte.'); v.tipo = 'vacio'; throw v; }
    var prep = preparar(e, todos), ultimo = null, mal = null;
    for (var intento = 0; intento < 2; intento++) {
      var crudo = await g.Claude.llamar(clave, cuerpo(prep, opciones), opciones.buscar), res;
      try { res = leerRespuesta(crudo, e.sesion); } catch (err) { ultimo = err; continue; }
      if (marcasBien(res, prep)) return { textos: restaurar(res, prep, e, todos), aviso: avisoDe(prep) };
      mal = res;
    }
    if (mal) return { textos: restaurar(mal, prep, e, todos), aviso: AC.AVISO_NOMBRES };
    var f = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.tipo = 'formato'; f.detalle = ultimo; throw f;
  }
  function avisoDe(prep) { var l = Object.keys(prep.avisos || {}).map(function (n) { return prep.avisos[n]; }); return l.length ? l[0] : ''; }

  g.EvaluacionClaude = { INSTRUCCIONES: INSTRUCCIONES, preparar: preparar, cuerpo: cuerpo, leerRespuesta: leerRespuesta, redactar: redactar };
})(typeof window !== 'undefined' ? window : globalThis);
