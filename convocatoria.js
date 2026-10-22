/* «Nueva convocatoria» (fila 17): los puntos de una reunión, guardados por fecha en ACTAS/convocatorias/<aaaa-mm-dd>.json, el correo para
   convocarla y el paso a los puntos del borrador del acta. Sin pantalla: la carpeta entra por parámetro y se prueba con node --test.
   { formato, fecha, hora, puntos: [{ titulo, huecos, porGrupo? }], creado, cambiado }. Usa habitual.js, borradores.js y fechas.js. */
(function (g) {
  'use strict';
  var DIR = 'convocatorias';
  var H = g.Habitual, B = g.Borradores;

  function ruta(fecha) { return DIR + '/' + fecha + '.json'; }

  async function leer(raiz, fecha) {
    try { var c = await raiz.leerJSON(ruta(fecha)); return c && Array.isArray(c.puntos) ? c : null; } catch (e) { return null; }
  }

  /* Todas, la reunión más próxima en el futuro y las pasadas después: simplemente de la fecha más reciente a la más antigua. */
  async function listar(raiz) {
    var nombres = await raiz.listarJSON(DIR), res = [];
    for (var i = 0; i < nombres.length; i++) { var c = await leer(raiz, nombres[i].replace(/\.json$/, '')); if (c && c.fecha) res.push(c); }
    return res.sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
  }

  async function borrar(raiz, fecha) { await raiz.borrar(ruta(fecha), false); }

  /* La convocatoria que se propone para una fecha: lo obligatorio y lo habitual de ese mes. */
  function proponer(habitual, fecha, hora, ahora) {
    var marca = (ahora || new Date()).toISOString();
    return { formato: 1, fecha: fecha, hora: hora || '13:00', puntos: H.proponer(habitual, H.mesDe(fecha)), creado: marca, cambiado: marca };
  }

  function tieneTexto(p) { return !!(String(p.notas || '').trim() || String(p.parrafo || '').trim()); }
  function igual(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }

  /* Pone en el borrador los puntos de la convocatoria sin perder nada de lo escrito:
     un punto que ya estaba conserva sus notas; uno nuevo entra vacío; uno que Inma quitó de la convocatoria se va del borrador
     solo si no tenía notas (si las tenía se queda, al final); y los que Inma añadió a mano en el acta (nunca estuvieron en la convocatoria) se quedan. */
  function aplicarAlBorrador(b, conv, anterior, ficha) {
    var deseados = conv.puntos.map(function (p) { return p.titulo; }), viejos = anterior ? anterior.puntos.map(function (p) { return p.titulo; }) : [];
    var hayActaAnterior = !!(ficha && ficha.ultimaActa), usado = {}, puntos = [];
    deseados.forEach(function (t) {
      var i = -1;
      b.puntos.forEach(function (p, k) { if (i < 0 && !usado[k] && igual(p.titulo, t)) i = k; });
      if (i >= 0) { usado[i] = true; puntos.push(b.puntos[i]); }
      else if (!H.esAnterior(t) || hayActaAnterior) puntos.push({ titulo: t, notas: '' });
    });
    b.puntos.forEach(function (p, k) {
      if (usado[k]) return;
      var estabaEnLaConvocatoria = viejos.some(function (t) { return igual(p.titulo, t); });
      if (tieneTexto(p) || !estabaEnLaConvocatoria) puntos.push(p);
    });
    b.puntos = puntos;
    return b;
  }

  /* Guarda la convocatoria y, si ya hay un borrador del acta de esa fecha, le pasa los puntos nuevos. */
  async function guardar(raiz, conv, ficha, ahora) {
    var antes = await leer(raiz, conv.fecha), marca = (ahora || new Date());
    conv.cambiado = marca.toISOString(); if (!conv.creado) conv.creado = conv.cambiado;
    await raiz.escribirJSON(ruta(conv.fecha), conv);
    var borradores = await g.Datos.listarBorradores(raiz);
    for (var i = 0; i < borradores.length; i++) {
      if (borradores[i].fecha !== conv.fecha) continue;
      aplicarAlBorrador(borradores[i], conv, antes, ficha);
      await g.Datos.guardarBorrador(raiz, borradores[i], marca);
    }
    return conv;
  }

  /* Un borrador nuevo para la fecha de la convocatoria, con sus puntos. */
  function borradorNuevo(conv, ficha, ahora) {
    var b = B.nuevo(ficha, conv.fecha, ahora || new Date());
    b.inicio = conv.hora || b.inicio; b.puntos = [];
    return aplicarAlBorrador(b, conv, null, ficha);
  }

  /* El borrador del acta de esa reunión: el que ya existe para la fecha (con los puntos al día) o uno nuevo. */
  async function borradorDe(raiz, conv, ficha, ahora) {
    var existentes = (await g.Datos.listarBorradores(raiz)).filter(function (b) { return b.fecha === conv.fecha; });
    if (existentes.length) return aplicarAlBorrador(existentes[0], conv, conv, ficha);
    return borradorNuevo(conv, ficha, ahora);
  }

  function asunto(fecha) { return 'Convocatoria reunión de ciclo — ' + g.fechaEnLetra(fecha); }

  function texto(conv, ficha) {
    var lineas = ['Buenos días:', '', 'Se convoca la reunión del equipo de ciclo el ' + g.fechaEnLetra(conv.fecha) + ' a las ' + g.horaNormal(conv.hora || '13:00') + ' horas, con el siguiente orden del día:', ''];
    conv.puntos.forEach(function (p, i) { lineas.push((i + 1) + '. ' + p.titulo); });
    lineas.push('', 'Un saludo' + (ficha && ficha.coordinadoraNombre ? ',' : '.'));
    if (ficha && ficha.coordinadoraNombre) lineas.push(ficha.coordinadoraNombre);
    return lineas.join('\n');
  }

  /* El enlace que abre el programa de correo de Inma con el asunto y el texto; ella pone los destinatarios y lo envía. */
  function mailto(conv, ficha) {
    return 'mailto:?subject=' + encodeURIComponent(asunto(conv.fecha)) + '&body=' + encodeURIComponent(texto(conv, ficha).replace(/\n/g, '\r\n'));
  }

  g.Convocatoria = { DIR: DIR, leer: leer, listar: listar, borrar: borrar, proponer: proponer, aplicarAlBorrador: aplicarAlBorrador, guardar: guardar,
    borradorNuevo: borradorNuevo, borradorDe: borradorDe, asunto: asunto, texto: texto, mailto: mailto };
})(typeof window !== 'undefined' ? window : globalThis);
