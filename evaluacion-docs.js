/* El anexo del acta de evaluación en ficheros (fila 59): «Crear anexo» monta el PDF y el Word con el membrete oficial y los guarda en ACTAS/documentos/<curso>/.
   Reutiliza los generadores del acta de ciclo (acta-pdf.js y acta-docx.js) con un modelo propio. Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var E = g.Evaluacion;
  var BASE = 'Acta de evaluación', PIE = 'Anexo al acta de sesión de evaluación';
  var TITULOS = {
    I: 'I. Acuerdos y decisiones de carácter general para el grupo', II: 'II. Acuerdos y decisiones de carácter individual', III: 'III. Observaciones', IV: 'IV. Conclusiones'
  };
  var SUBTITULOS = { IA: 'A) Valoración de la situación del alumnado respecto de las competencias específicas', IB: 'B) Información de la tutoría tras analizar los informes del curso anterior', IC: 'C) Medidas de atención a la diversidad grupales' };

  function lleno(t) { return !!String(t || '').trim(); }
  function sinRaros(t) { return String(t).replace(/[\\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }
  function nombreSesion(e) { return (E.sesion(e.sesion) || { nombre: e.sesion }).nombre; }
  function titulo(e) { return 'ANEXO AL ACTA DE SESIÓN DE EVALUACIÓN — ' + nombreSesion(e).toUpperCase() + ' — ' + e.clase + ' — ' + e.curso; }
  function subtitulo(t) { return { runs: [{ t: t, b: true }] }; }

  /* e: el acta guardada; tut: { grupo, tutora } o null; localidad: de la ficha del curso. Devuelve el modelo para ActaPdf / ActaDocx. */
  function montar(e, tut, localidad) {
    var a = (e.textos && e.textos.anexo) || {}, asuntos = [], filas = [['CLASE:', [e.clase]], ['SESIÓN:', ['Evaluación ' + nombreSesion(e).toLowerCase()]], ['CURSO ESCOLAR:', [e.curso]]];
    var tutora = tut && String(tut.tutora || '').trim();
    if (tutora) filas.push(['TUTOR / A', [tutora]]);
    var general = [];
    ['IA', 'IB', 'IC'].forEach(function (k) {
      if (!lleno(a[k]) || (k === 'IB' && e.sesion !== 'inicial')) return;
      general.push(subtitulo(SUBTITULOS[k]));
      general = general.concat(g.lineasDeParrafo(a[k]));
    });
    var partes = [['I', general], ['II', lleno(a.II) ? g.lineasDeParrafo(a.II) : []], ['III', lleno(a.III) ? g.lineasDeParrafo(a.III) : []], ['IV', lleno(a.IV) ? g.lineasDeParrafo(a.IV) : []]]
      .filter(function (p) { return p[1].length; });
    partes.forEach(function (p) { asuntos.push({ titulo: TITULOS[p[0]], lineas: p[1] }); });
    var fecha = g.ReunionModelo.fechaEnMayusculas(e.fecha), loc = String(localidad || '').trim();
    return {
      titulo: titulo(e), celebrada: 'Sesión celebrada el día ' + g.fechaLarga(e.fecha), encabezados: { puntos: 'CONTENIDO DEL ANEXO', asuntos: 'ANEXO' }, filas: filas,
      puntos: partes.map(function (p) { return TITULOS[p[0]]; }), asuntos: asuntos, cierre: [loc ? 'En ' + loc + ' a ' + fecha : fecha]
    };
  }

  async function opciones(ficha) {
    var mem = await g.Membrete.cargar(), colegio = ficha ? g.ActaModelo.fichaParaActa(ficha).colegio : '';
    return { mem: mem, opc: { colegio: colegio || mem.colegio, pie: PIE } };
  }

  /* El nombre sin extensión: «2026-09-09 Acta de evaluación Inicial 4º A». Otra acta (otro id) con el mismo nombre -> « (2)»; la misma, el suyo. */
  async function nombreLibre(raiz, curso, e) {
    var d = e.documentos;
    if (d && d.curso === curso && String(d.base).indexOf(e.fecha) === 0) return d.base;
    var usados = ((await raiz.listar(g.Envios.DOCS + '/' + curso)) || []).map(function (x) { return x.nombre; });
    var base = e.fecha + ' ' + BASE + ' ' + nombreSesion(e) + ' ' + sinRaros(e.clase), n = 1, candidato = base;
    while (usados.indexOf(candidato + '.pdf') >= 0 || usados.indexOf(candidato + '.docx') >= 0) { n++; candidato = base + ' (' + n + ')'; }
    return candidato;
  }

  /* Monta y guarda el PDF y el Word, y deja el acta marcada como creada (con dónde están sus ficheros). Los ficheros van primero: si falla, no se marca. */
  async function crear(raiz, e, ficha, tut, ahora) {
    var o = await opciones(ficha), modelo = montar(e, tut, ficha && ficha.localidad), curso = g.cursoEscolar(e.fecha);
    var pdf = await g.ActaPdf.crear(modelo, o.mem, o.opc), docx = await g.ActaDocx.crear(modelo, o.mem, o.opc);
    var base = await nombreLibre(raiz, curso, e), ruta = g.Envios.DOCS + '/' + curso + '/' + base;
    await raiz.escribirBinario(ruta + '.pdf', pdf);
    await raiz.escribirBinario(ruta + '.docx', docx);
    e.documentos = { curso: curso, base: base, pdf: ruta + '.pdf', docx: ruta + '.docx' };
    e.estado = 'creada'; e.creada = (ahora || new Date()).toISOString();
    await E.guardar(raiz, e, ahora);
    return e;
  }

  g.EvaluacionDocs = { BASE: BASE, PIE: PIE, titulo: titulo, montar: montar, nombreLibre: nombreLibre, crear: crear };
})(typeof window !== 'undefined' ? window : globalThis);
