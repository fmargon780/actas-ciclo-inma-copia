/* «Libro de actas del curso» (fila 56): junta todas las actas de ciclo del curso (las traídas y las creadas con la app) en un solo PDF y un solo Word,
   por orden de fecha, cada una en página nueva con su membrete. Se hace entero cada vez. Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';

  async function leerBueno(raiz, ruta) { try { return await raiz.leerJSON(ruta); } catch (e) { return null; } }

  /* Las actas de ciclo del curso de la ficha: [{ id, fecha, enviado, datos }], por fecha. Si de una fecha hay una traída y otra de la app, vale la de la app. */
  async function reunir(raiz, ficha) {
    var anio = g.anioInicioDeTextoCurso(ficha && ficha.curso), porId = {}, carpetas = [g.Envios.PARA, g.Envios.HECHAS];
    for (var c = 0; c < carpetas.length; c++) {
      var nombres = await raiz.listarJSON(carpetas[c]);
      for (var i = 0; i < nombres.length; i++) {
        var e = await leerBueno(raiz, carpetas[c] + '/' + nombres[i]);
        if (e && e.id && e.fecha && Array.isArray(e.puntos) && e.tipo !== 'reunion-familias' && g.anioInicioCurso(e.fecha) === anio) porId[e.id] = e;
      }
    }
    var lista = Object.keys(porId).map(function (k) { return porId[k]; });
    var deApp = {};
    lista.forEach(function (e) { if (e.origen !== 'traida') deApp[e.fecha] = true; });
    return lista.filter(function (e) { return e.origen !== 'traida' || !deApp[e.fecha]; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.enviado || '') < String(b.enviado || '') ? -1 : 1; });
  }

  /* Hace y guarda el libro. Devuelve { curso, pdf, docx, actas, fallos: [{ fecha, motivo }] } (pdf y docx: rutas en ACTAS). */
  async function crear(raiz, ficha) {
    var p = g.ActaModelo.problemaDeFichaActa(ficha);
    if (p) { var err = new Error(p); err.tipo = 'ajustes'; throw err; }
    var cm = await g.Colegio.paraDocumentos(raiz);
    var anio = g.anioInicioDeTextoCurso(ficha.curso), curso = anio + '-' + (anio + 1), lista = await reunir(raiz, ficha), modelos = [], fallos = [];
    lista.forEach(function (e) {
      try { modelos.push(e.origen === 'traida' ? g.ActaTraida.modeloDe(e) : g.ActaModelo.montar(ficha, e)); }
      catch (x) { fallos.push({ fecha: e.fecha, motivo: (x && x.message) || String(x) }); }
    });
    if (!modelos.length) { var vacio = new Error('Todavía no hay actas de este curso: crea una con «Nueva acta de ciclo» o trae las del documento antiguo.'); vacio.enEspanol = true; throw vacio; }
    var mem = cm.mem, opc = { pie: g.Membrete.textoPie(ficha.ciclo), tituloLibro: 'Libro de actas del curso ' + curso };
    var ruta = g.Envios.DOCS + '/' + curso + '/Libro de actas del curso ' + curso;
    await raiz.escribirBinario(ruta + '.pdf', await g.ActaPdf.crearLibro(modelos, mem, opc));
    await raiz.escribirBinario(ruta + '.docx', await g.ActaDocx.crearLibro(modelos, mem, opc));
    return { curso: curso, pdf: ruta + '.pdf', docx: ruta + '.docx', actas: modelos.length, fallos: fallos };
  }

  g.Libro = { reunir: reunir, crear: crear };
})(typeof window !== 'undefined' ? window : globalThis);
