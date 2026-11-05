/* La memoria final de tutoría en ficheros (fila 108): «Crear PDF y Word» monta los dos con el membrete del colegio y los guarda en ACTAS/documentos/<curso>/Evaluación/.
   Primero «El curso en cifras» (las cifras y la tabla, tal como las calculó la app) y luego los cinco apartados; al final, la línea de firma.
   Reutiliza los generadores del acta de ciclo (acta-pdf.js y acta-docx.js) con un modelo propio. Si la memoria ya tenía ficheros, los nuevos los sustituyen.
   Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var M = g.Memoria, CURSO_EN_CIFRAS = 'El curso en cifras';

  function sinRaros(t) { return String(t).replace(/[\\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim(); }
  function titulo(m) { return M.NOMBRE.toUpperCase() + ' — ' + m.grupo + ' — ' + m.curso; }

  function celda(col, t, negrita, fondo) { return { col: col, span: 1, vm: null, rs: 1, fondo: fondo || null, parrafos: [{ runs: [negrita ? { t: t, b: true } : { t: t }] }] }; }
  function tablaCifras(d) { return { anchos: [2, 3], filas: d.cifras.map(function (c) { return [celda(0, c.etiqueta, true, 'EEEEEE'), celda(1, c.valor, false)]; }) }; }
  function tablaAreas(d) {
    var cab = [celda(0, '% con dificultades', true, 'EEEEEE')].concat(d.sesiones.map(function (s, i) { return celda(i + 1, s.nombre, true, 'EEEEEE'); }));
    return { anchos: [3, 1, 1, 1, 1], filas: [cab].concat(d.tabla.areas.map(function (a) {
      return [celda(0, a.nombre, false)].concat(a.valores.map(function (v, i) { return celda(i + 1, M.casilla(v), false, v === 'falta' ? 'FFF2CC' : null); }));
    })) };
  }

  /* m: la memoria; d: lo que la app sabe (Memoria.datos); tut: { grupo, tutora } o null; localidad: de la ficha del curso. Devuelve el modelo para ActaPdf / ActaDocx. */
  function montar(m, d, tut, localidad) {
    var filas = [['GRUPO:', [m.grupo]], ['CURSO ESCOLAR:', [m.curso]]];
    var tutora = tut && String(tut.tutora || '').trim();
    if (tutora) filas.push(['TUTOR / A', [tutora]]);
    var apartados = M.APARTADOS.filter(function (a) { return String(M.texto(m, a.id)).trim(); });
    var asuntos = [], puntos = [];
    if (d && d.hayDatos) {
      var lineas = [{ tabla: tablaCifras(d) }];
      if (d.tabla) lineas.push({ tabla: tablaAreas(d) });
      asuntos.push({ titulo: CURSO_EN_CIFRAS, lineas: lineas });
      puntos.push(CURSO_EN_CIFRAS);
    }
    apartados.forEach(function (a) { puntos.push(a.titulo); asuntos.push({ titulo: a.titulo, lineas: g.lineasDeParrafo(M.texto(m, a.id)) }); });
    var fecha = g.ReunionModelo.fechaEnMayusculas(m.fecha), loc = String(localidad || '').trim();
    return {
      titulo: titulo(m), celebrada: 'Fecha de la memoria: ' + g.fechaLarga(m.fecha), encabezados: { puntos: 'CONTENIDO DE LA MEMORIA', asuntos: 'MEMORIA' }, filas: filas,
      puntos: puntos, asuntos: asuntos, cierre: ['Firma del tutor o tutora: ______________________', loc ? 'En ' + loc + ' a ' + fecha : fecha]
    };
  }

  async function opciones(raiz) {
    var cm = await g.Colegio.paraDocumentos(raiz);
    return { mem: cm.mem, opc: { pie: M.NOMBRE } };
  }

  /* «2027-06-24 Memoria final de tutoría · 6º A» (sin extensión). */
  function nombreBase(m) { return m.fecha + ' ' + M.NOMBRE + ' · ' + sinRaros(m.grupo); }

  /* Los mismos ficheros de la memoria si siguen siendo suyos; si no, un nombre libre (« (2)» si ya hay otro con ese nombre). */
  async function nombreLibre(raiz, m) {
    var E = g.Envios, d = m.documentos;
    if (d && d.base === nombreBase(m) && E.reutilizable(d, m.curso, m.fecha, E.SUB.evaluacion)) return d.base;
    var usados = ((await raiz.listar(E.carpeta(m.curso, E.SUB.evaluacion))) || []).map(function (x) { return x.nombre; });
    var base = nombreBase(m), n = 1, candidato = base;
    while (usados.indexOf(candidato + '.pdf') >= 0 || usados.indexOf(candidato + '.docx') >= 0) { n++; candidato = base + ' (' + n + ')'; }
    return candidato;
  }

  /* Monta y guarda el PDF y el Word, y deja la memoria marcada como creada (con dónde están sus ficheros y la firma de lo que llevan).
     Los ficheros van primero: si falla, no se marca. Los anteriores, si tenían otro nombre (otra fecha), se quitan: los nuevos los sustituyen. */
  async function crear(raiz, m, d, ficha, tut, ahora) {
    var o = await opciones(raiz), modelo = montar(m, d, tut, ficha && ficha.localidad), E = g.Envios;
    var pdf = await g.ActaPdf.crear(modelo, o.mem, o.opc), docx = await g.ActaDocx.crear(modelo, o.mem, o.opc);
    var base = await nombreLibre(raiz, m), ruta = E.carpeta(m.curso, E.SUB.evaluacion) + '/' + base, previo = m.documentos;
    await raiz.escribirBinario(ruta + '.pdf', pdf);
    await raiz.escribirBinario(ruta + '.docx', docx);
    if (previo && previo.base !== base) {
      var carpeta = E.carpeta(previo.curso || m.curso, E.SUB.evaluacion) + '/';
      for (var k = 0; k < 2; k++) {
        var vieja = k ? previo.docx : previo.pdf;
        if (vieja && String(vieja).indexOf(carpeta) === 0) { try { await raiz.borrar(vieja, false); } catch (x) { /* ya no estaba */ } }
      }
    }
    m.documentos = { curso: m.curso, base: base, pdf: ruta + '.pdf', docx: ruta + '.docx', firma: M.firmaPapel(m, d) };
    await M.guardar(raiz, m, ahora);
    return m;
  }

  g.MemoriaDocs = { titulo: titulo, montar: montar, nombreBase: nombreBase, nombreLibre: nombreLibre, crear: crear };
})(typeof window !== 'undefined' ? window : globalThis);
