/* El informe de final de curso en ficheros (fila 101): «Crear PDF y Word» monta los dos con el membrete del colegio y los guarda en ACTAS/documentos/<curso>/Evaluación/.
   Reutiliza los generadores del acta de ciclo (acta-pdf.js y acta-docx.js) con un modelo propio. Si el informe ya tenía ficheros, los nuevos los sustituyen.
   Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var F = g.FinalCurso;

  function sinRaros(t) { return String(t).replace(/[\\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }
  function titulo(f) { return F.tipo(f).nombre.toUpperCase() + ' — ' + f.curso; }

  /* f: el informe; tut: { grupo, tutora } o null; localidad: de la ficha del curso. Devuelve el modelo para ActaPdf / ActaDocx. */
  function montar(f, tut, localidad) {
    var t = F.tipo(f), filas = [['ALUMNO/A:', [f.alumno.nombre]], ['GRUPO:', [f.alumno.grupo]], ['CURSO ESCOLAR:', [f.curso]]];
    var tutora = tut && String(tut.tutora || '').trim();
    if (tutora) filas.push(['TUTOR / A', [tutora]]);
    var apartados = t.apartados.filter(function (a) { return String(F.texto(f, a.id)).trim(); });
    var fecha = g.ReunionModelo.fechaEnMayusculas(f.fecha), loc = String(localidad || '').trim();
    return {
      titulo: titulo(f), celebrada: 'Fecha del informe: ' + g.fechaLarga(f.fecha), encabezados: { puntos: 'APARTADOS DEL INFORME', asuntos: 'INFORME' }, filas: filas,
      puntos: apartados.map(function (a) { return a.titulo; }),
      asuntos: apartados.map(function (a) { return { titulo: a.titulo, lineas: g.lineasDeParrafo(F.texto(f, a.id)) }; }),
      cierre: ['Firma del tutor o tutora: ______________________', loc ? 'En ' + loc + ' a ' + fecha : fecha]
    };
  }

  async function opciones(raiz, f) {
    var cm = await g.Colegio.paraDocumentos(raiz);
    return { mem: cm.mem, opc: { pie: F.tipo(f).nombre } };
  }

  /* «2027-06-18 Informe final de etapa · Lucía Alcántara Ruiz · 6º A» (sin extensión). */
  function nombreBase(f) { return f.fecha + ' ' + F.tipo(f).nombre + ' · ' + sinRaros(f.alumno.nombre) + ' · ' + sinRaros(f.alumno.grupo); }

  /* Los mismos ficheros del informe si siguen siendo suyos; si no, un nombre libre (« (2)» si otro informe ya lo tiene). */
  async function nombreLibre(raiz, f) {
    var E = g.Envios, d = f.documentos;
    if (d && d.base === nombreBase(f) && E.reutilizable(d, f.curso, f.fecha, E.SUB.evaluacion)) return d.base;
    var usados = ((await raiz.listar(E.carpeta(f.curso, E.SUB.evaluacion))) || []).map(function (x) { return x.nombre; });
    var base = nombreBase(f), n = 1, candidato = base;
    while (usados.indexOf(candidato + '.pdf') >= 0 || usados.indexOf(candidato + '.docx') >= 0) { n++; candidato = base + ' (' + n + ')'; }
    return candidato;
  }

  /* Monta y guarda el PDF y el Word, y deja el informe marcado como creado (con dónde están sus ficheros y la firma de lo que llevan).
     Los ficheros van primero: si falla, no se marca. Los ficheros anteriores del informe, si tenían otro nombre (otra fecha), se quitan: los nuevos los sustituyen. */
  async function crear(raiz, f, ficha, tut, ahora) {
    var o = await opciones(raiz, f), modelo = montar(f, tut, ficha && ficha.localidad), E = g.Envios;
    var pdf = await g.ActaPdf.crear(modelo, o.mem, o.opc), docx = await g.ActaDocx.crear(modelo, o.mem, o.opc);
    var base = await nombreLibre(raiz, f), ruta = E.carpeta(f.curso, E.SUB.evaluacion) + '/' + base, previo = f.documentos;
    await raiz.escribirBinario(ruta + '.pdf', pdf);
    await raiz.escribirBinario(ruta + '.docx', docx);
    if (previo && previo.base !== base) {
      var carpeta = E.carpeta(previo.curso || f.curso, E.SUB.evaluacion) + '/';
      for (var k = 0; k < 2; k++) {
        var vieja = k ? previo.docx : previo.pdf;
        if (vieja && String(vieja).indexOf(carpeta) === 0) { try { await raiz.borrar(vieja, false); } catch (x) { /* ya no estaba */ } }
      }
    }
    f.documentos = { curso: f.curso, base: base, pdf: ruta + '.pdf', docx: ruta + '.docx', firma: F.firmaTextos(f) };
    await F.guardar(raiz, f, ahora);
    return f;
  }

  g.FinalCursoDocs = { titulo: titulo, montar: montar, nombreBase: nombreBase, nombreLibre: nombreLibre, crear: crear };
})(typeof window !== 'undefined' ? window : globalThis);
