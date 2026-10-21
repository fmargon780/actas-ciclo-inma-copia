/* La copia sin internet se pone al día sola al abrirla (fila 43). Solo actúa si la página se abre desde el disco (file:).
   Mira version.json en el repositorio público; si la versión o el commit son otros y hay permiso sobre la carpeta de la copia, baja solo
   los ficheros que cambian, comprueba cada sha256, borra los que sobran, escribe version.json el último y recarga.
   Si algo falla o no hay permiso, deja una línea arriba y la página arranca igual con lo que tiene. Nunca bloquea el arranque. */
(function () {
  'use strict';
  if (location.protocol !== 'file:') return;
  var BASE = window.__COPIA_BASE_REMOTO__ || 'https://raw.githubusercontent.com/fmargon780/actas-ciclo-inma-copia/main/';
  var BD = 'actas-ciclo-inma-copia', ALMACEN = 'ajustes', CLAVE = 'copiaCarpeta';
  var MIA = window.VERSION_PAGINA + '|' + window.COMMIT_PAGINA;

  function carpetaGuardada() {
    return new Promise(function (ok) {
      try {
        var p = indexedDB.open(BD, 1);
        p.onupgradeneeded = function () { if (!p.result.objectStoreNames.contains(ALMACEN)) p.result.createObjectStore(ALMACEN); };
        p.onsuccess = function () {
          var q = p.result.transaction(ALMACEN, 'readonly').objectStore(ALMACEN).get(CLAVE);
          q.onsuccess = function () { ok(q.result || null); };
          q.onerror = function () { ok(null); };
        };
        p.onerror = function () { ok(null); };
      } catch (e) { ok(null); }
    });
  }

  function aviso(texto, boton, accion) {
    var d = document.getElementById('avisoCopia');
    if (!d) {
      d = document.createElement('div');
      d.id = 'avisoCopia'; d.className = 'aviso-ambar';
      document.body.insertBefore(d, document.body.firstChild);
    }
    d.textContent = texto + ' ';
    if (boton) {
      var b = document.createElement('button');
      b.className = 'accion'; b.textContent = boton;
      b.onclick = function () { b.disabled = true; accion().then(null, function () { b.disabled = false; }); };
      d.appendChild(b);
    }
  }

  async function sha(bytes) {
    return Array.prototype.map.call(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  async function escribir(raiz, ruta, bytes) {
    var t = ruta.split('/'), d = raiz;
    for (var i = 0; i < t.length - 1; i++) d = await d.getDirectoryHandle(t[i], { create: true });
    var w = await (await d.getFileHandle(t[t.length - 1], { create: true })).createWritable();
    await w.write(new Blob([bytes]));
    await w.close();
  }
  async function borrar(raiz, ruta) {
    var t = ruta.split('/'), d = raiz;
    try { for (var i = 0; i < t.length - 1; i++) d = await d.getDirectoryHandle(t[i]); await d.removeEntry(t[t.length - 1]); } catch (e) { /* ya no está */ }
  }
  async function versionLocal(raiz) {
    try { return JSON.parse(await (await (await raiz.getFileHandle('version.json')).getFile()).text()); } catch (e) { return null; }
  }

  async function actualizar(raiz, nueva) {
    var local = await versionLocal(raiz);
    var rutas = Object.keys(nueva.ficheros).filter(function (x) { return !local || !local.ficheros || local.ficheros[x] !== nueva.ficheros[x]; });
    var bajados = [];
    for (var i = 0; i < rutas.length; i++) {
      var r = await fetch(BASE + encodeURI(rutas[i]), { cache: 'no-store' });
      if (!r.ok) throw new Error('descarga ' + r.status);
      var bytes = new Uint8Array(await r.arrayBuffer());
      if ((await sha(bytes)) !== nueva.ficheros[rutas[i]]) throw new Error('sha256');
      bajados.push([rutas[i], bytes]);
    }
    for (var j = 0; j < bajados.length; j++) await escribir(raiz, bajados[j][0], bajados[j][1]);
    if (local && local.ficheros) for (var v in local.ficheros) if (!(v in nueva.ficheros)) await borrar(raiz, v);
    await escribir(raiz, 'version.json', new TextEncoder().encode(JSON.stringify(nueva)));
  }

  async function aplicar(raiz, nueva) {
    var antes = null;
    try { antes = sessionStorage.getItem('copiaActualizada'); } catch (e) { antes = null; }
    /* Contra el bucle: si ya se actualizó a esta versión en esta ventana y sigue sin cambiar, es que se escribió en otra carpeta. */
    if (antes === nueva.version + '|' + nueva.commit) { aviso('La copia se ha puesto al día en otra carpeta, no en la que abres. Vuelve a abrir «ABRIR MIS ACTAS.html» y elige esta carpeta.'); return; }
    await actualizar(raiz, nueva);
    try { sessionStorage.setItem('copiaActualizada', nueva.version + '|' + nueva.commit); } catch (e) { /* sin marca */ }
    location.reload();
  }

  async function mirar() {
    var nueva;
    try {
      var r = await fetch(BASE + 'version.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('http ' + r.status);
      nueva = await r.json();
      if (!nueva || typeof nueva.ficheros !== 'object') throw new Error('ilegible');
    } catch (e) { aviso('No se ha podido comprobar si hay versión nueva. La página funciona con la que tiene.'); return; }
    if (nueva.version + '|' + nueva.commit === MIA) return;
    var raiz = await carpetaGuardada();
    if (!raiz) { aviso('Hay una versión nueva, pero esta copia no recuerda su carpeta. Abre «ABRIR MIS ACTAS.html» una vez.'); return; }
    var permiso = 'prompt';
    try { permiso = await raiz.queryPermission({ mode: 'readwrite' }); } catch (e) { permiso = 'prompt'; }
    var probar = async function () {
      try { await aplicar(raiz, nueva); } catch (e) { aviso('No se ha podido poner al día la copia (' + (e && e.message ? e.message : e) + '). La página funciona con la versión que tiene.'); }
    };
    if (permiso === 'granted') { await probar(); return; }
    aviso('Hay una versión nueva de la página.', 'Actualizar ahora', async function () {
      var r = 'denied';
      try { r = await raiz.requestPermission({ mode: 'readwrite' }); } catch (e) { r = 'denied'; }
      if (r === 'granted') await probar(); else aviso('Sin permiso sobre la carpeta de la copia no se puede actualizar.');
    });
  }
  mirar();
})();
