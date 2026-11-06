/* Los criterios de evaluación oficiales (Orden de 30 de mayo de 2023). Son datos del programa: un fichero por área y ciclo en
   pagina/criterios/, que se registran con Criterios.registrar. Añadir un área o un curso es solo añadir su fichero. */
(function (g) {
  'use strict';
  var docs = [];

  function validar(d) {
    var f = function (m) { throw new Error('Criterios de ' + (d && d.area || '?') + ': ' + m); };
    if (!d || !d.area || !d.areaId || !Array.isArray(d.cursos) || !d.cursos.length) f('faltan area, areaId o cursos');
    if (!d.fuente || !d.fuente.norma || !d.fuente.anexo || !d.fuente.paginas) f('falta la fuente (norma, anexo y páginas)');
    if (!Array.isArray(d.competencias) || !d.competencias.length) f('no tiene competencias');
    d.competencias.forEach(function (c) {
      if (!c.numero || !c.texto || !Array.isArray(c.criterios) || !c.criterios.length) f('competencia ' + c.numero + ' incompleta');
      c.criterios.forEach(function (k) {
        var cursos = Object.keys(k.cursos || {});
        if (!/^\d+\.\d+$/.test(k.codigo) || !cursos.length) f('criterio ' + k.codigo + ' incompleto');
        cursos.forEach(function (n) {
          var x = k.cursos[n];
          if (d.cursos.indexOf(Number(n)) < 0) f('criterio ' + k.codigo + ' de un curso que no es del fichero');
          if (!x.texto || !new RegExp('^' + k.codigo.replace(/\./g, '\\.') + '\\.[ab]$').test(x.codigo)) f('criterio ' + k.codigo + ' curso ' + n + ' mal formado');
        });
      });
    });
    return d;
  }

  function registrar(d) {
    validar(d);
    docs = docs.filter(function (x) { return !(x.areaId === d.areaId && x.ciclo === d.ciclo); }).concat([d]);
  }
  function vaciar() { docs = []; }

  /* [{ id, nombre }] de las áreas con criterios cargados. */
  function areas() {
    var vistas = {}, l = [];
    docs.forEach(function (d) { if (!vistas[d.areaId]) { vistas[d.areaId] = 1; l.push({ id: d.areaId, nombre: d.area }); } });
    return l;
  }
  /* Cursos (3, 4…) de los que hay criterios de esa área. */
  function cursos(areaId) {
    var l = [];
    docs.forEach(function (d) { if (d.areaId === areaId) d.cursos.forEach(function (n) { if (l.indexOf(n) < 0) l.push(n); }); });
    return l.sort();
  }
  /* Competencias con los criterios de ese curso: [{ numero, texto, criterios: [{ id, codigo, texto }] }]. */
  function competencias(areaId, curso) {
    var out = [];
    docs.forEach(function (d) {
      if (d.areaId !== areaId || d.cursos.indexOf(Number(curso)) < 0) return;
      d.competencias.forEach(function (c) {
        var crits = c.criterios.filter(function (k) { return k.cursos[curso]; }).map(function (k) {
          return { id: areaId + ':' + k.cursos[curso].codigo, codigo: k.cursos[curso].codigo, texto: k.cursos[curso].texto };
        });
        if (crits.length) out.push({ numero: c.numero, texto: c.texto, competenciasClave: c.competenciasClave, criterios: crits });
      });
    });
    return out;
  }
  /* Un criterio por su id («area:código») para un curso, o null. */
  function buscar(id, curso) {
    var areaId = String(id).split(':')[0], r = null;
    competencias(areaId, curso).forEach(function (c) { c.criterios.forEach(function (k) { if (k.id === id) r = k; }); });
    return r;
  }
  function fuente(areaId) { var d = docs.filter(function (x) { return x.areaId === areaId; })[0]; return d ? d.fuente : null; }

  function cargarScript(ruta) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = ruta; s.onload = ok; s.onerror = function () { mal(new Error('No he podido cargar ' + ruta)); };
      document.head.appendChild(s);
    });
  }
  /* Carga los ficheros que lista criterios/indice.js (sirve también desde el disco, donde fetch no funciona). */
  var cargados = 0;
  async function cargar() {
    if (cargados) return cargados;
    await cargarScript('rubricas/criterios/indice.js');
    var lista = g.CRITERIOS_FICHEROS || [];
    for (var i = 0; i < lista.length; i++) await cargarScript('rubricas/criterios/' + lista[i]);
    cargados = lista.length;
    return lista.length;
  }

  var api = { registrar: registrar, vaciar: vaciar, validar: validar, areas: areas, cursos: cursos, competencias: competencias, buscar: buscar, fuente: fuente, cargar: cargar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.Criterios = api;
})(typeof window !== 'undefined' ? window : globalThis);
