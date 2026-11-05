/* Las comunicaciones a familias en ficheros (fila 109): «Crear PDF y Word» monta los dos con el membrete del colegio y los guarda en ACTAS/documentos/<curso>/Familias/.
   La carta lleva el título, el texto y, al pie, la localidad, la fecha y el nombre de la tutora; la autorización, además, una línea para recortar y un talón (una sola hoja para todas las
   familias). Reutiliza los generadores del acta de ciclo (acta-pdf.js y acta-docx.js) con un modelo propio (`carta`). Si ya tenía ficheros, los nuevos los sustituyen.
   Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var C = g.Comunicacion, PIE = 'Comunicación a las familias', HUECO = '______________________________';

  function sinRaros(t) { return String(t).replace(/[\\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }
  function larga(iso) { return g.fechaLarga(iso); }

  /* «2026-11-03 Autorización de salida · Visita a la granja · 4º A» (sin extensión). */
  function nombreBase(c) {
    return c.fecha + ' ' + C.TIPOS[c.tipo].nombre + ' · ' + sinRaros(C.tituloDe(c)).slice(0, 80).trim() + ' · ' + sinRaros(c.grupo);
  }

  /* El modelo para ActaPdf / ActaDocx. c: la comunicación; tut: { grupo, tutora }; localidad: de la ficha del curso. */
  function montar(c, tut, localidad) {
    var loc = String(localidad || c.localidad || '').trim(), tutora = String((tut && tut.tutora) || c.tutora || '').trim();
    var carta = {
      titulo: C.tituloDe(c), lineas: g.lineasDeParrafo(c.texto),
      cierre: [(loc ? 'En ' + loc + ', a ' : 'A ') + larga(c.fecha), tutora ? 'La tutora: ' + tutora : 'La tutora'], talon: null
    };
    if (C.esAutorizacion(c)) {
      var s = c.salida;
      carta.talon = {
        aviso: 'Recortar y entregar antes del ' + larga(s.limite),
        lineas: ['D./Dª. ' + HUECO + ', como padre, madre o tutor legal de ' + HUECO + ', del grupo ' + c.grupo + ', AUTORIZO a que participe en «' + String(s.actividad).trim() + '» el día ' + larga(s.dia) + '.', 'Fecha y firma:']
      };
    }
    return { titulo: C.TIPOS[c.tipo].nombre + ' — ' + C.tituloDe(c), carta: carta };
  }

  async function opciones(raiz) {
    var cm = await g.Colegio.paraDocumentos(raiz);
    return { mem: cm.mem, opc: { pie: PIE } };
  }

  /* Los mismos ficheros de la comunicación si siguen siendo suyos; si no, un nombre libre (« (2)» si ya hay otro con ese nombre). */
  async function nombreLibre(raiz, curso, c) {
    var E = g.Envios, d = c.documentos;
    if (d && d.base === nombreBase(c) && E.reutilizable(d, curso, c.fecha, E.SUB.familias)) return d.base;
    var usados = ((await raiz.listar(E.carpeta(curso, E.SUB.familias))) || []).map(function (x) { return x.nombre; });
    var base = nombreBase(c), n = 1, candidato = base;
    while (usados.indexOf(candidato + '.pdf') >= 0 || usados.indexOf(candidato + '.docx') >= 0) { n++; candidato = base + ' (' + n + ')'; }
    return candidato;
  }

  /* Monta y guarda el PDF y el Word, y deja la comunicación marcada como creada (con dónde están sus ficheros). Los ficheros van primero: si falla, no se marca.
     Los anteriores, si tenían otro nombre (otro título u otra fecha), se quitan: los nuevos los sustituyen. */
  async function crear(raiz, c, tut, ficha, ahora) {
    var o = await opciones(raiz), modelo = montar(c, tut, ficha && ficha.localidad), E = g.Envios, curso = g.cursoEscolar(c.fecha);
    var pdf = await g.ActaPdf.crear(modelo, o.mem, o.opc), docx = await g.ActaDocx.crear(modelo, o.mem, o.opc);
    var base = await nombreLibre(raiz, curso, c), ruta = E.carpeta(curso, E.SUB.familias) + '/' + base, previo = c.documentos;
    await raiz.escribirBinario(ruta + '.pdf', pdf);
    await raiz.escribirBinario(ruta + '.docx', docx);
    if (previo && previo.base !== base) {
      var carpeta = E.carpeta(previo.curso || curso, E.SUB.familias) + '/';
      for (var k = 0; k < 2; k++) {
        var vieja = k ? previo.docx : previo.pdf;
        if (vieja && String(vieja).indexOf(carpeta) === 0) { try { await raiz.borrar(vieja, false); } catch (x) { /* ya no estaba */ } }
      }
    }
    c.documentos = { curso: curso, base: base, pdf: ruta + '.pdf', docx: ruta + '.docx' };
    C.marcarCreada(c, ahora);
    await C.guardar(raiz, c, ahora);
    return c;
  }

  g.ComunicacionDocs = { PIE: PIE, montar: montar, nombreBase: nombreBase, nombreLibre: nombreLibre, crear: crear };
})(typeof window !== 'undefined' ? window : globalThis);
