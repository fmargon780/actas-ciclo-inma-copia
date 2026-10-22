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
    var d = document.createElement('div');
    d.id = 'avisoVersion'; d.className = 'aviso-ambar';
    d.textContent = 'Hay versión nueva. ';
    var b = document.createElement('button');
    b.className = 'accion'; b.textContent = 'Recargar';
    b.onclick = function () { b.disabled = true; espera.postMessage('saltar-espera'); };
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
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var nuevo = reg.installing;
      if (!nuevo) return;
      nuevo.addEventListener('statechange', function () {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisar(nuevo);
      });
    });
  }).catch(function () { /* sin service worker la página sigue funcionando igual */ });
})();
