/* «Atención a la diversidad» (fila 75): las tarjetas desde las que se llega a cada herramienta. El Programa de refuerzo (PRA, fila 75) y la «Petición a orientación» (fila 76). El paso de la app es 'diversidad' y `est.diversidad` dice qué herramienta está abierta. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  async function pintarDiversidad(est, alInicio) {
    if (est.diversidad === 'pra') {
      await g.PantallaPra.pintarPra(est, function () { est.diversidad = null; est.praActual = null; est.refrescar(); });
      return;
    }
    if (est.diversidad === 'peticion') {
      await g.PantallaPeticion.pintarPeticion(est, function () { est.diversidad = null; est.peticionActual = null; est.refrescar(); });
      return;
    }
    var tarjetas = [
      { id: 'tarjetaPra', titulo: 'Programa de refuerzo (PRA)', texto: 'Cuenta qué le pasa al alumno, marca las áreas y Claude escribe las cinco casillas de Séneca de cada una, listas para copiar.', abrir: function () { est.diversidad = 'pra'; est.praActual = null; est.refrescar(); } },
      { id: 'tarjetaPeticion', titulo: 'Petición a orientación', texto: 'El acta de la reunión del equipo docente y, a los tres meses, la solicitud de evaluación psicopedagógica, en PDF y Word.', abrir: function () { est.diversidad = 'peticion'; est.peticionActual = null; est.refrescar(); } }
    ];
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: alInicio }), h('h2', { class: 'subtitulo', texto: 'Atención a la diversidad' }),
        h('span', { class: 'derecha' }, [g.Ayuda.aviso('atencion-diversidad')])]),
      h('div', { class: 'dos-col', id: 'tarjetasDiversidad' }, tarjetas.map(function (t) {
        return h('section', { class: 'tarjeta', id: t.id }, [h('h3', { texto: t.titulo }), h('p', { class: 'suave', texto: t.texto }),
          h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton principal', 'data-accion': 'abrir-' + t.id, texto: 'Abrir', onclick: t.abrir })])]);
      }))
    ]);
  }

  g.PantallaDiversidad = { pintarDiversidad: pintarDiversidad };
})(window);
