/* Pasar las rúbricas a Mis actas (fila 110). Los datos de Rúbricas viven en la subcarpeta ACTAS/rubricas.
   La marca ACTAS/rubricas-pasadas.json es lo ÚLTIMO que se escribe y dice que el paso terminó: con ella, cualquier dispositivo entra directo.
   Sin ella, lo que haya en ACTAS/rubricas se borra y se empieza. La carpeta RÚBRICAS de siempre solo se LEE: nunca se escribe ni se borra nada en ella. */
(function (g) {
  'use strict';
  var MARCA = 'rubricas-pasadas.json', DESTINO = 'rubricas';
  var C = typeof module !== 'undefined' && module.exports ? require('./cursos.js') : g.Cursos;

  var uno = function (n, una, varias) { return n + ' ' + (n === 1 ? una : varias); };

  /* La marca (null si el paso no se ha hecho). Se recuerda en est.marcaRubricas. Si la marca se dañó y la app la apartó, se vuelve a poner. */
  async function leerMarca(est, fresco) {
    if (!fresco && est.marcaRubricas !== undefined) return est.marcaRubricas;
    var m = await est.raiz.leerJSON(MARCA);
    if (!m || typeof m !== 'object') {
      var rota = (est.raiz.apartados || []).some(function (x) { return x.nombre === MARCA; });
      if (!rota && est.raiz.listar) { try { rota = ((await est.raiz.listar('')) || []).some(function (x) { return /^rubricas-pasadas\.roto-.*\.json$/.test(x.nombre); }); } catch (e) { rota = false; } }
      m = null;
      if (rota) { m = { formato: 1, origen: 'recuperada', fecha: new Date().toISOString() }; await est.raiz.escribirJSON(MARCA, m); }
    }
    est.marcaRubricas = m;
    return m;
  }

  async function bytesDe(f) {
    if (f && typeof f.arrayBuffer === 'function') return new Uint8Array(await f.arrayBuffer());
    return new TextEncoder().encode(await f.text());
  }
  function iguales(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /* Todos los ficheros de una carpeta, con sus rutas relativas (la clave de Claude se queda en ACTAS/clave.json y no se copia). */
  async function ficheros(raiz) {
    var lista = [];
    async function recorre(ruta) {
      var ents = (await raiz.listar(ruta)) || [];
      for (var i = 0; i < ents.length; i++) {
        var r = ruta ? ruta + '/' + ents[i].nombre : ents[i].nombre;
        if (ents[i].tipo === 'directory') await recorre(r); else if (r !== 'clave.json') lista.push(r);
      }
    }
    await recorre('');
    return lista.sort();
  }

  /* Copia byte a byte todo lo de `origen` en `destino` y comprueba, antes de dar nada por bueno, que hay los mismos ficheros y los mismos bytes. */
  async function copiar(origen, destino) {
    var lista = await ficheros(origen);
    for (var i = 0; i < lista.length; i++) {
      var f = await origen.abrirArchivo(lista[i]);
      if (!f) throw new Error('No he podido leer ' + lista[i] + ' de la carpeta RÚBRICAS.');
      await destino.escribirBinario(lista[i], await bytesDe(f));
    }
    var copiados = await ficheros(destino);
    if (copiados.length !== lista.length || copiados.join('\n') !== lista.join('\n')) throw new Error('La copia no tiene los mismos ficheros que la carpeta RÚBRICAS.');
    for (var j = 0; j < lista.length; j++) {
      var a = await bytesDe(await origen.abrirArchivo(lista[j])), b = await bytesDe(await destino.abrirArchivo(lista[j]));
      if (!iguales(a, b)) throw new Error('La copia de ' + lista[j] + ' no coincide con el original.');
    }
    return lista.length;
  }

  /* Lo que hay en la carpeta de Rúbricas: grupos y alumnos del curso actual; situaciones y actividades de todos los cursos. */
  async function cifras(raiz) {
    var cursos = await C.listarCursos(raiz), config = await raiz.leerJSON('config.json'), actual = config && config.cursoActual;
    var c = { grupos: 0, alumnos: 0, situaciones: 0, actividades: 0, cursos: cursos.length };
    for (var i = 0; i < cursos.length; i++) {
      var base = 'cursos/' + cursos[i] + '/';
      c.situaciones += (await raiz.listarJSON(base + 'situaciones')).length;
      c.actividades += (await raiz.listarJSON(base + 'actividades')).length;
      if (cursos[i] !== actual) continue;
      var grupos = (await raiz.leerJSON(base + 'grupos.json')) || [];
      c.grupos = grupos.length;
      for (var k = 0; k < grupos.length; k++) {
        var d = await raiz.leerJSON(base + 'alumnado/' + grupos[k].id + '.json');
        c.alumnos += d && d.alumnos ? d.alumnos.length : 0;
      }
    }
    return c;
  }

  function frase(c) {
    return 'Ya están aquí: ' + uno(c.grupos, 'grupo', 'grupos') + ', ' + uno(c.alumnos, 'alumno', 'alumnos') + ', ' + uno(c.situaciones, 'situación', 'situaciones') + ', ' +
      uno(c.actividades, 'actividad', 'actividades') + ' y ' + uno(c.cursos, 'curso', 'cursos') + '. Comprueba que está todo. Tu carpeta RÚBRICAS sigue como estaba.';
  }

  async function quitarDestino(est) { try { await est.raiz.borrar(DESTINO, true); } catch (e) { /* si no se puede, la siguiente vez se vuelve a intentar */ } }

  /* «Pasar mis rúbricas»: copia todo (todos los cursos), una vez. Si algo falla, se quita lo copiado a medias y se vuelve a lanzar el error. */
  async function pasar(est, origen) {
    /* Si otro dispositivo ya los pasó mientras tanto, no se borra ni se copia nada: vale lo que ya hay. */
    var hecha = await leerMarca(est, true);
    if (hecha) return hecha;
    try {
      await est.raiz.borrar(DESTINO, true);
      var destino = await est.raiz.sub(DESTINO);
      await api.copiar(origen, destino);
      await C.iniciar(destino);
      var cif = await cifras(destino), marca = { formato: 1, origen: 'copiado', fecha: new Date().toISOString(), cifras: cif };
      await est.raiz.escribirJSON(MARCA, marca);
      est.marcaRubricas = marca; est.alumnado = null;
      return marca;
    } catch (e) { await quitarDestino(est); est.marcaRubricas = null; throw e; }
  }

  /* Empezar de cero: carpeta nueva, sin grupos. También deja la marca, para que la próxima vez entre directo. */
  async function empezarDeCero(est) {
    var hecha = await leerMarca(est, true); /* nunca se borra lo que otro dispositivo haya pasado */
    if (hecha) return hecha;
    await est.raiz.borrar(DESTINO, true);
    try {
      var destino = await est.raiz.sub(DESTINO);
      await C.iniciar(destino, { sinGrupos: true });
      var marca = { formato: 1, origen: 'nuevo', fecha: new Date().toISOString() };
      await est.raiz.escribirJSON(MARCA, marca);
      est.marcaRubricas = marca; est.alumnado = null;
      return marca;
    } catch (e) { await quitarDestino(est); est.marcaRubricas = null; throw e; }
  }

  /* ¿Hay trabajo en la carpeta nueva? Mientras no lo haya, quien empezó de cero todavía puede pasar su carpeta RÚBRICAS. */
  async function hayTrabajo(raiz) { var c = await cifras(raiz); return c.grupos > 0 || c.alumnos > 0 || c.situaciones > 0 || c.actividades > 0; }

  /* Una carpeta «nueva» vacía en un dispositivo que sí recuerda la carpeta RÚBRICAS no es el trabajo de la docente: sigue valiendo RÚBRICAS hasta que la pase. */
  async function nuevaSinTrabajo(est) {
    var m = await leerMarca(est);
    return !!(m && m.origen === 'nuevo' && !(await hayTrabajo(await est.raiz.sub(DESTINO))));
  }

  /* Quien empezó de cero y aún no ha trabajado puede «volver a la puerta»: se quita la marca y la carpeta vacía. */
  async function volverAlPaso(est) {
    await est.raiz.borrar(MARCA, false);
    await quitarDestino(est);
    est.marcaRubricas = null; est.alumnado = null;
  }

  var api = { MARCA: MARCA, DESTINO: DESTINO, leerMarca: leerMarca, copiar: copiar, ficheros: ficheros, cifras: cifras, frase: frase, pasar: pasar, empezarDeCero: empezarDeCero, hayTrabajo: hayTrabajo, nuevaSinTrabajo: nuevaSinTrabajo, volverAlPaso: volverAlPaso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.RubPasar = api;
})(typeof window !== 'undefined' ? window : globalThis);
