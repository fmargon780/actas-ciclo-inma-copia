/* Servicio de Claude (Apps Script): su dirección, el identificador de Google, la sesión de 30 días y las llamadas. Nada de esto es secreto. */
(function (g) {
  'use strict';
  var CLIENT_ID = '230647624097-qbup7adbibg4a3ejhr91qft8tmn7ukq2.apps.googleusercontent.com';
  var URL_SERVICIO = 'https://script.google.com/macros/s/AKfycbz4ORzflKU5Hy_WuUf4XJ16ir8Hc3tRQXpMkwVqsHGRV66kI_jT64kHrNYOUrylXSDF/exec';
  var CLAVE = 'actas.sesion';
  var DIAS = 30;

  function guardar(r) {
    try { localStorage.setItem(CLAVE, JSON.stringify({ sesion: r.sesion, correo: r.correo, admin: !!r.admin, hasta: Date.now() + DIAS * 86400000 })); } catch (e) { /* sin almacenamiento: se pedirá entrar cada vez */ }
  }
  function sesion() {
    try {
      var s = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      return s && s.sesion && s.hasta > Date.now() ? s : null;
    } catch (e) { return null; }
  }
  function olvidar() { try { localStorage.removeItem(CLAVE); } catch (e) { /* nada que borrar */ } }

  /* POST text/plain con JSON (sin comprobación previa del navegador). Devuelve el JSON del servicio; si no responde, { ok: false, motivo: 'red' }. */
  async function llamar(accion, datos) {
    var cuerpo = Object.assign({ accion: accion }, datos || {});
    var s = sesion();
    if (s && accion !== 'entrar') cuerpo.sesion = s.sesion;
    try {
      var r = await fetch(g.SERVICIO_URL || URL_SERVICIO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
      return await r.json();
    } catch (e) { return { ok: false, motivo: 'red' }; }
  }

  g.Servicio = { CLIENT_ID: CLIENT_ID, URL: URL_SERVICIO, llamar: llamar, guardar: guardar, sesion: sesion, olvidar: olvidar };
})(window);
