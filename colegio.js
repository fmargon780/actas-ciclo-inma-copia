/* Los datos del colegio (fila 79): ACTAS/colegio.json (nombre, dirección, código postal y localidad, teléfono, correo, código de centro, casilla «Sin logo de la Junta»)
   y el logo en un fichero aparte de ACTAS (logo-colegio.png o .jpg). De aquí sale el membrete de todos los PDF y Word con membrete (`Colegio.paraDocumentos`).
   La carpeta de Inma (con actas ya hechas y sin colegio.json) recibe sola los datos de la plantilla del colegio, para que su acta salga igual que siempre.
   Además deja una copia (nombre, logo pequeño y casilla) en el navegador para el panel «Mis apps»: clave `mis-apps-colegio`.
   Sin pantalla: la carpeta entra por parámetro y se prueba con node --test. */
(function (g) {
  'use strict';
  var FICHERO = 'colegio.json', BASE_LOGO = 'logo-colegio', MAX_LOGO = 2 * 1024 * 1024, CLAVE_PANEL = 'mis-apps-colegio', LADO_PANEL = 256, MAX_PANEL = 300000;
  var FALTA = 'Antes de sacar documentos, rellena los datos de tu colegio.';
  /* Los datos de la plantilla del colegio de Inma que no están en la plantilla en sí: el código de centro es el de su correo. */
  var CODIGO_PLANTILLA = '29011771';

  function texto(x) { return String(x == null ? '' : x).trim(); }
  function enEspanol(frase, extra) { var e = new Error(frase); e.enEspanol = true; if (extra) Object.assign(e, extra); return e; }

  /* El docente escribe solo el número; si pone «T:», «Tel.» o «Teléfono» delante, se quita (la app añade «T: » en el membrete). */
  function limpiarTelefono(t) { return texto(t).replace(/^(?:tel[eé]fono|tel|tlf|t)\s*[:.]?\s*/i, '').trim(); }

  /* «29120 Alhaurín el Grande (Málaga)» -> «Alhaurín el Grande»: sin el código postal ni la provincia entre paréntesis. */
  function localidadDeCurso(cpLocalidad) {
    return texto(cpLocalidad).replace(/^\d{5}\s*[-–—]?\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  }

  function problema(d) { return texto(d && d.nombre) ? '' : 'Falta el nombre del colegio.'; }

  /* El objeto que va a colegio.json. `logo` es el nombre del fichero del logo en ACTAS ('' si no hay). */
  function paraGuardar(d, logo, ahora) {
    return {
      formato: 1, nombre: texto(d.nombre), direccion: texto(d.direccion), cpLocalidad: texto(d.cpLocalidad), telefono: limpiarTelefono(d.telefono),
      correo: texto(d.correo), codigo: texto(d.codigo), logo: texto(logo), sinLogoJunta: !!d.sinLogoJunta, cambiado: (ahora || new Date()).toISOString()
    };
  }

  /* Lo guardado, con todos los campos (los que falten salen vacíos); null si no hay colegio.json. */
  async function leer(raiz) {
    var c;
    try { c = await raiz.leerJSON(FICHERO); } catch (e) { return null; }
    if (!c || typeof c !== 'object') return null;
    return { nombre: texto(c.nombre), direccion: texto(c.direccion), cpLocalidad: texto(c.cpLocalidad), telefono: limpiarTelefono(c.telefono), correo: texto(c.correo),
      codigo: texto(c.codigo), logo: texto(c.logo), sinLogoJunta: !!c.sinLogoJunta };
  }

  async function bytesDe(raiz, ruta) {
    var f = await raiz.abrirArchivo(ruta);
    if (!f) return null;
    return f.arrayBuffer ? new Uint8Array(await f.arrayBuffer()) : new Uint8Array(f.bytes);
  }
  /* El logo guardado como imagen para el membrete ({ bytes, tipo, ancho, alto }), o null si no hay o no se puede leer (entonces el documento sale sin logo). */
  async function leerLogo(raiz, c) {
    if (!c || !c.logo) return null;
    try { var b = await bytesDe(raiz, c.logo); return b ? g.Membrete.imagenDe(b) : null; } catch (e) { return null; }
  }

  /* Un logo elegido por el docente: PNG o JPG de hasta 2 MB. Devuelve { bytes, tipo, ancho, alto } o lanza la frase. */
  function logoDeBytes(bytes) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var tipo = g.Membrete.tipoDeImagen(bytes);
    if (!tipo) throw enEspanol('El logo tiene que ser una imagen PNG o JPG.');
    if (bytes.length > MAX_LOGO) throw enEspanol('El logo pesa más de 2 MB. Elige uno más pequeño.');
    var img = g.Membrete.imagenDe(bytes);
    if (!img) throw enEspanol('No he podido leer ese logo. Prueba con otra imagen PNG o JPG.');
    return img;
  }

  /* ¿Tiene la carpeta actas ya hechas? Los borradores no cuentan: un docente nuevo puede tomar notas sin los datos del colegio. */
  async function tieneActasHechas(raiz) {
    var E = g.Envios, carpetas = [E.PARA, E.HECHAS];
    for (var i = 0; i < carpetas.length; i++) if ((await raiz.listarJSON(carpetas[i])).length) return true;
    var docs = await raiz.listar(E.DOCS);
    return !!(docs && docs.length);
  }

  /* La carpeta de Inma: se crean colegio.json y el logo con los datos de la plantilla. Si la ficha no trae localidad o ciclo, se le guardan los de siempre. */
  async function pasarDatosDeLaPlantilla(raiz) {
    var mem = await g.Membrete.cargar(), ficha = await g.Datos.leerFicha(raiz), logo = mem.imagenes.ceip;
    var nombre = logo ? BASE_LOGO + '.' + logo.tipo : '';
    if (logo) await raiz.escribirBinario(nombre, logo.bytes);
    var c = paraGuardar({
      nombre: texto(ficha && ficha.colegio) || mem.colegio, direccion: mem.pie[0], cpLocalidad: mem.pie[1], telefono: mem.pie[2], correo: mem.pie[3],
      codigo: CODIGO_PLANTILLA, sinLogoJunta: false
    }, nombre, new Date());
    await raiz.escribirJSON(FICHERO, c);
    if (ficha && (!texto(ficha.localidad) || !texto(ficha.ciclo))) {
      try { await raiz.escribirJSON('ficha.json', Object.assign({}, ficha, { localidad: texto(ficha.localidad) || 'Alhaurín el Grande', ciclo: texto(ficha.ciclo) || 'Segundo ciclo' })); }
      catch (e) { /* no es esencial: el acta saldría con lo que ya trae la ficha */ }
    }
  }

  var pendientes = new Map();
  /* Lo guardado en la carpeta; si no hay colegio.json y la carpeta tiene actas hechas (la de Inma), lo crea con los datos de la plantilla. null si no hay nada. */
  function asegurar(raiz) {
    if (pendientes.has(raiz)) return pendientes.get(raiz);
    var p = (async function () {
      var c = await leer(raiz);
      if (c) return c;
      if (!(await tieneActasHechas(raiz))) return null;
      await pasarDatosDeLaPlantilla(raiz);
      return leer(raiz);
    })();
    pendientes.set(raiz, p);
    var quitar = function () { pendientes.delete(raiz); };
    p.then(quitar, quitar);
    return p;
  }

  /* El logo reducido (como mucho 256 px de lado) en texto, para el panel «Mis apps». '' si no se puede o no cabe. */
  async function reducirLogo(img) {
    try {
      if (!img || !g.document || !g.createImageBitmap) return '';
      var mapa = await g.createImageBitmap(new g.Blob([img.bytes], { type: img.tipo === 'png' ? 'image/png' : 'image/jpeg' }));
      var e = Math.min(1, LADO_PANEL / Math.max(mapa.width, mapa.height)), lienzo = g.document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(mapa.width * e)); lienzo.height = Math.max(1, Math.round(mapa.height * e));
      lienzo.getContext('2d').drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
      var url = lienzo.toDataURL(img.tipo === 'png' ? 'image/png' : 'image/jpeg', 0.85);
      return url.length <= MAX_PANEL ? url : '';
    } catch (e) { return ''; }
  }

  /* Deja en el navegador lo que necesita el panel «Mis apps» (formato fijo: { nombre, logo (data:image/...;base64,... o ''), sinLogoJunta }). Sin datos, lo borra.
     Nunca da error: el panel es un extra. */
  async function reflejar(raiz, c) {
    var almacen;
    try { almacen = g.localStorage; } catch (e) { return; }
    if (!almacen) return;
    try {
      if (!c || !c.nombre) { almacen.removeItem(CLAVE_PANEL); return; }
      var valor = { nombre: c.nombre, logo: await reducirLogo(await leerLogo(raiz, c)), sinLogoJunta: !!c.sinLogoJunta };
      try { almacen.setItem(CLAVE_PANEL, JSON.stringify(valor)); }
      catch (e) { valor.logo = ''; almacen.setItem(CLAVE_PANEL, JSON.stringify(valor)); } /* si no cabe, sin logo */
    } catch (e) { /* sin almacenamiento del navegador */ }
  }

  /* Al abrir la carpeta: pasa los datos de Inma si hace falta y deja al día la copia del panel. Devuelve lo guardado (o null). */
  async function alAbrir(raiz) {
    var c = await asegurar(raiz);
    await reflejar(raiz, c);
    return c;
  }

  /* Valida y guarda. d: los campos del formulario. opciones: { logoNuevo: lo que devuelve logoDeBytes() }. El logo nuevo se escribe antes que colegio.json y el
     anterior solo se borra cuando todo lo demás está bien guardado. Si la localidad de «Datos del curso» está vacía, se rellena con la del colegio. */
  async function guardar(raiz, d, opciones, ahora) {
    var p = problema(d);
    if (p) throw enEspanol(p);
    var antes = await leer(raiz), anterior = antes ? antes.logo : '', nuevo = opciones && opciones.logoNuevo, logo = anterior;
    if (nuevo) { logo = BASE_LOGO + '.' + nuevo.tipo; await raiz.escribirBinario(logo, nuevo.bytes); }
    var c = paraGuardar(d, logo, ahora);
    await raiz.escribirJSON(FICHERO, c);
    if (anterior && anterior !== logo) { try { await raiz.borrar(anterior, false); } catch (e) { /* queda un fichero suelto, sin más */ } }
    try {
      var ficha = await g.Datos.leerFicha(raiz), loc = localidadDeCurso(c.cpLocalidad);
      if (ficha && !texto(ficha.localidad) && loc) await raiz.escribirJSON('ficha.json', Object.assign({}, ficha, { localidad: loc }));
    } catch (e) { /* no es esencial */ }
    var guardado = await leer(raiz);
    await reflejar(raiz, guardado);
    return guardado;
  }

  /* «Quitar logo»: lo ya guardado se queda sin logo (colegio.json primero, el fichero después). Sin colegio.json no hay nada que quitar. */
  async function quitarLogo(raiz, ahora) {
    var c = await leer(raiz);
    if (!c) return null;
    var anterior = c.logo;
    await raiz.escribirJSON(FICHERO, paraGuardar(c, '', ahora));
    if (anterior) { try { await raiz.borrar(anterior, false); } catch (e) { /* queda un fichero suelto, sin más */ } }
    var nuevo = await leer(raiz);
    await reflejar(raiz, nuevo);
    return nuevo;
  }

  /* '' si hay nombre del colegio; si no, la frase que se enseña. Pasa antes los datos de Inma si hace falta. */
  async function falta(raiz) {
    var c = await asegurar(raiz);
    return c && c.nombre ? '' : FALTA;
  }

  /* Lo que necesitan los PDF y Word con membrete: { mem (membrete con los datos del colegio), colegio }. Sin nombre del colegio lanza un error de tipo «ajustes»
     (la pantalla enseña la frase y «Ir a Ajustes», que baja hasta la tarjeta «Datos del colegio»). */
  async function paraDocumentos(raiz) {
    var c = await asegurar(raiz);
    if (!c || !c.nombre) throw enEspanol(FALTA, { tipo: 'ajustes', destino: 'colegio' });
    var mem = await g.Membrete.cargar();
    return { mem: g.Membrete.conColegio(mem, c, await leerLogo(raiz, c)), colegio: c };
  }

  g.Colegio = { FICHERO: FICHERO, FALTA: FALTA, CLAVE_PANEL: CLAVE_PANEL, limpiarTelefono: limpiarTelefono, localidadDeCurso: localidadDeCurso, problema: problema, paraGuardar: paraGuardar,
    leer: leer, leerLogo: leerLogo, logoDeBytes: logoDeBytes, asegurar: asegurar, alAbrir: alAbrir, guardar: guardar, quitarLogo: quitarLogo, falta: falta, paraDocumentos: paraDocumentos,
    reflejar: reflejar };
})(typeof window !== 'undefined' ? window : globalThis);
