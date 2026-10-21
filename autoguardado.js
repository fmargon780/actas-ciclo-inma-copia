/* Guardado automático del borrador: cada cambio se escribe solo, con una pequeña espera para no guardar en cada tecla. */
(function (g) {
  'use strict';
  var ESPERA_MS = 600;

  /* Devuelve { cambio, guardar }. También deja en est.alSalir lo que hay que esperar antes de cambiar de pantalla. */
  function crear(est, b) {
    var estado = est.estadoGuardado, temporizador = null, pendiente = false, guardando = Promise.resolve();
    function decir(t) { estado.textContent = t; }
    function guardar() {
      pendiente = false; clearTimeout(temporizador);
      decir('Guardando…');
      guardando = guardando.then(function () { return g.Datos.guardarBorrador(est.raiz, b, new Date()); })
        .then(function () { if (!pendiente) decir('Guardado'); })
        .catch(function (e) { decir('No se ha podido guardar: ' + (e.message || e)); });
      return guardando;
    }
    function cambio() { pendiente = true; decir('Guardando…'); clearTimeout(temporizador); temporizador = setTimeout(guardar, ESPERA_MS); }
    est.alSalir = function () { return pendiente ? guardar() : guardando; };
    return { cambio: cambio, guardar: guardar };
  }

  g.Autoguardado = { crear: crear };
})(window);
