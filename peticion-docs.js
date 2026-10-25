/* La petición a orientación en ficheros (fila 76): «Crear acta» y «Crear solicitud» montan el PDF y el Word con el membrete oficial y los guardan en
   ACTAS/documentos/<curso>/Atención a la diversidad/. Reutilizan los generadores del acta de ciclo (acta-pdf.js y acta-docx.js) con un modelo propio. Sin pantalla: se prueba con node --test.
   Los nombres de los ficheros llevan al alumno con nombre, apellidos y grupo (fila 94); a Claude siguen yendo solo iniciales. */
(function (g) {
  'use strict';
  var P = g.Peticion;
  var ACTA = { base: 'Acta reunión equipo docente', pie: 'Acta de la reunión del equipo docente', titulo: 'ACTA DE REUNIÓN DEL EQUIPO DOCENTE — DETECCIÓN DE INDICIOS DE NEAE' };
  var SOLICITUD = { base: 'Solicitud evaluación psicopedagógica', pie: 'Solicitud de evaluación psicopedagógica', titulo: 'SOLICITUD DE EVALUACIÓN PSICOPEDAGÓGICA' };

  function sinRaros(t) { return String(t).replace(/[\\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }
  function nombreAlumno(p) { return p.alumno.nombre + (p.alumno.grupo ? ' (' + p.alumno.grupo + ')' : ''); }
  function filasComunes(p, tut) {
    var filas = [['ALUMNO/A:', [nombreAlumno(p)]], ['CURSO ESCOLAR:', [p.curso]]], tutora = tut && String(tut.tutora || '').trim();
    if (tutora) filas.push(['TUTOR / A', [tutora]]);
    return filas;
  }
  function lugarYFecha(localidad, iso) {
    var f = g.ReunionModelo.fechaEnMayusculas(iso), loc = String(localidad || '').trim();
    return loc ? 'En ' + loc + ' a ' + f : f;
  }

  /* p: la petición guardada; tut: { grupo, tutora } o null; localidad: de la ficha del curso. Devuelven el modelo para ActaPdf / ActaDocx. */
  function montarActa(p, tut, localidad) {
    var r = p.reunion, filas = filasComunes(p, tut), asist = P.listaAsistentes(p);
    if (asist.length) filas.push(['ASISTENTES', asist]);
    if (r.ambitos.length) filas.push(['ÁMBITOS CON INDICIOS', r.ambitos]);
    return {
      titulo: ACTA.titulo, celebrada: 'Reunión celebrada el día ' + g.fechaLarga(r.fecha), encabezados: { puntos: 'PUNTOS TRATADOS', asuntos: 'ACTA' }, filas: filas,
      puntos: ['1. Indicios observados', '2. Medidas que se van a aplicar', '3. Seguimiento y revisión'],
      asuntos: [{ titulo: '', lineas: g.lineasDeParrafo(r.textoActa) }, { titulo: 'Fecha de revisión de las medidas', lineas: g.lineasDeParrafo(g.fechaLarga(p.revision) + '.') }],
      cierre: [lugarYFecha(localidad, r.fecha)]
    };
  }
  function montarSolicitud(p, tut, localidad) {
    var s = p.solicitud, filas = filasComunes(p, tut), tutora = tut && String(tut.tutora || '').trim();
    filas.push(['DIRIGIDA A', ['Jefatura de estudios']]);
    return {
      titulo: SOLICITUD.titulo, celebrada: 'Solicitud presentada el día ' + g.fechaLarga(s.fecha), encabezados: { puntos: 'CONTENIDO', asuntos: 'SOLICITUD' }, filas: filas,
      puntos: ['1. Datos del alumno y indicios', '2. Medidas aplicadas', '3. Resultado y petición'],
      asuntos: [{ titulo: '', lineas: g.lineasDeParrafo(s.texto) }],
      cierre: [lugarYFecha(localidad, s.fecha), 'Firma del tutor o tutora:', 'Fdo.: ' + (tutora || '______________________')]
    };
  }

  async function opciones(raiz, tipo) {
    var cm = await g.Colegio.paraDocumentos(raiz);
    return { mem: cm.mem, opc: { pie: tipo.pie } };
  }

  /* El nombre sin extensión y sin «(2)»: «2026-11-06 Acta reunión equipo docente · Pablo Ruiz Gómez (4º A)». */
  function nombreBase(p, tipo, fecha) { return fecha + ' ' + tipo.base + ' · ' + sinRaros(nombreAlumno(p)); }

  /* Otra petición con el mismo nombre -> « (2)»; la misma, el suyo. */
  async function nombreLibre(raiz, curso, p, tipo, fecha, docs) {
    if (g.Envios.reutilizable(docs, curso, fecha, g.Envios.SUB.diversidad)) return docs.base;
    var usados = ((await raiz.listar(g.Envios.carpeta(curso, g.Envios.SUB.diversidad))) || []).map(function (x) { return x.nombre; });
    var base = nombreBase(p, tipo, fecha), n = 1, candidato = base;
    while (usados.indexOf(candidato + '.pdf') >= 0 || usados.indexOf(candidato + '.docx') >= 0) { n++; candidato = base + ' (' + n + ')'; }
    return candidato;
  }

  /* Monta y guarda el PDF y el Word. Los ficheros van primero: si falla, no se marca nada. Devuelve { curso, base, pdf, docx }. */
  async function escribir(raiz, p, ficha, modelo, tipo, fecha, docs) {
    var o = await opciones(raiz, tipo), curso = g.cursoEscolar(fecha);
    var pdf = await g.ActaPdf.crear(modelo, o.mem, o.opc), docx = await g.ActaDocx.crear(modelo, o.mem, o.opc);
    var base = await nombreLibre(raiz, curso, p, tipo, fecha, docs), ruta = g.Envios.carpeta(curso, g.Envios.SUB.diversidad) + '/' + base;
    await raiz.escribirBinario(ruta + '.pdf', pdf);
    await raiz.escribirBinario(ruta + '.docx', docx);
    return { curso: curso, base: base, pdf: ruta + '.pdf', docx: ruta + '.docx' };
  }

  async function crearActa(raiz, p, ficha, tut, ahora) {
    var d = await escribir(raiz, p, ficha, montarActa(p, tut, ficha && ficha.localidad), ACTA, p.reunion.fecha, p.reunion.documentos);
    p.reunion.documentos = d; P.actaCreada(p, ahora);
    await P.guardar(raiz, p, ahora);
    return p;
  }
  async function crearSolicitud(raiz, p, ficha, tut, ahora) {
    var d = await escribir(raiz, p, ficha, montarSolicitud(p, tut, ficha && ficha.localidad), SOLICITUD, p.solicitud.fecha, p.solicitud.documentos);
    p.solicitud.documentos = d; P.solicitudCreada(p, ahora);
    await P.guardar(raiz, p, ahora);
    return p;
  }

  g.PeticionDocs = { ACTA: ACTA, SOLICITUD: SOLICITUD, montarActa: montarActa, montarSolicitud: montarSolicitud, nombreBase: nombreBase, nombreLibre: nombreLibre, crearActa: crearActa, crearSolicitud: crearSolicitud };
})(typeof window !== 'undefined' ? window : globalThis);
