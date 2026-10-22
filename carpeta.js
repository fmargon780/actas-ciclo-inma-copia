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

  var RE_ROTO = /\.roto-[^/]*\.json$/;
  function dosCifras(n) { return ('0' + n).slice(-2); }
  function marcaFecha(d) {
    return d.getFullYear() + '-' + dosCifras(d.getMonth() + 1) + '-' + dosCifras(d.getDate()) + '-' + dosCifras(d.getHours()) + dosCifras(d.getMinutes()) + dosCifras(d.getSeconds());
  }
  /* Un error con texto ya en español para Inma (los que no lo son pasan por explicarError). */
  function propio(texto) { var e = new Error(texto); e.enEspanol = true; return e; }
  function esNoEncontrado(e) { return e && e.name === 'NotFoundError'; }

  /* Envuelve el handle de Chrome con la forma que espera datos.js.
     Un .json vacío o cortado nunca para la app: se aparta (se renombra a «<nombre>.roto-<fecha>.json», sin borrar nada),
     se apunta en `apartados` y se avisa por `alApartar`; la lectura sigue como si el fichero no existiera. */
  function adaptador(raiz, ahora) {
    var a = {
      nombre: raiz.name,
      apartados: [],
      alApartar: null,
      async leerJSON(ruta) {
        var t = ruta.split('/'), n = t.pop(), d, texto;
        try {
          d = await subcarpeta(raiz, t.join('/'), false);
          texto = await (await (await d.getFileHandle(n)).getFile()).text();
        } catch (e) { if (esNoEncontrado(e)) return null; throw e; }
        try { return JSON.parse(texto); }
        catch (e) { await apartar(d, n, texto); return null; }
      },
      async escribirJSON(ruta, objeto) {
        var texto = JSON.stringify(objeto, null, 2);
        if (typeof texto !== 'string') throw propio('No he podido guardar: no había nada que guardar.');
        var t = ruta.split('/'), n = t.pop();
        var d = await subcarpeta(raiz, t.join('/'), true), fh = await d.getFileHandle(n, { create: true });
        var antes = null;
        try { antes = await (await fh.getFile()).text(); } catch (e) { antes = null; }
        var w = await fh.createWritable();
        try { await w.write(texto); await w.close(); }
        catch (e) { try { if (w.abort) await w.abort(); } catch (x) { /* nada */ } throw e; }
        /* Comprobar lo escrito antes de darlo por guardado; si no se puede leer, se deja como estaba
           (vale cualquier JSON legible: otro guardado seguido puede haber escrito después). */
        var legible = false;
        try { JSON.parse(await (await fh.getFile()).text()); legible = true; } catch (e) { legible = false; }
        if (!legible) {
          if (antes !== null && antes !== '') { try { var w2 = await fh.createWritable(); await w2.write(antes); await w2.close(); } catch (e) { /* nada */ } }
          throw propio('No he podido guardar «' + n + '» bien. Lo que había antes sigue como estaba; vuelve a intentarlo.');
        }
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
        try { var d = await subcarpeta(raiz, ruta, false); for await (var e of d.entries()) if (e[1].kind === 'file' && /\.json$/.test(e[0]) && !RE_ROTO.test(e[0])) l.push(e[0]); }
        catch (e) { if (!e || e.name !== 'NotFoundError') throw e; }
        return l.sort();
      }
    };
    /* Aparta el fichero dañado: copia su texto a «.roto-» y quita el original. Si no se puede (carpeta de solo lectura), solo se avisa. */
    async function apartar(d, n, texto) {
      var nuevo = n.replace(/\.json$/, '') + '.roto-' + marcaFecha(ahora || new Date()) + '.json', movido = true;
      try {
        var w = await (await d.getFileHandle(nuevo, { create: true })).createWritable();
        await w.write(texto); await w.close();
        await d.removeEntry(n);
      } catch (e) { movido = false; }
      a.apartados.push({ nombre: n, movido: movido });
      if (a.alApartar) a.alApartar(a.apartados.slice());
    }
    return a;
  }

  /* Cualquier error al abrir la carpeta, dicho en español y con qué hacer (sin textos técnicos en inglés). */
  function explicarError(e) {
    if (e && e.enEspanol && e.message) return e.message;
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Chrome no me ha dejado entrar en la carpeta. Elígela otra vez y, cuando Chrome pregunte, pulsa «Ver archivos» y «Permitir».';
    if (n === 'NotFoundError') return 'No encuentro la carpeta. Elígela otra vez: está en Mi unidad › ACTAS.';
    return 'No he podido abrir la carpeta. Elígela otra vez; si sigue igual, avisa a Francisco.';
  }

  /* El aviso en español para Inma con los nombres de los ficheros apartados (cadena vacía si no hay ninguno). */
  function avisoApartados(lista) {
    if (!lista || !lista.length) return '';
    var movidos = lista.filter(function (x) { return x.movido; }).map(function (x) { return x.nombre; });
    var sin = lista.filter(function (x) { return !x.movido; }).map(function (x) { return x.nombre; });
    var partes = [];
    if (movidos.length) partes.push((movidos.length === 1 ? 'Un fichero de la carpeta ACTAS estaba dañado y lo he apartado: ' : movidos.length + ' ficheros de la carpeta ACTAS estaban dañados y los he apartado: ') + movidos.join(', ') + '. Lo demás está bien.');
    if (sin.length) partes.push((sin.length === 1 ? 'Un fichero estaba dañado y no he podido apartarlo, así que lo he ignorado: ' : sin.length + ' ficheros estaban dañados y no he podido apartarlos, así que los he ignorado: ') + sin.join(', ') + '.');
    return partes.join(' ');
  }

  async function elegir() {
    if (typeof g.showDirectoryPicker !== 'function') throw propio('Este navegador no puede abrir carpetas. Hace falta Google Chrome en el ordenador.');
    var h = await g.showDirectoryPicker({ mode: 'readwrite', id: 'actas-inma' });
    try { await usarBD('readwrite', function (s) { return s.put(h, CLAVE); }); } catch (e) { /* sin memoria: se pedirá cada vez */ }
    return h;
  }
  /* Elegir otra carpeta una sola vez (p. ej. RÚBRICAS) sin recordarla ni cambiar la de las actas. */
  async function elegirOtra(id) {
    if (typeof g.showDirectoryPicker !== 'function') throw propio('Este navegador no puede abrir carpetas. Hace falta Google Chrome en el ordenador.');
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
    if (typeof g.showDirectoryPicker !== 'function') throw propio('Este navegador no puede abrir carpetas. Hace falta Google Chrome en el ordenador.');
    return g.showDirectoryPicker({ mode: 'read', id: 'rubricas-origen' });
  }
  async function guardarRubricas(h) { try { await usarBD('readwrite', function (s) { return s.put(h, CLAVE_RUBRICAS); }); } catch (e) { /* sin memoria: se pedirá cada vez */ } }
  async function rubricasRecordada() {
    try { return (await usarBD('readonly', function (s) { return s.get(CLAVE_RUBRICAS); })) || null; } catch (e) { return null; }
  }
  async function permisoLectura(h) { try { return await h.queryPermission({ mode: 'read' }); } catch (e) { return 'prompt'; } }
  async function pedirPermisoLectura(h) { try { return (await h.requestPermission({ mode: 'read' })) === 'granted'; } catch (e) { return false; } }

  g.Carpeta = { elegirRubricas: elegirRubricas, guardarRubricas: guardarRubricas, rubricasRecordada: rubricasRecordada, permisoLectura: permisoLectura, pedirPermisoLectura: pedirPermisoLectura,
    elegir: elegir, elegirOtra: elegirOtra, recordada: recordada, permiso: permiso, pedirPermiso: pedirPermiso, olvidar: olvidar, adaptador: adaptador, avisoApartados: avisoApartados, explicarError: explicarError };
})(window);
