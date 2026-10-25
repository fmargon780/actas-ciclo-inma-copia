/* Lo que «Mis actas» y el panel «Mis apps» le cuentan al botón «Soporte» único (el que sirve soporte-apps): quién es la app, su versión,
   en qué pantalla está (solo el nombre, nunca un título con nombres de alumnado), el correo de la sesión de Google y cómo tapar los nombres. */
(function (g) {
  'use strict';
  var REPO = 'fmargon780/actas-ciclo-inma';
  /* Los nombres en llano de cada pantalla (los mismos títulos que usa pagina/ayuda.json). */
  var PANTALLAS = {
    inicio: 'Inicio', formulario: 'Acta del equipo de ciclo', revision: 'Revisar el acta', fichas: 'Fichas del alumnado', habitual: 'Lo habitual',
    convocatoria: 'Nueva convocatoria', entrevista: 'Entrevista con familia', tutoria: 'Mi tutoría', reunion: 'Reunión general con familias',
    evaluacion: 'Acta de evaluación', diversidad: 'Atención a la diversidad', ajustes: 'Ajustes', libro: 'Libro de actas del curso',
    traer: 'Traer actas del documento antiguo', ayuda: 'Ayuda'
  };
  function estado() { try { return typeof g.estadoActas === 'function' ? g.estadoActas() : null; } catch (e) { return null; } }

  function pantalla() {
    if (/\/apps\//.test(g.location.pathname)) return 'Mis apps'; /* el panel no tiene carpeta ni pantallas */
    var est = estado();
    if (!est) return 'Mi carpeta de actas';
    return PANTALLAS[est.paso] || 'Mis actas';
  }
  /* El correo de la sesión de Google que guarda la entrada (la misma que usa el servicio de redacciones), si existe y no ha caducado. */
  function persona() {
    try {
      var s = JSON.parse(g.localStorage.getItem('actas.sesion') || 'null');
      if (s && s.sesion && s.hasta > Date.now() && typeof s.correo === 'string' && s.correo) return { correo: s.correo };
    } catch (e) { /* sin almacenamiento o sesión rota: el botón pide el correo */ }
    return {};
  }
  function limpiar(texto) {
    if (!g.Anonimizar) return texto;
    var est = estado(), a = est && est.alumnado, lista = a && a.lista && a.lista.todos ? a.lista.todos : [];
    return g.Anonimizar.crear(lista).texto(texto);
  }

  g.SOPORTE_APP = { repo: REPO, version: g.VERSION_PAGINA || '', pantalla: pantalla, persona: persona, limpiar: limpiar };
  g.SoporteApp = { PANTALLAS: PANTALLAS };
})(window);
