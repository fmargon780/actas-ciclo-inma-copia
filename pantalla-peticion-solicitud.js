/* El paso 2 de la petición a orientación (fila 76): la solicitud de evaluación psicopedagógica. «Hacer la solicitud» (con el motivo si se adelanta antes de la revisión),
   lo observado y las medidas del acta ya copiados, «Cómo han ido las medidas» y el bloque de redacción (pantalla-peticion-texto.js). Lo usa pantalla-peticion.js. */
(function (g) {
  'use strict';
  var h = g.Dom.h, P = g.Peticion, TX = g.PantallaPeticionTexto;

  /* Los botones de después del acta: «Hacer la solicitud» (con la pregunta del motivo si todavía no llegó la revisión), «Las medidas han funcionado» y «Reabrir». */
  function acciones(est, p, hoy, cambio) {
    var zona = h('div', { class: 'fila', id: 'accionesPeticion' }), pregunta = h('div', { id: 'preguntaMotivo' });
    function guardarYRepintar() { cambio(); est.refrescar(); }
    function pintarPregunta() {
      pregunta.textContent = '';
      var motivo = h('select', { id: 'motivoAdelanto' }, P.MOTIVOS.map(function (m) { return h('option', { value: m, texto: m }); })), linea = h('input', { type: 'text', id: 'motivoLinea', placeholder: 'Si quieres, añade una línea' });
      pregunta.appendChild(h('div', { class: 'aviso pregunta', id: 'preguntaAdelantar' }, [h('p', { texto: 'Todavía no han pasado los tres meses (la revisión es el ' + g.fechaCorta(p.revision) + '). ¿Por qué adelantas la solicitud?' }),
        h('div', { class: 'fila' }, [motivo, linea, h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'si-adelantar', texto: 'Hacer la solicitud', onclick: function () {
          P.iniciarSolicitud(p, hoy, { motivo: motivo.value, linea: linea.value }); guardarYRepintar();
        } }), h('button', { type: 'button', class: 'boton chico', 'data-accion': 'no-adelantar', texto: 'Ahora no', onclick: function () { pregunta.textContent = ''; } })])]));
    }
    if (p.estado === 'medidas' && !p.solicitud) {
      zona.appendChild(h('button', { type: 'button', class: 'boton principal', id: 'hacerSolicitud', texto: 'Hacer la solicitud', onclick: function () {
        if (P.llegoLaRevision(p, hoy)) { P.iniciarSolicitud(p, hoy, null); guardarYRepintar(); } else pintarPregunta();
      } }));
    }
    if (p.estado === 'medidas') zona.appendChild(h('button', { type: 'button', class: 'boton', id: 'cerrarPeticion', texto: 'Las medidas han funcionado', onclick: function () { P.cerrar(p); guardarYRepintar(); } }));
    if (p.estado === 'cerrada') zona.appendChild(h('button', { type: 'button', class: 'boton', id: 'reabrirPeticion', texto: 'Reabrir', onclick: function () { P.reabrir(p); guardarYRepintar(); } }));
    return h('div', {}, [zona, pregunta]);
  }

  /* La parte de la solicitud: cajas de lo observado, las medidas y cómo han ido, y el bloque de redacción. ctx: { cambio, tut, todos, hoy }. */
  function solicitud(est, p, ctx) {
    var s = p.solicitud, texto = null;
    function alCambiar() { ctx.cambio(); if (texto) texto.notasCambiaron(); }
    texto = TX.crear(est, {
      id: 'solicitud', titulo: 'La solicitud', almacen: s, campo: 'texto', todos: ctx.todos, cambio: ctx.cambio, etiquetaCrear: s.documentos ? 'Crear la solicitud otra vez' : 'Crear solicitud',
      firma: function () { return P.firmaSolicitud(p); }, problemaRedactar: function () { return P.problemaSolicitud(p); }, problemaCrear: function () { return P.problemaSolicitud(p); },
      redactar: function (clave, op) { return g.PeticionClaude.redactarSolicitud(clave, p, ctx.todos, op); },
      crear: function () { return g.PeticionDocs.crearSolicitud(est.raiz, p, est.ficha, ctx.tut, new Date()); },
      alCrear: function () { est.refrescar(); },
      textoCreado: function (d) { return 'La solicitud está en PDF y en Word, en la carpeta ' + g.Envios.carpetaTexto(d.pdf) + '. Entrégala en jefatura de estudios. '; }
    });
    var motivo = s.motivoAdelanto ? h('p', { class: 'suave', id: 'motivoGuardado', texto: 'Solicitud adelantada: ' + s.motivoAdelanto + '.' }) : null;
    return h('div', { id: 'solicitudPeticion' }, [
      h('section', { class: 'tarjeta ancha' }, [h('h3', { texto: 'Solicitud de evaluación psicopedagógica' }, [g.Ayuda.aviso('peticion-solicitud')]), motivo,
        h('p', { class: 'suave', texto: 'Lo observado y las medidas vienen copiados del acta. Puedes retocarlos aquí; el acta no cambia.' }),
        TX.cajaNotas(est, 'sol-observado', 'Lo observado', '', s.observado, function (t) { s.observado = t; alCambiar(); }),
        TX.cajaNotas(est, 'sol-medidas', 'Medidas aplicadas', '', s.medidas, function (t) { s.medidas = t; alCambiar(); }),
        TX.cajaNotas(est, 'sol-como', 'Cómo han ido las medidas', 'Cuenta qué ha cambiado y qué sigue igual.', s.comoHaIdo, function (t) { s.comoHaIdo = t; alCambiar(); })]),
      texto.nodo
    ]);
  }

  g.PantallaPeticionSolicitud = { acciones: acciones, solicitud: solicitud };
})(window);
