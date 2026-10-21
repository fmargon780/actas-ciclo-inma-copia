/* Las actas enviadas al documento: ACTAS/para-el-documento/<id>.json (esperando), <id>.error.txt (el documento no pudo) y ACTAS/enviadas/<id>.json (ya escritas). */
(function (g) {
  'use strict';
  var PARA = 'para-el-documento', HECHAS = 'enviadas', MAXIMO = 10;

  /* Guarda el acta terminada para que la recoja el documento y borra el borrador. */
  async function enviar(raiz, envio) {
    await raiz.escribirJSON(PARA + '/' + envio.id + '.json', envio);
    await g.Datos.borrarBorrador(raiz, envio.id);
  }

  async function leerBueno(raiz, ruta) { try { return await raiz.leerJSON(ruta); } catch (e) { return null; } }

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
      if (e && e.id) res.push({ envio: e, estado: 'hecha', motivo: '' });
    }
    return res.sort(function (a, b) { return String(a.envio.enviado) < String(b.envio.enviado) ? 1 : -1; }).slice(0, MAXIMO);
  }

  /* «Volver a intentar»: sin el aviso de error, el documento lo vuelve a recoger. */
  async function reintentar(raiz, id) { await raiz.borrar(PARA + '/' + id + '.error.txt', false); }

  var ETIQUETAS = { esperando: 'Esperando al documento', hecha: 'En el documento' };
  function etiqueta(item) { return item.estado === 'error' ? 'No se pudo llevar al documento: ' + item.motivo : ETIQUETAS[item.estado]; }

  g.Envios = { PARA: PARA, HECHAS: HECHAS, enviar: enviar, fechasEsperando: fechasEsperando, listar: listar, reintentar: reintentar, etiqueta: etiqueta };
})(typeof window !== 'undefined' ? window : globalThis);
