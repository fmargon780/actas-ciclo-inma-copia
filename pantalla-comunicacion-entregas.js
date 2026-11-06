/* Autorizaciones entregadas (fila 109): en una autorización ya creada, la lista del grupo con una casilla por alumno y «N de M». «Ver solo las que faltan» y «Ver todos».
   Pasada la fecha límite, las que faltan salen en ámbar. Lo usa pantalla-comunicacion-editor.js. ctx: { c, cambio, hoy (aaaa-mm-dd), alCambiar }. */
(function (g) {
  'use strict';
  var h = g.Dom.h, C = g.Comunicacion;

  function tarjeta(ctx) {
    var c = ctx.c, soloFaltan = false, caja = h('section', { class: 'tarjeta ancha', id: 'entregasComunicacion' });
    function pintar() {
      caja.textContent = '';
      var n = C.contarEntregas(c), pasada = C.pasadaLimite(c, ctx.hoy);
      var cab = [h('h3', { texto: 'Autorizaciones entregadas' })];
      if (!n.total) {
        caja.appendChild(h('div', { class: 'barra-form' }, cab));
        caja.appendChild(h('div', { class: 'aviso', id: 'sinListaEntregas', texto: 'No tengo la lista del alumnado de ' + c.grupo + '. Abre la pestaña Rúbricas, sube ahí el listado del grupo y vuelve a entrar.' }));
        return;
      }
      cab.push(h('span', { class: 'etiqueta ' + (n.todas ? 'hecho' : 'cambiadas'), id: 'cuentaEntregas', texto: n.si + ' de ' + n.total }));
      cab.push(h('span', { class: 'suave', texto: 'Antes del ' + g.fechaCorta(c.salida.limite) }));
      cab.push(h('button', { type: 'button', class: 'boton chico', id: 'soloFaltan', texto: soloFaltan ? 'Ver todos' : 'Ver solo las que faltan', onclick: function () { soloFaltan = !soloFaltan; pintar(); } }));
      caja.appendChild(h('div', { class: 'barra-form' }, cab));
      if (soloFaltan && n.todas) { caja.appendChild(h('p', { class: 'suave', id: 'todasEntregadas', texto: 'Ya han entregado todas.' })); return; }
      var cajas = [];
      c.entregas.forEach(function (x, i) {
        if (soloFaltan && x.entregada) return;
        var casilla = h('input', { type: 'checkbox', 'data-entrega': String(i), 'aria-label': x.nombre });
        casilla.checked = !!x.entregada;
        casilla.onchange = function () { x.entregada = casilla.checked; ctx.cambio(); pintar(); if (ctx.alCambiar) ctx.alCambiar(); };
        cajas.push(h('label', { class: 'entrega' + (!x.entregada && pasada ? ' falta' : ''), 'data-alumno': x.nombre }, [casilla, ' ' + x.nombre]));
      });
      caja.appendChild(h('div', { class: 'entregas', id: 'listaEntregas' }, cajas));
    }
    pintar();
    return caja;
  }

  g.PantallaComunicacionEntregas = { tarjeta: tarjeta };
})(window);
