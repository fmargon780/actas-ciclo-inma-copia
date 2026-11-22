/* Aplicación instalable: registra el service worker (solo en https) y avisa con discreción si hay versión nueva. */
(function () {
  'use strict';
  window.modoApp = function () {
    if (location.protocol === 'file:') return 'copia sin internet';
    var instalada = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    return instalada ? 'aplicación instalada' : 'página web';
  };
  /* Enlace de vuelta al panel. En la copia sin internet (file:) no se pone: sin red no llevaría a ningún sitio. */
  if (location.protocol !== 'file:') {
    var volver = document.createElement('a');
    volver.id = 'volverApps'; volver.className = 'volver-apps'; volver.href = '/apps/'; volver.textContent = '← Mis apps';
    document.body.insertBefore(volver, document.body.firstChild);
  }
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;

  function avisar(espera) {
    if (document.getElementById('avisoVersion')) return;
    var d = document.createElement('div');
    d.id = 'avisoVersion'; d.className = 'aviso-ambar';
    d.textContent = 'Hay versión nueva. ';
    var b = document.createElement('button');
    b.className = 'accion'; b.textContent = 'Recargar';
    b.onclick = function () {
      b.disabled = true;
      /* Antes de cargar la versión nueva se guarda lo que se estaba escribiendo. */
      var est = null, previo;
      try { est = typeof window.estadoActas === 'function' ? window.estadoActas() : null; previo = est && typeof est.alSalir === 'function' ? est.alSalir() : null; } catch (e) { previo = null; }
      Promise.resolve(previo).catch(function () { /* si no se pudo guardar, se recarga igual: el borrador ya estaba en el último guardado */ }).then(function () { espera.postMessage('saltar-espera'); });
    };
    d.appendChild(b);
    document.body.insertBefore(d, document.body.firstChild);
  }

  var habiaControl = !!navigator.serviceWorker.controller;
  var recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!habiaControl || recargando) { habiaControl = true; return; }
    recargando = true; location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(function (reg) {
    function mirarEspera() { if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting); }
    mirarEspera();
    /* Una pestaña que lleva horas o días abierta no busca versión nueva sola: se pregunta cada hora y al volver a ella. */
    function buscar() { try { Promise.resolve(reg.update()).catch(function () { /* sin red no pasa nada */ }).then(mirarEspera); } catch (e) { /* sin red no pasa nada */ } }
    setInterval(buscar, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') buscar(); });
    reg.addEventListener('updatefound', function () {
      var nuevo = reg.installing;
      if (!nuevo) return;
      nuevo.addEventListener('statechange', function () {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisar(nuevo);
      });
    });
  }).catch(function () { /* sin service worker la página sigue funcionando igual */ });
})();
