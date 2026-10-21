/* Dictado: el reconocimiento de voz de Chrome escribe en español al final de una caja de texto. */
(function (g) {
  'use strict';
  var SILENCIO_MS = 6000;

  function disponible() {
    return !!(g.webkitSpeechRecognition || g.SpeechRecognition) && g.navigator.onLine !== false;
  }

  /* Devuelve { alternar, activo }. `caja` es el textarea; `cambio(texto)` se llama con cada texto nuevo; `estado(activo)` al empezar y parar. */
  function crear(caja, cambio, estado) {
    var Reco = g.webkitSpeechRecognition || g.SpeechRecognition;
    var reco = null, activo = false, base = '', fijo = '', reloj = null;

    function juntar(a, b) {
      if (!b) return a;
      return a && !/\s$/.test(a) ? a + ' ' + b : a + b;
    }
    function parar() { if (reco) { try { reco.stop(); } catch (e) { /* ya parado */ } } }
    function armarSilencio() { clearTimeout(reloj); reloj = setTimeout(parar, SILENCIO_MS); }

    function empezar() {
      reco = new Reco();
      reco.lang = 'es-ES'; reco.continuous = true; reco.interimResults = true;
      base = caja.value; fijo = '';
      reco.onresult = function (ev) {
        var provisional = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) fijo = juntar(fijo, t.trim()); else provisional += t;
        }
        var texto = juntar(juntar(base, fijo), provisional.trim());
        caja.value = texto; cambio(texto); armarSilencio();
      };
      reco.onend = function () { activo = false; clearTimeout(reloj); caja.value = juntar(base, fijo); cambio(caja.value); estado(false); };
      reco.onerror = function () { /* onend llega después y deja el estado en reposo */ };
      activo = true; estado(true); armarSilencio();
      try { reco.start(); } catch (e) { activo = false; estado(false); }
    }

    return { alternar: function () { if (activo) parar(); else empezar(); }, activo: function () { return activo; } };
  }

  g.Dictado = { disponible: disponible, crear: crear };
})(window);
