/* «Traer actas del documento antiguo» (fila 56), la parte que guarda: de un documento de actas en Word trae las de este curso a la carpeta ACTAS
   (datos + PDF + Word cada una) y rehace una tras revisarla. Sin pantalla: la carpeta entra por parámetro y se prueba con node --test.
   Usa acta-traida.js, acta-modelo.js, acta-pdf.js, acta-docx.js, membrete.js y envios.js. */
(function (g) {
  'use strict';

  async function leerBueno(raiz, ruta) { try { return await raiz.leerJSON(ruta); } catch (e) { return null; } }

  /* Las fechas de las actas de ciclo que ya están en la app (creadas con «Crear acta», esperando al documento o ya escritas en él), sin las traídas. */
  async function fechasDeLaApp(raiz) {
    var fechas = {}, carpetas = [g.Envios.PARA, g.Envios.HECHAS];
    for (var c = 0; c < carpetas.length; c++) {
      var nombres = await raiz.listarJSON(carpetas[c]);
      for (var i = 0; i < nombres.length; i++) {
        var e = await leerBueno(raiz, carpetas[c] + '/' + nombres[i]);
        if (e && e.id && e.fecha && e.origen !== 'traida' && e.tipo !== 'reunion-familias') fechas[e.fecha] = true;
      }
    }
    return fechas;
  }

  async function ficheros(ficha, datos) {
    var mem = await g.Membrete.cargar(), modelo = g.ActaTraida.modeloDe(datos);
    var opc = { colegio: g.ActaModelo.fichaParaActa(ficha).colegio || mem.colegio, pie: g.Membrete.textoPie(ficha.ciclo) };
    return { pdf: await g.ActaPdf.crear(modelo, mem, opc), docx: await g.ActaDocx.crear(modelo, mem, opc) };
  }

  function problema(ficha) {
    var p = g.ActaModelo.problemaDeFichaActa(ficha);
    if (p) { var e = new Error(p); e.tipo = 'ajustes'; throw e; }
  }

  /* bloques: lo que devuelve DocxBloques.leerBloques(). Devuelve { traidas: [datos guardados], deOtroCurso, yaEstaban, encontradas }. */
  async function traer(raiz, ficha, bloques, nombre, ahora) {
    problema(ficha);
    var actas = g.ActaTraida.leerDocumento(bloques);
    if (!actas.length) throw new Error('No he encontrado actas en «' + nombre + '». Busco el recuadro del título con «Celebrada el día dd/mm/aaaa».');
    var yaHay = await fechasDeLaApp(raiz), res = { traidas: [], deOtroCurso: 0, yaEstaban: 0, encontradas: actas.length }, vistas = {};
    var curso = g.cursoEscolar(g.anioInicioDeTextoCurso(ficha.curso) + '-09-01');
    for (var i = 0; i < actas.length; i++) {
      var a = actas[i];
      if (!g.ActaTraida.clasificar(a, ficha).delCurso) { res.deOtroCurso++; continue; }
      if (yaHay[a.fecha]) { res.yaEstaban++; continue; }
      vistas[a.fecha] = (vistas[a.fecha] || 0) + 1;
      var datos = g.ActaTraida.datos(a, 'traida-' + a.fecha + (vistas[a.fecha] > 1 ? '-' + vistas[a.fecha] : ''), nombre, ahora), f = await ficheros(ficha, datos);
      res.traidas.push(await g.Envios.guardarTraida(raiz, datos, f.pdf, f.docx, curso));
    }
    return res;
  }

  /* Rehace el PDF y el Word de un acta traída ya revisada (datos: lo guardado, con los cambios de Inma). */
  async function guardarRevisada(raiz, ficha, datos) {
    problema(ficha);
    g.ActaTraida.recalcular(datos);
    var f = await ficheros(ficha, datos);
    return g.Envios.guardarTraida(raiz, datos, f.pdf, f.docx, datos.documentos.curso);
  }

  function actas(n) { return n + (n === 1 ? ' acta' : ' actas'); }
  /* La frase del aviso: «He traído 2 actas de este curso. Hay 12 de otro curso que no he traído.» */
  function mensaje(r) {
    var t = r.traidas.length ? 'He traído ' + actas(r.traidas.length) + ' de este curso.' : 'No he traído ninguna acta de este curso.';
    if (r.deOtroCurso) t += ' Hay ' + r.deOtroCurso + ' de otro curso que no he traído.';
    if (r.yaEstaban) t += ' ' + (r.yaEstaban === 1 ? '1 ya estaba en la app y no la he tocado.' : r.yaEstaban + ' ya estaban en la app y no las he tocado.');
    return t;
  }

  g.Traer = { traer: traer, guardarRevisada: guardarRevisada, mensaje: mensaje, fechasDeLaApp: fechasDeLaApp };
})(typeof window !== 'undefined' ? window : globalThis);
