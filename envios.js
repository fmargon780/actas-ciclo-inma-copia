/* Las actas ya hechas: ACTAS/para-el-documento/<id>.json (esperando al documento de Google; las de antes de la fila 55), <id>.error.txt (el documento no pudo),
   ACTAS/enviadas/<id>.json (ya escritas en el documento, montadas por la app: `montadaPor: 'app'`, o traídas del documento antiguo: `origen: 'traida'`) y ACTAS/documentos/<curso>/<fecha> Acta equipo de ciclo.pdf/.docx. */
(function (g) {
  'use strict';
  var PARA = 'para-el-documento', HECHAS = 'enviadas', MAXIMO = 10;

  /* Guarda el acta terminada para que la recoja el documento y borra el borrador. */
  async function enviar(raiz, envio) {
    await raiz.escribirJSON(PARA + '/' + envio.id + '.json', envio);
    await g.Datos.borrarBorrador(raiz, envio.id);
  }

  async function leerBueno(raiz, ruta) { try { return await raiz.leerJSON(ruta); } catch (e) { return null; } }

  var BASE = 'Acta equipo de ciclo', DOCS = 'documentos';
  /* Las cuatro subcarpetas de ACTAS/documentos/<curso>/ (fila 94): cada papel va a la de su tipo. */
  var SUB = { actas: 'Actas de ciclo', familias: 'Familias', evaluacion: 'Evaluación', diversidad: 'Atención a la diversidad' };
  function carpeta(curso, sub) { return DOCS + '/' + curso + '/' + sub; }
  /* «ACTAS › documentos › 2026-2027 › Evaluación» a partir de la ruta de un fichero guardado (o de su carpeta). */
  function carpetaTexto(ruta) { return 'ACTAS › ' + String(ruta).split('/').slice(0, -1).join(' › '); }
  /* ¿Se pueden reutilizar los ficheros que ya tiene el papel (los sustituye al rehacerlo)? Solo si ya están en su subcarpeta y empiezan por la misma fecha. */
  function reutilizable(docs, curso, fecha, sub) {
    return !!(docs && docs.curso === curso && String(docs.base).indexOf(fecha) === 0 && String(docs.pdf || '').indexOf(carpeta(curso, sub) + '/') === 0);
  }

  /* El nombre sin extensión para los ficheros del acta: «2026-09-07 Acta equipo de ciclo». Si ya existe otra acta (otro id) con ese nombre,
     «… (2)», «… (3)»; si es la misma acta (mismo id) vuelve a ser el suyo, para sustituir sus ficheros. */
  async function nombreLibre(raiz, curso, fecha, id) {
    var previo = await leerBueno(raiz, HECHAS + '/' + id + '.json');
    if (previo && reutilizable(previo.documentos, curso, fecha, SUB.actas)) return previo.documentos.base;
    var usados = ((await raiz.listar(carpeta(curso, SUB.actas))) || []).map(function (x) { return x.nombre; });
    var base = fecha + ' ' + BASE, n = 1, candidato = base;
    while (usados.indexOf(candidato + '.pdf') >= 0 || usados.indexOf(candidato + '.docx') >= 0) { n++; candidato = base + ' (' + n + ')'; }
    return candidato;
  }

  /* Guarda el PDF, el Word y los datos del acta (en enviadas/, ya recogida: el documento de Google no la escribe) y borra el borrador.
     Los ficheros van primero: si algo falla, el borrador sigue ahí. Devuelve el envío guardado. */
  async function guardarCreada(raiz, envio, pdf, docx, curso) {
    var base = await nombreLibre(raiz, curso, envio.fecha, envio.id), ruta = carpeta(curso, SUB.actas) + '/' + base;
    await raiz.escribirBinario(ruta + '.pdf', pdf);
    await raiz.escribirBinario(ruta + '.docx', docx);
    var guardado = Object.assign({}, envio, { montadaPor: 'app', documentos: { curso: curso, base: base, pdf: ruta + '.pdf', docx: ruta + '.docx' } });
    await raiz.escribirJSON(HECHAS + '/' + envio.id + '.json', guardado);
    await g.Datos.borrarBorrador(raiz, envio.id);
    return guardado;
  }

  /* Guarda un acta traída del documento antiguo (o la rehace tras revisarla): su PDF, su Word y sus datos en enviadas/. Misma acta (mismo id) = mismos ficheros. */
  async function guardarTraida(raiz, datos, pdf, docx, curso) {
    var base = await nombreLibre(raiz, curso, datos.fecha, datos.id), ruta = carpeta(curso, SUB.actas) + '/' + base;
    await raiz.escribirBinario(ruta + '.pdf', pdf);
    await raiz.escribirBinario(ruta + '.docx', docx);
    var guardado = Object.assign({}, datos, { documentos: { curso: curso, base: base, pdf: ruta + '.pdf', docx: ruta + '.docx' } });
    await raiz.escribirJSON(HECHAS + '/' + datos.id + '.json', guardado);
    return guardado;
  }

  var TIPOS = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  /* Abre (PDF) o descarga (Word) el fichero guardado de un acta creada por la app. Devuelve 'abierto', 'descargado' o 'falta'. */
  async function abrir(raiz, envio, tipo) {
    var ruta = envio.documentos && envio.documentos[tipo];
    var f = ruta ? await raiz.abrirArchivo(ruta) : null;
    if (!f) return 'falta';
    return g.Dom.abrirFichero(f, ruta.split('/').pop(), TIPOS[tipo]);
  }

  /* Las actas de ciclo que ya existen, para saber cuál es la «acta anterior» de una nueva: [{ id, fecha }] (esperando, escritas y creadas por la app). */
  async function fechasHechas(raiz) {
    var l = [];
    for (var d = 0; d < 2; d++) {
      var dir = d ? HECHAS : PARA, nombres = await raiz.listarJSON(dir);
      for (var i = 0; i < nombres.length; i++) {
        var e = await leerBueno(raiz, dir + '/' + nombres[i]);
        if (e && e.id && e.fecha && e.tipo !== 'reunion-familias') l.push({ id: e.id, fecha: e.fecha });
      }
    }
    return l;
  }

  /* Fechas (aaaa-mm-dd) de las actas que esperan en el documento: para fijar la «acta anterior» del siguiente envío. */
  async function fechasEsperando(raiz) {
    var l = [], nombres = await raiz.listarJSON(PARA);
    for (var i = 0; i < nombres.length; i++) { var e = await leerBueno(raiz, PARA + '/' + nombres[i]); if (e && e.fecha) l.push(e.fecha); }
    return l;
  }

  /* Lo que se enseña en «Enviadas»: [{ envio, estado: 'esperando' | 'error' | 'hecha', motivo }], lo más reciente primero, 10 como mucho. */
  async function listar(raiz) {
    var res = [], nombres = await raiz.listarJSON(PARA), i, e;
    for (i = 0; i < nombres.length; i++) {
      e = await leerBueno(raiz, PARA + '/' + nombres[i]);
      if (!e || !e.id) continue;
      var motivo = await raiz.leerTexto(PARA + '/' + e.id + '.error.txt');
      res.push(motivo ? { envio: e, estado: 'error', motivo: motivo.trim() } : { envio: e, estado: 'esperando', motivo: '' });
    }
    var hechas = (await raiz.listarJSON(HECHAS)).sort().reverse().slice(0, MAXIMO);
    for (i = 0; i < hechas.length; i++) {
      e = await leerBueno(raiz, HECHAS + '/' + hechas[i]);
      if (e && e.id) res.push({ envio: e, estado: e.origen === 'traida' ? 'traida' : e.montadaPor === 'app' ? 'creada' : 'hecha', motivo: '' });
    }
    return res.sort(function (a, b) { return String(a.envio.enviado) < String(b.envio.enviado) ? 1 : -1; }).slice(0, MAXIMO);
  }

  /* «Volver a intentar»: sin el aviso de error, el documento lo vuelve a recoger. */
  async function reintentar(raiz, id) { await raiz.borrar(PARA + '/' + id + '.error.txt', false); }

  var ETIQUETAS = { esperando: 'Esperando al documento', hecha: 'En el documento' };
  function diaCreada(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  function etiqueta(item) {
    if (item.estado === 'creada') return 'Creada el ' + diaCreada(item.envio.enviado);
    if (item.estado === 'traida') return 'Traída del documento antiguo';
    return item.estado === 'error' ? 'No se pudo llevar al documento: ' + item.motivo : ETIQUETAS[item.estado];
  }

  g.Envios = { PARA: PARA, HECHAS: HECHAS, DOCS: DOCS, SUB: SUB, carpeta: carpeta, carpetaTexto: carpetaTexto, reutilizable: reutilizable, enviar: enviar, nombreLibre: nombreLibre, guardarCreada: guardarCreada, guardarTraida: guardarTraida, abrir: abrir, fechasHechas: fechasHechas, fechasEsperando: fechasEsperando, listar: listar, reintentar: reintentar, etiqueta: etiqueta };
})(typeof window !== 'undefined' ? window : globalThis);
