/* Pantalla de inicio: «Nueva acta de ciclo» y la lista de borradores. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  function fila(est, b, refrescar) {
    var primero = g.Borradores.primerPunto(b);
    var confirmar = h('span', { class: 'confirmar', hidden: '' }, [
      h('span', { texto: '¿Borrar este borrador? ' }),
      h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'si-borrar', texto: 'Sí, borrar', onclick: async function () {
        await g.Datos.borrarBorrador(est.raiz, b.id); await refrescar();
      } }),
      h('button', { type: 'button', class: 'boton', 'data-accion': 'no-borrar', texto: 'No', onclick: function () { confirmar.hidden = true; botones.hidden = false; } })
    ]);
    var botones = h('span', { class: 'botones' }, [
      h('button', { type: 'button', class: 'boton principal', 'data-accion': 'seguir', texto: 'Seguir', onclick: function () { est.abrirBorrador(b); } }),
      h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'borrar', texto: 'Borrar', onclick: function () { botones.hidden = true; confirmar.hidden = false; } })
    ]);
    var fecha = '';
    try { fecha = g.fechaCorta(b.fecha); } catch (e) { fecha = 'sin fecha'; }
    return h('li', { class: 'borrador', 'data-id': b.id }, [
      h('div', { class: 'datos' }, [
        h('strong', { texto: 'Reunión del ' + fecha }),
        h('span', { class: 'primero', texto: primero || 'Aún sin puntos' }),
        h('span', { class: 'suave', texto: 'cambiado ' + g.Borradores.hace(b.cambiado, new Date()) })
      ]),
      botones, confirmar
    ]);
  }

  function filaEnviada(est, item, refrescar) {
    var e = item.envio, fecha = '';
    try { fecha = g.fechaCorta(e.fecha); } catch (x) { fecha = 'sin fecha'; }
    var primero = (e.puntos || []).map(function (p) { return p.titulo; }).filter(function (t) { return t && !g.Borradores.esPuntoAnterior(t); })[0] || '';
    var detalle = h('div', { class: 'detalle-enviada', hidden: '' }, (e.puntos || []).map(function (p, i) {
      return h('div', {}, [h('strong', { texto: (i + 1) + '. ' + p.titulo }), h('div', { class: 'texto-enviado', texto: p.fijo ? '(texto fijo de la lectura del acta anterior)' : (p.parrafo || g.Redaccion.TEXTO_PENDIENTE) })]);
    }));
    var botones = h('span', { class: 'botones' });
    if (item.estado === 'error') botones.appendChild(h('button', { type: 'button', class: 'boton principal', 'data-accion': 'reintentar', texto: 'Volver a intentar', onclick: async function () { await g.Envios.reintentar(est.raiz, e.id); await refrescar(); } }));
    botones.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'ver-enviada', texto: 'Ver lo que se envió', onclick: function () { detalle.hidden = !detalle.hidden; } }));
    return h('li', { class: 'borrador enviada ' + item.estado, 'data-id': e.id, 'data-estado': item.estado }, [
      h('div', { class: 'datos' }, [
        h('strong', { texto: 'Reunión del ' + fecha }),
        h('span', { class: 'primero', texto: primero }),
        h('span', { class: 'estado-envio ' + item.estado, texto: g.Envios.etiqueta(item) })
      ]), botones, detalle
    ]);
  }

  async function pintarInicio(est, refrescar) {
    var lista = await g.Datos.listarBorradores(est.raiz);
    var enviadas = await g.Envios.listar(est.raiz);
    var nodos = [h('button', { type: 'button', class: 'boton principal grande', id: 'nuevaActa', texto: 'Nueva acta de ciclo', onclick: function () { est.nuevoBorrador(); } })];
    nodos.push(h('button', { type: 'button', class: 'boton grande', id: 'nuevaConvocatoria', texto: 'Nueva convocatoria', onclick: function () { est.abrirConvocatoria(); } }));
    nodos.push(h('button', { type: 'button', class: 'boton grande', id: 'loHabitual', texto: 'Lo habitual', onclick: function () { est.abrirHabitual(); } }));
    nodos.push(h('button', { type: 'button', class: 'boton grande', id: 'fichasAlumnado', texto: 'Fichas del alumnado', onclick: function () { est.abrirFichas(); } }));
    nodos.push(h('button', { type: 'button', class: 'boton grande', id: 'entrevistaFamilia', texto: 'Entrevista con familia', onclick: function () { est.abrirEntrevista(); } }));
    nodos.push(h('h2', { class: 'subtitulo', texto: 'Borradores' }));
    if (!lista.length) nodos.push(h('p', { class: 'suave', id: 'sinBorradores', texto: 'No tienes borradores. Lo que escribas en una acta nueva se guarda solo aquí.' }));
    else nodos.push(h('ul', { class: 'borradores', id: 'listaBorradores' }, lista.map(function (b) { return fila(est, b, refrescar); })));
    nodos.push(h('h2', { class: 'subtitulo', texto: 'Enviadas' }));
    if (!enviadas.length) nodos.push(h('p', { class: 'suave', id: 'sinEnviadas', texto: 'Todavía no has enviado ningún acta al documento.' }));
    else nodos.push(h('ul', { class: 'borradores', id: 'listaEnviadas' }, enviadas.map(function (x) { return filaEnviada(est, x, refrescar); })));
    g.Dom.montar(nodos);
  }

  g.PantallaInicio = { pintarInicio: pintarInicio };
})(window);
