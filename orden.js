/* Ordenar lo que ya estaba guardado (fila 94): al abrir la carpeta ACTAS, cada PDF y Word que la app hizo (los que figuran en sus datos de enviadas/, evaluaciones/,
   reuniones/ y peticiones/, y los dos libros) pasa a la subcarpeta de su tipo dentro de ACTAS/documentos/<curso>/ con el nombre nuevo. Nada se borra a ciegas:
   se escribe el fichero nuevo, se comprueba, se pone al día la ruta guardada en los datos del papel y solo entonces se quita el antiguo. Si algo falla, el papel se
   queda donde estaba. Lo que no es de la app no se toca. Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var TIPOS = ['pdf', 'docx'];
  var LIBROS = [{ pre: 'Libro de actas del curso ', sub: 'actas' }, { pre: 'Libro de reuniones con familias ', sub: 'familias' }];

  function escapar(t) { return String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  async function bytesDe(f) { return new Uint8Array(f.arrayBuffer ? await f.arrayBuffer() : f.bytes); }
  async function leerBueno(raiz, ruta) { try { return await raiz.leerJSON(ruta); } catch (e) { return null; } }

  /* Los papeles con ficheros de la app: [{ docs: documentos (se cambia en su sitio), sub, base (null = se queda con el suyo), guardar: async () => guarda los datos }]. */
  async function papeles(raiz) {
    var E = g.Envios, lista = [], nombres, i, x;
    nombres = await raiz.listarJSON(E.HECHAS);
    for (i = 0; i < nombres.length; i++) {
      x = await leerBueno(raiz, E.HECHAS + '/' + nombres[i]);
      if (x && x.id && x.documentos && x.tipo !== 'reunion-familias') lista.push({ docs: x.documentos, sub: E.SUB.actas, base: null, guardar: guardador(raiz, E.HECHAS + '/' + x.id + '.json', x) });
    }
    nombres = await raiz.listarJSON(g.Evaluacion.DIR);
    for (i = 0; i < nombres.length; i++) {
      x = await leerBueno(raiz, g.Evaluacion.DIR + '/' + nombres[i]);
      if (x && x.id && x.documentos) lista.push({ docs: x.documentos, sub: E.SUB.evaluacion, base: nombreSeguro(function () { return g.EvaluacionDocs.nombreBase(x); }), guardar: guardador(raiz, g.Evaluacion.DIR + '/' + x.id + '.json', x) });
    }
    nombres = await raiz.listarJSON(g.Reunion.DIR);
    for (i = 0; i < nombres.length; i++) {
      x = await leerBueno(raiz, g.Reunion.DIR + '/' + nombres[i]);
      if (x && x.id && x.documentos) lista.push({ docs: x.documentos, sub: E.SUB.familias, base: nombreSeguro(function () { return g.ReunionDocs.nombreBase(x); }), guardar: guardador(raiz, g.Reunion.DIR + '/' + x.id + '.json', x) });
    }
    nombres = await raiz.listarJSON(g.Peticion.DIR);
    for (i = 0; i < nombres.length; i++) {
      x = await leerBueno(raiz, g.Peticion.DIR + '/' + nombres[i]);
      if (!x || !x.id) continue;
      var ruta = g.Peticion.DIR + '/' + x.id + '.json', PD = g.PeticionDocs;
      if (x.reunion && x.reunion.documentos) lista.push({ docs: x.reunion.documentos, sub: E.SUB.diversidad, base: nombreSeguro(function () { return PD.nombreBase(x, PD.ACTA, x.reunion.fecha); }), guardar: guardador(raiz, ruta, x) });
      if (x.solicitud && x.solicitud.documentos) lista.push({ docs: x.solicitud.documentos, sub: E.SUB.diversidad, base: nombreSeguro(function () { return PD.nombreBase(x, PD.SOLICITUD, x.solicitud.fecha); }), guardar: guardador(raiz, ruta, x) });
    }
    return lista.filter(function (p) { return p.base !== undefined; });
  }
  /* Si no se puede calcular el nombre nuevo (datos a medias), el papel no se toca: undefined. */
  function nombreSeguro(f) { try { var n = f(); return n ? n : undefined; } catch (e) { return undefined; } }
  function guardador(raiz, ruta, objeto) { return function () { return raiz.escribirJSON(ruta, objeto); }; }

  async function nombresDe(raiz, ruta) { return ((await raiz.listar(ruta)) || []).map(function (x) { return x.nombre; }); }
  function libre(usados, base) {
    var n = 1, candidato = base;
    while (usados.indexOf(candidato + '.pdf') >= 0 || usados.indexOf(candidato + '.docx') >= 0) { n++; candidato = base + ' (' + n + ')'; }
    return candidato;
  }

  /* Escribe los ficheros nuevos; si algo falla, quita los que ya había escrito y lo dice. Devuelve true si todo ha quedado escrito. */
  async function escribirTodo(raiz, bytes, destinos) {
    var escritos = [];
    try {
      for (var i = 0; i < TIPOS.length; i++) if (bytes[TIPOS[i]]) { await raiz.escribirBinario(destinos[TIPOS[i]], bytes[TIPOS[i]]); escritos.push(destinos[TIPOS[i]]); }
      return null;
    } catch (e) { return escritos; }
  }
  async function quitar(raiz, rutas) { for (var i = 0; i < rutas.length; i++) { try { await raiz.borrar(rutas[i], false); } catch (e) { /* queda un fichero de más, no se pierde nada */ } } }

  /* Mueve un papel suelto. Devuelve 'ordenado', 'ya' (ya estaba en su sitio o no tiene ficheros) o 'fallo'. */
  async function moverPapel(raiz, p) {
    var E = g.Envios, d = p.docs, dest = E.carpeta(d.curso, p.sub);
    var bien = p.base === null ? true : new RegExp('^' + escapar(p.base) + '( \\(\\d+\\))?$').test(String(d.base));
    if (bien && String(d.pdf || '').indexOf(dest + '/') === 0) return 'ya';
    var bytes = {}, hay = false, i;
    try {
      for (i = 0; i < TIPOS.length; i++) {
        var f = d[TIPOS[i]] ? await raiz.abrirArchivo(d[TIPOS[i]]) : null;
        bytes[TIPOS[i]] = f ? await bytesDe(f) : null;
        if (f) hay = true;
      }
    } catch (e) { return 'fallo'; }
    if (!hay) return 'ya';
    var base, destinos, antes = { base: d.base, pdf: d.pdf, docx: d.docx }, escritos;
    try {
      base = libre(await nombresDe(raiz, dest), p.base === null ? d.base : p.base);
      destinos = { pdf: dest + '/' + base + '.pdf', docx: dest + '/' + base + '.docx' };
    } catch (e) { return 'fallo'; }
    escritos = await escribirTodo(raiz, bytes, destinos);
    if (escritos === null) {
      try { d.base = base; d.pdf = destinos.pdf; d.docx = destinos.docx; await p.guardar(); }
      catch (e) { d.base = antes.base; d.pdf = antes.pdf; d.docx = antes.docx; escritos = [destinos.pdf, destinos.docx].filter(function (r, k) { return bytes[TIPOS[k]]; }); }
    }
    if (escritos !== null) { await quitar(raiz, escritos); return 'fallo'; }
    await quitar(raiz, TIPOS.filter(function (t) { return bytes[t] && antes[t] !== destinos[t]; }).map(function (t) { return antes[t]; }));
    return 'ordenado';
  }

  /* Los dos libros que estén sueltos en la carpeta del curso (los de antes de la fila 94): un libro = un papel. */
  async function ordenarLibros(raiz, cuenta) {
    var E = g.Envios, cursos = ((await raiz.listar(E.DOCS)) || []).filter(function (x) { return x.tipo === 'directory'; });
    for (var c = 0; c < cursos.length; c++) {
      var ruta = E.DOCS + '/' + cursos[c].nombre, sueltos = ((await raiz.listar(ruta)) || []).filter(function (x) { return x.tipo === 'file'; }).map(function (x) { return x.nombre; });
      for (var l = 0; l < LIBROS.length; l++) {
        var bases = [];
        sueltos.forEach(function (n) {
          var m = /^(.*)\.(pdf|docx)$/.exec(n);
          if (m && m[1].indexOf(LIBROS[l].pre) === 0 && bases.indexOf(m[1]) < 0) bases.push(m[1]);
        });
        for (var b = 0; b < bases.length; b++) {
          var dest = E.carpeta(cursos[c].nombre, E.SUB[LIBROS[l].sub]);
          var p = { docs: { curso: cursos[c].nombre, base: bases[b], pdf: ruta + '/' + bases[b] + '.pdf', docx: ruta + '/' + bases[b] + '.docx' }, sub: E.SUB[LIBROS[l].sub], base: null, guardar: async function () { /* los libros no guardan su ruta */ } };
          var r = await moverPapel(raiz, p);
          if (r === 'ordenado') cuenta.ordenados++; else if (r === 'fallo') cuenta.fallos++;
        }
      }
    }
  }

  /* Ordena todo lo que se pueda. Devuelve { ordenados, fallos }; no escribe nada si ya está todo en su sitio. */
  async function ordenar(raiz) {
    var cuenta = { ordenados: 0, fallos: 0 }, lista = await papeles(raiz);
    for (var i = 0; i < lista.length; i++) {
      var r = await moverPapel(raiz, lista[i]);
      if (r === 'ordenado') cuenta.ordenados++; else if (r === 'fallo') cuenta.fallos++;
    }
    await ordenarLibros(raiz, cuenta);
    return cuenta;
  }

  function papelesTexto(n) { return n + (n === 1 ? ' papel' : ' papeles'); }
  /* El aviso de Inicio (cadena vacía si no hay nada que decir). */
  function mensaje(c) {
    var t = [];
    if (c.ordenados) t.push('He ordenado ' + papelesTexto(c.ordenados) + ' en sus carpetas.');
    if (c.fallos) t.push('No he podido ordenar ' + papelesTexto(c.fallos) + '; siguen en la carpeta del curso.');
    return t.join(' ');
  }

  g.Orden = { ordenar: ordenar, mensaje: mensaje };
})(typeof window !== 'undefined' ? window : globalThis);
