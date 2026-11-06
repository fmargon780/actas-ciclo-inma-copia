/* «Traer del curso pasado»: copia una actividad o una situación de un curso pasado al actual, con su rúbrica y sin notas. Sin pantalla.
   Lo del curso pasado solo se lee (por `raiz`); todo lo que se escribe va por `destino`, la vista del curso actual (cursos.js).
   Forma de los datos: docs/CONTEXTO.md, sección 3 y 4. */
(function (g) {
  'use strict';
  var req = typeof module !== 'undefined' && module.exports;
  var R = req ? require('./rubrica.js') : g.Rubrica, S = req ? require('./situacion.js') : g.Situacion, Cu = req ? require('./cursos.js') : g.Cursos;

  var copia = function (x) { return JSON.parse(JSON.stringify(x)); };
  var nombresDe = function (l, id) { var x = l.filter(function (a) { return a.id === id; })[0]; return x ? x.nombre : id; };
  var cursoDe = function (grupo) { return parseInt(grupo && grupo.nombre, 10); };
  var tieneArea = function (grupo, area) { return grupo.areas.some(function (a) { return a.id === area; }); };

  /* Lo que hay en cursos pasados: [{ curso, id, titulo, grupoId, grupoNombre, areas: [{id, nombre}] }], el curso más reciente primero.
     tipo: 'actividad' o 'situacion'. */
  async function lista(raiz, config, tipo) {
    var out = [], cursos = (await Cu.listarCursos(raiz)).filter(function (c) { return c < config.cursoActual; });
    var carpeta = tipo === 'situacion' ? 'situaciones' : 'actividades';
    for (var i = 0; i < cursos.length; i++) {
      var base = 'cursos/' + cursos[i] + '/', grupos = (await raiz.leerJSON(base + 'grupos.json')) || [], nombres = await raiz.listarJSON(base + carpeta);
      var areasDe = {};
      grupos.forEach(function (x) { x.areas.forEach(function (a) { areasDe[a.id] = a.nombre; }); });
      for (var j = 0; j < nombres.length; j++) {
        var x = await raiz.leerJSON(base + carpeta + '/' + nombres[j]);
        if (!x || !x.id) continue;
        var ids = tipo === 'situacion' ? x.actividades.map(function (a) { return a.area; }).filter(Boolean) : [x.area];
        var vistas = [];
        ids.forEach(function (id) { if (id && vistas.indexOf(id) < 0) vistas.push(id); });
        out.push({ curso: cursos[i], id: x.id, titulo: x.titulo || '', grupoId: x.grupo, grupoNombre: nombresDe(grupos, x.grupo),
          areas: vistas.map(function (id) { return { id: id, nombre: areasDe[id] || id }; }) });
      }
    }
    return out.sort(function (a, b) { return a.curso < b.curso ? 1 : a.curso > b.curso ? -1 : 0; });
  }

  /* Ids de criterios oficiales de un área y curso. */
  function validos(Criterios, areaId, curso) {
    var set = {};
    Criterios.competencias(areaId, curso).forEach(function (c) { c.criterios.forEach(function (k) { set[k.id] = true; }); });
    return set;
  }
  function filtrar(ids, set, quitados) {
    return (ids || []).filter(function (id) { if (set[id]) return true; if (quitados.indexOf(id) < 0) quitados.push(id); return false; });
  }

  /* La hoja del alumno (normal y adaptada) para la actividad nueva: cada `fila` pasa a su id nuevo; si la fila no está en la tabla, se quita. */
  function hojaTraida(hoja, actividadId, filasNuevas) {
    var n = copia(hoja), traducir = function (l) {
      (l || []).forEach(function (e) { if (e.fila && filasNuevas[e.fila]) e.fila = filasNuevas[e.fila]; else delete e.fila; });
    };
    n.actividad = actividadId; traducir(n.ejercicios);
    if (n.adaptada) traducir(n.adaptada.ejercicios);
    return n;
  }

  /* Copia una actividad (con su rúbrica y su hoja, sin notas) al curso actual. Devuelve la actividad nueva. */
  async function actividadSuelta(raiz, destino, curso, id, op, sid, quitados) {
    var base = 'cursos/' + curso + '/', a = await raiz.leerJSON(base + 'actividades/' + id + '.json');
    if (!a) throw new Error('No encuentro esa actividad en el curso ' + curso + '.');
    var r = await raiz.leerJSON(base + 'rubricas/' + id + '.json'), n = copia(a), area = op.area;
    n.id = R.nuevoId('a'); n.grupo = op.grupo.id; n.area = area; n.curso = cursoDe(op.grupo); n.origen = { curso: curso, id: id };
    n.criterios = filtrar(a.criterios, validos(op.Criterios, area, n.curso), quitados);
    delete n.situacion; if (sid) n.situacion = sid;
    var filasNuevas = {};
    if (r) {
      var c = copia(r); c.id = R.nuevoId('r'); c.actividad = n.id; delete c.plantilla;
      c.filas.forEach(function (f, k) { f.id = R.nuevoId('f'); filasNuevas[r.filas[k].id] = f.id; if (f.criterio && n.criterios.indexOf(f.criterio) < 0) delete f.criterio; });
      await destino.escribirJSON('rubricas/' + n.id + '.json', c);
    }
    var hoja = await raiz.leerJSON(base + 'hojas/' + id + '.json');
    if (hoja) await destino.escribirJSON('hojas/' + n.id + '.json', hojaTraida(hoja, n.id, filasNuevas));
    await destino.escribirJSON('actividades/' + n.id + '.json', n);
    return n;
  }

  /* Trae una actividad. op = { grupo: {id, nombre, areas}, area: id, Criterios, enlace?: { sid, n } } (enlace: se une a esa situación del curso actual).
     Devuelve { actividad, quitados } (quitados: ids de criterios que no existen en el curso y área nuevos). */
  async function actividad(raiz, destino, curso, id, op) {
    var quitados = [], n = await actividadSuelta(raiz, destino, curso, id, op, op.enlace ? op.enlace.sid : null, quitados);
    if (op.enlace) await S.enlazar(destino, op.enlace.sid, op.enlace.n, n.id);
    return { actividad: n, quitados: quitados };
  }

  /* Trae una situación con sus actividades y rúbricas, todas al mismo grupo y sin notas. op = { grupo, area (para lo que no encaje), Criterios }. */
  async function situacion(raiz, destino, curso, id, op) {
    var s = await raiz.leerJSON('cursos/' + curso + '/situaciones/' + id + '.json');
    if (!s) throw new Error('No encuentro esa situación en el curso ' + curso + '.');
    var n = copia(s), quitados = [], cat = S.catalogo(op.grupo, op.Criterios), buenos = {};
    cat.criterios.forEach(function (k) { buenos[k.id] = true; });
    n.id = S.nueva().id; n.grupo = op.grupo.id; n.origen = { curso: curso, id: id };
    n.criterios = filtrar(s.criterios, buenos, quitados);
    n.actividades = [];
    for (var i = 0; i < s.actividades.length; i++) {
      var a = copia(s.actividades[i]), area = tieneArea(op.grupo, a.area) ? a.area : op.area;
      a.area = area;
      if (a.criterio && !buenos[a.criterio]) { if (quitados.indexOf(a.criterio) < 0) quitados.push(a.criterio); a.criterio = ''; }
      var previa = a.actividadId ? await raiz.leerJSON('cursos/' + curso + '/actividades/' + a.actividadId + '.json') : null;
      a.actividadId = previa ? (await actividadSuelta(raiz, destino, curso, previa.id, { grupo: op.grupo, area: area, Criterios: op.Criterios }, n.id, quitados)).id : null;
      n.actividades.push(a);
    }
    await S.guardar(destino, n);
    return { situacion: n, quitados: quitados };
  }

  /* El grupo y el área de destino: ¿hay que preguntar el área? Actividad: si el grupo no tiene el área de origen. Situación: si algún área no encaja. */
  function necesitaArea(item, grupo) { return item.areas.some(function (a) { return !tieneArea(grupo, a.id); }); }
  function areaPropuesta(item, grupo) {
    var igual = item.areas.filter(function (a) { return tieneArea(grupo, a.id); })[0];
    return igual ? igual.id : (grupo.areas[0] ? grupo.areas[0].id : '');
  }

  var api = { lista: lista, actividad: actividad, situacion: situacion, necesitaArea: necesitaArea, areaPropuesta: areaPropuesta, cursoDe: cursoDe };
  if (req) module.exports = api; else g.RubTraer = api;
})(typeof window !== 'undefined' ? window : globalThis);
