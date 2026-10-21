/* Lo que la página lee y escribe en la carpeta «ACTAS» (por el adaptador de carpeta.js): marca, ficha, clave y borradores. */
(function (g) {
  'use strict';
  var DIR = 'borradores';

  /* La carpeta vale solo si tiene actas.json (lo crea el documento de actas). */
  async function comprobar(raiz) {
    var m = await raiz.leerJSON('actas.json');
    if (!m || typeof m !== 'object') throw new Error('Esta no es tu carpeta de actas: está en Mi unidad › ACTAS.');
    return m;
  }

  async function leerFicha(raiz) {
    try { return await raiz.leerJSON('ficha.json'); } catch (e) { return null; }
  }

  async function leerClave(raiz) {
    var c = await raiz.leerJSON('clave.json');
    return c && c.clave ? String(c.clave) : '';
  }
  async function guardarClave(raiz, clave) { await raiz.escribirJSON('clave.json', { clave: String(clave || '').trim() }); }

  async function guardarBorrador(raiz, b, ahora) {
    var datos = g.Borradores.paraGuardar(b, ahora || new Date());
    await raiz.escribirJSON(DIR + '/' + datos.id + '.json', datos);
    b.cambiado = datos.cambiado;
    return datos;
  }

  async function leerBorrador(raiz, id) { return raiz.leerJSON(DIR + '/' + id + '.json'); }

  /* Todos los borradores, el cambiado más recientemente primero. Un fichero roto se salta. */
  async function listarBorradores(raiz) {
    var nombres = await raiz.listarJSON(DIR), lista = [];
    for (var i = 0; i < nombres.length; i++) {
      try {
        var b = await raiz.leerJSON(DIR + '/' + nombres[i]);
        if (b && b.id && b.tipo) lista.push(b);
      } catch (e) { /* fichero a medias: no se enseña */ }
    }
    return lista.sort(function (a, b) { return a.cambiado < b.cambiado ? 1 : -1; });
  }

  async function borrarBorrador(raiz, id) { await raiz.borrar(DIR + '/' + id + '.json', false); }

  g.Datos = { comprobar: comprobar, leerFicha: leerFicha, leerClave: leerClave, guardarClave: guardarClave, guardarBorrador: guardarBorrador, leerBorrador: leerBorrador, listarBorradores: listarBorradores, borrarBorrador: borrarBorrador };
})(typeof window !== 'undefined' ? window : globalThis);
