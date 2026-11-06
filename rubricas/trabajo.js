/* Lo que Inma va creando en su carpeta: actividades, rúbricas, plantillas («Mis rúbricas») y calificaciones.
   Recibe la carpeta con la forma de datos.js: { leerJSON, escribirJSON, listarJSON }. */
(function (g) {
  'use strict';

  async function leerTodos(carpeta, ruta, filtro) {
    var nombres = await carpeta.listarJSON(ruta), out = [];
    for (var i = 0; i < nombres.length; i++) { var x = await carpeta.leerJSON(ruta + '/' + nombres[i]); if (x && (!filtro || filtro(x))) out.push(x); }
    return out;
  }

  function actividades(carpeta) { return leerTodos(carpeta, 'actividades'); }
  function guardarActividad(carpeta, a) { return carpeta.escribirJSON('actividades/' + a.id + '.json', a); }

  /* La rúbrica de una actividad (null si aún no tiene). */
  async function rubricaDe(carpeta, actividadId) { return (await carpeta.leerJSON('rubricas/' + actividadId + '.json')) || null; }
  function guardarRubrica(carpeta, r) { return carpeta.escribirJSON('rubricas/' + r.actividad + '.json', r); }
  /* Mis rúbricas: plantillas para reutilizar en otra actividad o grupo. No cuentan como rúbrica de ninguna actividad (actividad: null). */
  function plantillas(carpeta) { return leerTodos(carpeta, 'rubricas', function (r) { return r.plantilla === true; }); }
  function guardarPlantilla(carpeta, r, nombre) {
    var p = JSON.parse(JSON.stringify(r));
    p.filas.forEach(function (f) { delete f.criterio; });
    p.plantilla = true; p.actividad = null; p.nombre = nombre; p.id = 'plantilla-' + r.id;
    return carpeta.escribirJSON('rubricas/' + p.id + '.json', p).then(function () { return p; });
  }

  /* Calificaciones de una actividad: { actividad, grupo, notas: { nombreDelAlumno: { filaId: nivel } } }. */
  async function calificacionDe(carpeta, actividadId, grupo) {
    return (await carpeta.leerJSON('calificaciones/' + actividadId + '.json')) || { actividad: actividadId, grupo: grupo, notas: {} };
  }
  function guardarCalificacion(carpeta, c) { return carpeta.escribirJSON('calificaciones/' + c.actividad + '.json', c); }
  function todasLasCalificaciones(carpeta) { return leerTodos(carpeta, 'calificaciones'); }

  function guardarNiveles(carpeta, config, valores) {
    config.niveles = config.niveles.map(function (n, i) { return { nombre: n.nombre, valor: valores[i] }; });
    return carpeta.escribirJSON('config.json', config);
  }

  var api = { actividades: actividades, guardarActividad: guardarActividad, rubricaDe: rubricaDe, guardarRubrica: guardarRubrica, plantillas: plantillas,
    guardarPlantilla: guardarPlantilla, calificacionDe: calificacionDe, guardarCalificacion: guardarCalificacion, todasLasCalificaciones: todasLasCalificaciones, guardarNiveles: guardarNiveles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.Trabajo = api;
})(typeof window !== 'undefined' ? window : globalThis);
