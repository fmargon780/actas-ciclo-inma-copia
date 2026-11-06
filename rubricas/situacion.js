/* Situaciones de Aprendizaje: datos y listado para Séneca, sin pantalla (sirve en el navegador y en las pruebas).
   Situación: { id, titulo, grupo, trimestre, reto, semanas, sesiones, producto, recursos, saberes, criterios: ['area:código'],
   actividades: [{ titulo, area, sesiones, criterios: [ids], criterio (el primero), actividadId|null }], porIA }.
   (Las situaciones viejas traen solo `criterio`: `criteriosDe` lo lee igual.) Se guarda en situaciones/<id>.json. */
(function (g) {
  'use strict';
  var TRIMESTRES = ['1.er trimestre', '2.º trimestre', '3.er trimestre'];
  var APARTADOS = ['Título', 'Descripción y reto', 'Producto final', 'Criterios de evaluación', 'Saberes básicos', 'Secuencia de actividades', 'Temporalización', 'Recursos', 'Instrumentos de evaluación'];

  function nuevoId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nueva(grupo, trimestre) {
    return { id: nuevoId(), titulo: '', grupo: grupo || '', trimestre: trimestre || 1, reto: '', semanas: 2, sesiones: 4, producto: '', recursos: '', saberes: '', criterios: [], actividades: [] };
  }
  function actividadNueva(area) { return { titulo: '', area: area || '', sesiones: 1, criterios: [], criterio: '', actividadId: null }; }
  /* Los criterios de una actividad de la situación: su lista, o el `criterio` suelto de las situaciones viejas. */
  function criteriosDe(a) { return Array.isArray(a.criterios) && a.criterios.length ? a.criterios : (a.criterio ? [a.criterio] : []); }
  function ponerCriterios(a, lista) { a.criterios = lista.slice(); a.criterio = lista[0] || ''; return a; }

  async function todas(carpeta) {
    var nombres = await carpeta.listarJSON('situaciones'), out = [];
    for (var i = 0; i < nombres.length; i++) { var s = await carpeta.leerJSON('situaciones/' + nombres[i]); if (s && s.id) out.push(s); }
    return out;
  }
  function guardar(carpeta, s) { return carpeta.escribirJSON('situaciones/' + s.id + '.json', s); }

  /* Lista por grupo y trimestre: [{ grupo, trimestre, situaciones: [...] }], en el orden de los grupos. */
  function agrupar(lista, grupos) {
    var out = [];
    grupos.forEach(function (gr) {
      [1, 2, 3].forEach(function (t) {
        var l = lista.filter(function (s) { return s.grupo === gr.id && Number(s.trimestre) === t; });
        if (l.length) out.push({ grupo: gr, trimestre: t, situaciones: l });
      });
    });
    return out;
  }

  /* Criterios que Inma puede usar en un grupo: los de las áreas que da (con criterios cargados) y su curso. [{ id, area, areaNombre, codigo, texto }]. */
  function catalogo(grupo, Criterios) {
    var curso = parseInt(grupo && grupo.nombre, 10), cargadas = Criterios.areas(), out = [], areas = [];
    (grupo ? grupo.areas : []).forEach(function (a) {
      var ar = cargadas.filter(function (x) { return x.id === a.id; })[0];
      if (!ar || Criterios.cursos(ar.id).indexOf(curso) < 0) return;
      areas.push({ id: ar.id, nombre: ar.nombre });
      Criterios.competencias(ar.id, curso).forEach(function (c) { c.criterios.forEach(function (k) { out.push({ id: k.id, area: ar.id, areaNombre: ar.nombre, codigo: k.codigo, texto: k.texto }); }); });
    });
    return { curso: curso, areas: areas, criterios: out };
  }

  /* Pasa la propuesta de Claude (ya validada) a la situación, conservando lo que Inma tiene (id, grupo, trimestre, reto, saberes). */
  function aplicarPropuesta(s, p) {
    ['titulo', 'semanas', 'sesiones', 'producto', 'recursos', 'criterios'].forEach(function (k) { s[k] = p[k]; });
    var antes = s.actividades;
    s.actividades = p.actividades.map(function (a, i) {
      var x = actividadNueva(a.area); x.titulo = a.titulo; x.sesiones = a.sesiones; ponerCriterios(x, a.criterios || (a.criterio ? [a.criterio] : []));
      if (antes[i] && antes[i].actividadId && antes[i].titulo === a.titulo) x.actividadId = antes[i].actividadId;
      return x;
    });
    s.porIA = true;
    return s;
  }

  /* 'sin-crear' (la actividad aún no existe), 'pendiente' (existe sin rúbrica) o 'lista'. Una por cada actividad de la situación. */
  async function estados(carpeta, s) {
    var out = [];
    for (var i = 0; i < s.actividades.length; i++) {
      var id = s.actividades[i].actividadId;
      if (!id || !(await carpeta.leerJSON('actividades/' + id + '.json'))) { out.push('sin-crear'); continue; }
      var r = await carpeta.leerJSON('rubricas/' + id + '.json');
      out.push(r && r.filas && r.filas.some(function (f) { return f.texto && f.texto.trim(); }) ? 'lista' : 'pendiente');
    }
    return out;
  }
  /* ¿Tiene hoja del alumno cada actividad de la situación? true / false; null si la actividad aún no existe. La adaptada no cuenta. */
  async function hojas(carpeta, s) {
    var out = [];
    for (var i = 0; i < s.actividades.length; i++) {
      var id = s.actividades[i].actividadId;
      if (!id || !(await carpeta.leerJSON('actividades/' + id + '.json'))) { out.push(null); continue; }
      var h = await carpeta.leerJSON('hojas/' + id + '.json');
      out.push(!!(h && Array.isArray(h.ejercicios) && h.ejercicios.length));
    }
    return out;
  }
  var ETIQUETA_ESTADO = { 'sin-crear': 'Actividad sin crear', pendiente: 'Rúbrica pendiente', lista: 'Rúbrica lista' };

  async function enlazar(carpeta, sid, n, actividadId) {
    var s = await carpeta.leerJSON('situaciones/' + sid + '.json');
    if (!s || !s.actividades[n]) return;
    s.actividades[n].actividadId = actividadId;
    await guardar(carpeta, s);
  }

  /* La situación por los apartados de Séneca, lista para copiar uno a uno: [{ apartado, texto }]. */
  function paraSeneca(s, cat, estadoDe) {
    var porId = {}; cat.criterios.forEach(function (k) { porId[k.id] = k; });
    var nombreArea = function (id) { var a = cat.areas.filter(function (x) { return x.id === id; })[0]; return a ? a.nombre : id; };
    var crit = function (id) { var k = porId[id]; return k ? k.codigo + ' — ' + k.texto + ' (' + k.areaNombre + ')' : id; };
    var texto = [
      s.titulo,
      s.reto,
      s.producto,
      s.criterios.map(crit).join('\n'),
      s.saberes || '(Pendiente: copia aquí los saberes básicos del anexo oficial.)',
      s.actividades.map(function (a, i) {
        return (i + 1) + '. ' + a.titulo + ' — ' + nombreArea(a.area) + ', ' + a.sesiones + (Number(a.sesiones) === 1 ? ' sesión' : ' sesiones') + (criteriosDe(a).length ? '. ' + (criteriosDe(a).length > 1 ? 'Criterios: ' : 'Criterio: ') + criteriosDe(a).map(function (id) { return porId[id] ? porId[id].codigo : id; }).join(', ') : '');
      }).join('\n'),
      TRIMESTRES[s.trimestre - 1] + ' · ' + s.semanas + (Number(s.semanas) === 1 ? ' semana' : ' semanas') + ' · ' + s.sesiones + ' sesiones',
      s.recursos,
      s.actividades.map(function (a, i) { return 'Rúbrica de «' + a.titulo + '»' + (estadoDe && estadoDe[i] ? ' (' + ETIQUETA_ESTADO[estadoDe[i]].toLowerCase() + ')' : ''); }).join('\n')
    ];
    return APARTADOS.map(function (ap, i) { return { apartado: ap, texto: texto[i] || '' }; });
  }

  var api = { TRIMESTRES: TRIMESTRES, APARTADOS: APARTADOS, ETIQUETA_ESTADO: ETIQUETA_ESTADO, nueva: nueva, actividadNueva: actividadNueva, criteriosDe: criteriosDe, ponerCriterios: ponerCriterios, todas: todas, guardar: guardar, agrupar: agrupar,
    catalogo: catalogo, aplicarPropuesta: aplicarPropuesta, estados: estados, hojas: hojas, enlazar: enlazar, paraSeneca: paraSeneca };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.Situacion = api;
})(typeof window !== 'undefined' ? window : globalThis);
