/* «Mis papeles» (fila 95): lee lo que hay en las cuatro subcarpetas de ACTAS/documentos/<curso>/ y lo reparte para la pantalla. Solo lee: no mueve ni renombra nada.
   Un papel es la pareja PDF y Word con el mismo nombre; si falta uno solo sale el que hay y otro tipo de fichero sale con un solo enlace «Abrir». Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var TOPE = 6;
  var RE_FECHA = /^\d{4}-\d{2}-\d{2}/;

  /* Para buscar: sin mayúsculas ni tildes. */
  function simple(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  /* Los ficheros de una carpeta → papeles [{ nombre, pdf, docx, otro }] (rutas de cada fichero: las que no hay, null). */
  function juntar(carpeta, ficheros) {
    var por = {}, orden = [];
    ficheros.forEach(function (f) {
      if (f.tipo !== 'file') return;
      var m = /^(.*)\.(pdf|docx)$/i.exec(f.nombre), clave = m ? m[1] : f.nombre;
      if (!por[clave]) { por[clave] = { nombre: clave, pdf: null, docx: null, otro: null }; orden.push(clave); }
      if (m) por[clave][m[2].toLowerCase()] = carpeta + '/' + f.nombre; else por[clave].otro = carpeta + '/' + f.nombre;
    });
    return orden.map(function (k) { return por[k]; });
  }

  /* Los libros (sin fecha en el nombre) arriba; después del más reciente al más antiguo. */
  function ordenar(lista) {
    return lista.slice().sort(function (a, b) {
      var fa = RE_FECHA.test(a.nombre), fb = RE_FECHA.test(b.nombre);
      if (fa !== fb) return fa ? 1 : -1;
      if (!fa) return a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0;
      return a.nombre < b.nombre ? 1 : a.nombre > b.nombre ? -1 : 0;
    });
  }

  /* Los cursos para el desplegable: los que tienen carpeta en documentos/ más el actual, del más reciente al más antiguo. */
  async function cursos(raiz, actual) {
    var l = ((await raiz.listar(g.Envios.DOCS)) || []).filter(function (x) { return x.tipo === 'directory'; }).map(function (x) { return x.nombre; });
    if (l.indexOf(actual) < 0) l.push(actual);
    return l.sort().reverse();
  }

  /* Los papeles de un curso: [{ id, titulo, papeles }] en el orden de las cuatro carpetas. */
  async function leerCurso(raiz, curso) {
    var E = g.Envios, res = [];
    for (var k = 0; k < Object.keys(E.SUB).length; k++) {
      var id = Object.keys(E.SUB)[k], ruta = E.carpeta(curso, E.SUB[id]), l = [];
      try { l = (await raiz.listar(ruta)) || []; } catch (e) { l = []; }
      res.push({ id: id, titulo: E.SUB[id], papeles: ordenar(juntar(ruta, l)) });
    }
    return res;
  }

  /* Lo que enseña una carpeta: { visibles, total, hayMas, vacia, sinResultados }. Buscando salen todos los que coinciden, sin tope. */
  function vista(papeles, texto, desplegada) {
    var q = simple(String(texto || '').trim());
    if (q) {
      var coinciden = papeles.filter(function (p) { return simple(p.nombre).indexOf(q) >= 0; });
      return { visibles: coinciden, total: papeles.length, hayMas: false, vacia: !papeles.length, sinResultados: !!papeles.length && !coinciden.length };
    }
    return { visibles: desplegada ? papeles : papeles.slice(0, TOPE), total: papeles.length, hayMas: papeles.length > TOPE, vacia: !papeles.length, sinResultados: false };
  }

  g.Papeles = { TOPE: TOPE, simple: simple, juntar: juntar, ordenar: ordenar, cursos: cursos, leerCurso: leerCurso, vista: vista };
})(typeof window !== 'undefined' ? window : globalThis);
