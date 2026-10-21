/* La carpeta «ACTAS» elegida en el navegador (Chrome): elegirla, recordarla entre visitas y leer/escribir JSON en ella. */
(function (g) {
  'use strict';
  var BD = 'actas-inma', ALMACEN = 'ajustes', CLAVE = 'carpeta', CLAVE_RUBRICAS = 'carpetaRubricas';

  function abrirBD() {
    return new Promise(function (ok, mal) {
      var p = indexedDB.open(BD, 1);
      p.onupgradeneeded = function () { p.result.createObjectStore(ALMACEN); };
      p.onsuccess = function () { ok(p.result); };
      p.onerror = function () { mal(p.error); };
    });
  }
  function usarBD(modo, fn) {
    return abrirBD().then(function (bd) {
      return new Promise(function (ok, mal) {
        var t = bd.transaction(ALMACEN, modo), q = fn(t.objectStore(ALMACEN));
        t.oncomplete = function () { ok(q && q.result); };
        t.onerror = function () { mal(t.error); };
      });
    });
  }

  async function subcarpeta(raiz, ruta, crear) {
    var d = raiz, t = ruta.split('/').filter(Boolean);
    for (var i = 0; i < t.length; i++) d = await d.getDirectoryHandle(t[i], { create: !!crear });
    return d;
  }

  /* Envuelve el handle de Chrome con la forma que espera datos.js. */
  function adaptador(raiz) {
    return {
      nombre: raiz.name,
      async leerJSON(ruta) {
        var t = ruta.split('/'), n = t.pop();
        try {
          var d = await subcarpeta(raiz, t.join('/'), false);
          return JSON.parse(await (await (await d.getFileHandle(n)).getFile()).text());
        } catch (e) { if (e && e.name === 'NotFoundError') return null; throw e; }
      },
      async escribirJSON(ruta, objeto) {
        var t = ruta.split('/'), n = t.pop();
        var d = await subcarpeta(raiz, t.join('/'), true);
        var w = await (await d.getFileHandle(n, { create: true })).createWritable();
        await w.write(JSON.stringify(objeto, null, 2));
        await w.close();
      },
      async crearCarpeta(ruta) { await subcarpeta(raiz, ruta, true); },
      /* El texto tal cual está en el fichero (null si no existe): sirve para copiar y comparar byte a byte. */
      async leerTexto(ruta) {
        var t = ruta.split('/'), n = t.pop();
        try { return await (await (await (await subcarpeta(raiz, t.join('/'), false)).getFileHandle(n)).getFile()).text(); }
        catch (e) { if (e && e.name === 'NotFoundError') return null; throw e; }
      },
      async escribirTexto(ruta, texto) {
        var t = ruta.split('/'), n = t.pop();
        var w = await (await (await subcarpeta(raiz, t.join('/'), true)).getFileHandle(n, { create: true })).createWritable();
        await w.write(texto);
        await w.close();
      },
      /* Todo lo que hay en una carpeta: [{ nombre, tipo: 'file'|'directory' }]; null si la carpeta no existe. */
      async listar(ruta) {
        var l = [];
        try { var d = await subcarpeta(raiz, ruta, false); for await (var e of d.entries()) l.push({ nombre: e[0], tipo: e[1].kind }); }
        catch (e) { if (e && e.name === 'NotFoundError') return null; throw e; }
        return l.sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; });
      },
      /* Borra un fichero o una carpeta (con todo lo que tenga dentro si es `recursivo`). Si no existe, no hace nada. */
      async borrar(ruta, recursivo) {
        var t = ruta.split('/'), n = t.pop();
        try { await (await subcarpeta(raiz, t.join('/'), false)).removeEntry(n, { recursive: !!recursivo }); }
        catch (e) { if (!e || e.name !== 'NotFoundError') throw e; }
      },
      /* Nombres de los ficheros .json de una carpeta (vacío si la carpeta no existe). */
      async listarJSON(ruta) {
        var l = [];
        try { var d = await subcarpeta(raiz, ruta, false); for await (var e of d.entries()) if (e[1].kind === 'file' && /\.json$/.test(e[0])) l.push(e[0]); }
        catch (e) { if (!e || e.name !== 'NotFoundError') throw e; }
        return l.sort();
      }
    };
  }

  async function elegir() {
    if (typeof g.showDirectoryPicker !== 'function') throw new Error('Este navegador no puede abrir carpetas. Hace falta Google Chrome en el ordenador.');
    var h = await g.showDirectoryPicker({ mode: 'readwrite', id: 'actas-inma' });
    try { await usarBD('readwrite', function (s) { return s.put(h, CLAVE); }); } catch (e) { /* sin memoria: se pedirá cada vez */ }
    return h;
  }
  /* Elegir otra carpeta una sola vez (p. ej. RÚBRICAS) sin recordarla ni cambiar la de las actas. */
  async function elegirOtra(id) {
    if (typeof g.showDirectoryPicker !== 'function') throw new Error('Este navegador no puede abrir carpetas. Hace falta Google Chrome en el ordenador.');
    return g.showDirectoryPicker({ mode: 'readwrite', id: id });
  }
  async function recordada() {
    try { return (await usarBD('readonly', function (s) { return s.get(CLAVE); })) || null; } catch (e) { return null; }
  }
  /* 'granted' si se puede usar ya; si no, hace falta un clic de Inma (pedirPermiso). */
  async function permiso(h) { try { return await h.queryPermission({ mode: 'readwrite' }); } catch (e) { return 'prompt'; } }
  async function pedirPermiso(h) { try { return (await h.requestPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { return false; } }
  async function olvidar() { try { await usarBD('readwrite', function (s) { return s.delete(CLAVE); }); } catch (e) { /* nada */ } }

  /* La carpeta RÚBRICAS (solo se lee): se elige una vez, se recuerda aparte de ACTAS y no se vuelve a pedir. */
  async function elegirRubricas() {
    if (typeof g.showDirectoryPicker !== 'function') throw new Error('Este navegador no puede abrir carpetas. Hace falta Google Chrome en el ordenador.');
    return g.showDirectoryPicker({ mode: 'read', id: 'rubricas-origen' });
  }
  async function guardarRubricas(h) { try { await usarBD('readwrite', function (s) { return s.put(h, CLAVE_RUBRICAS); }); } catch (e) { /* sin memoria: se pedirá cada vez */ } }
  async function rubricasRecordada() {
    try { return (await usarBD('readonly', function (s) { return s.get(CLAVE_RUBRICAS); })) || null; } catch (e) { return null; }
  }
  async function permisoLectura(h) { try { return await h.queryPermission({ mode: 'read' }); } catch (e) { return 'prompt'; } }
  async function pedirPermisoLectura(h) { try { return (await h.requestPermission({ mode: 'read' })) === 'granted'; } catch (e) { return false; } }

  g.Carpeta = { elegirRubricas: elegirRubricas, guardarRubricas: guardarRubricas, rubricasRecordada: rubricasRecordada, permisoLectura: permisoLectura, pedirPermisoLectura: pedirPermisoLectura,
    elegir: elegir, elegirOtra: elegirOtra, recordada: recordada, permiso: permiso, pedirPermiso: pedirPermiso, olvidar: olvidar, adaptador: adaptador };
})(window);
