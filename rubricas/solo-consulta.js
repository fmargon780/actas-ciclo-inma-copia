/* Curso pasado = solo para consultar. Mientras se mira un curso pasado, este vigilante quita de la pantalla los botones que crean,
   cambian, califican o piden algo a Claude, y deja de lado los campos para que solo se lean. Se ejecuta cada vez que la pantalla cambia.
   (Además, `Cursos.vista` se niega a escribir en un curso pasado: son dos cerrojos.) */
(function (g) {
  'use strict';
  var QUITAR = ['.caja-ia', '#cajaSituacion', '#cajaClaude', '#sitAnadirCriterio', '#sitAnadirActividad', '#guardarSituacion', '#situacionNueva', '.criterio-sit button',
    '.actividad-sit .peligro', '#crearActividad', '#traerPasado', '#guardarActividad', '#actividadNueva', '#anadirFila', '.anadirFilaGrupo', '#anadirCriterio', '#formAnadirCriterio', '.quitarCriterio', '#usarCalificar', '.cambia-hoja', 'td.acciones',
    '.zona', '.nueva', '.cambiar-grupo', '.marcar-areas', '.area .quitar'].join(',');
  var LEER = '#panelSituacion, #panelActividad, #tablaRubrica';

  function aplicar(raiz) {
    Array.prototype.forEach.call(raiz.querySelectorAll(QUITAR), function (e) { e.remove(); });
    Array.prototype.forEach.call(raiz.querySelectorAll(LEER), function (c) {
      Array.prototype.forEach.call(c.querySelectorAll('input, textarea, select'), function (e) {
        if (e.tagName === 'SELECT' || e.type === 'checkbox') e.disabled = true; else e.readOnly = true;
      });
    });
  }

  /* Empieza a vigilar `raiz` mientras `activo()` diga que se está en un curso pasado. */
  function vigilar(raiz, activo) {
    var o = new MutationObserver(function () { if (activo()) aplicar(raiz); });
    o.observe(raiz, { childList: true, subtree: true });
    return o;
  }

  g.SoloConsulta = { aplicar: aplicar, vigilar: vigilar };
})(window);
