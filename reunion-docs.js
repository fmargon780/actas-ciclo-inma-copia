/* La reunión general con familias, en ficheros (fila 57): al «Crear acta» la app monta el PDF y el Word y los guarda en ACTAS/documentos/<curso>/;
   «Libro de reuniones con familias» junta las del curso en un solo PDF y un solo Word. El documento de Google ya no las recibe.
   Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var R = g.Reunion;

  function sinRaros(t) { return String(t).replace(/[\\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }

  async function opciones(ficha) {
    var mem = await g.Membrete.cargar(), colegio = ficha ? g.ActaModelo.fichaParaActa(ficha).colegio : '';
    return { mem: mem, opc: { colegio: colegio || mem.colegio, pie: g.ReunionModelo.PIE } };
  }

  /* El nombre sin extensión: «2026-09-09 Reunión general con familias 4º A». Otra reunión (otro id) con el mismo nombre -> « (2)»; la misma, el suyo. */
  async function nombreLibre(raiz, curso, r) {
    var d = r.documentos;
    if (d && d.curso === curso && String(d.base).indexOf(r.fecha) === 0) return d.base;
    var usados = ((await raiz.listar(g.Envios.DOCS + '/' + curso)) || []).map(function (x) { return x.nombre; });
    var base = r.fecha + ' ' + g.ReunionModelo.BASE + ' ' + sinRaros(r.grupo), n = 1, candidato = base;
    while (usados.indexOf(candidato + '.pdf') >= 0 || usados.indexOf(candidato + '.docx') >= 0) { n++; candidato = base + ' (' + n + ')'; }
    return candidato;
  }

  /* Monta y guarda el PDF y el Word, y deja la reunión marcada como creada (con dónde están sus ficheros). Los ficheros van primero: si falla, no se marca. */
  async function crear(raiz, r, ficha, ahora) {
    var o = await opciones(ficha), modelo = g.ReunionModelo.montar(r), curso = g.cursoEscolar(r.fecha);
    var pdf = await g.ActaPdf.crear(modelo, o.mem, o.opc), docx = await g.ActaDocx.crear(modelo, o.mem, o.opc);
    var base = await nombreLibre(raiz, curso, r), ruta = g.Envios.DOCS + '/' + curso + '/' + base;
    await raiz.escribirBinario(ruta + '.pdf', pdf);
    await raiz.escribirBinario(ruta + '.docx', docx);
    r.documentos = { curso: curso, base: base, pdf: ruta + '.pdf', docx: ruta + '.docx' };
    R.marcarCreada(r, ahora);
    await R.guardar(raiz, r, ahora);
    return r;
  }

  /* Las reuniones creadas del curso de la ficha y del grupo de la tutoría, por fecha. */
  function delLibro(todas, ficha, grupo) {
    return R.delCurso(todas, (ficha && ficha.curso) || '').filter(function (x) { return x.estado === 'creada' && x.grupo === grupo; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.creada) < String(b.creada) ? -1 : 1; });
  }

  /* Hace y guarda el libro entero. Devuelve { curso, grupo, reuniones, pdf, docx }. */
  async function libro(raiz, ficha, tut) {
    var anio = g.anioInicioDeTextoCurso(ficha && ficha.curso);
    if (anio === null || anio === undefined) { var e0 = new Error('Antes de hacer el libro, rellena «Datos del curso» en Ajustes.'); e0.tipo = 'ajustes'; throw e0; }
    var curso = anio + '-' + (anio + 1), lista = delLibro(await R.listar(raiz), ficha, tut.grupo);
    if (!lista.length) { var e = new Error('Todavía no hay reuniones creadas de ' + tut.grupo + ' este curso: crea una con «Crear acta».'); e.enEspanol = true; throw e; }
    var o = await opciones(ficha), modelos = lista.map(g.ReunionModelo.montar);
    var nombre = 'Libro de reuniones con familias ' + sinRaros(tut.grupo) + ' ' + curso, ruta = g.Envios.DOCS + '/' + curso + '/' + nombre;
    o.opc.tituloLibro = nombre;
    await raiz.escribirBinario(ruta + '.pdf', await g.ActaPdf.crearLibro(modelos, o.mem, o.opc));
    await raiz.escribirBinario(ruta + '.docx', await g.ActaDocx.crearLibro(modelos, o.mem, o.opc));
    return { curso: curso, grupo: tut.grupo, reuniones: modelos.length, pdf: ruta + '.pdf', docx: ruta + '.docx' };
  }

  g.ReunionDocs = { crear: crear, nombreLibre: nombreLibre, delLibro: delLibro, libro: libro };
})(typeof window !== 'undefined' ? window : globalThis);
