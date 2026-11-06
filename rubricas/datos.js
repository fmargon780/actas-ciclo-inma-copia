/* Los datos de Inma: la carpeta «RÚBRICAS». Aquí solo hay lógica; la carpeta de verdad (o la de mentira de las pruebas)
   llega con esta forma:  { leerJSON(ruta) -> objeto|null, escribirJSON(ruta, objeto), crearCarpeta(ruta) }.
   Rutas con barras, relativas a la carpeta elegida. Forma de la carpeta: docs/CONTEXTO.md, sección 3. */
(function (g) {
  'use strict';

  /* Carpetas que cuelgan de cada curso (cursos/<curso>/…). */
  var CARPETAS = ['alumnado', 'situaciones', 'actividades', 'rubricas', 'calificaciones'];
  var CURSO = '26-27';
  var NIVELES = [
    { nombre: 'Insuficiente', valor: 3 }, { nombre: 'Suficiente', valor: 5 }, { nombre: 'Bien', valor: 6 },
    { nombre: 'Notable', valor: 8 }, { nombre: 'Sobresaliente', valor: 10 }
  ];
  var ARTISTICA = 'Educación Artística', LENGUA = 'Lengua Castellana y Literatura', MATES = 'Matemáticas';

  function area(nombre) { return { id: id(nombre), nombre: nombre }; }
  function id(texto) { return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function gruposIniciales() {
    return [
      { id: '3a', nombre: '3º A', areas: [area(ARTISTICA)] },
      { id: '3b', nombre: '3º B', areas: [area(ARTISTICA)] },
      { id: '4a', nombre: '4º A', areas: [area(ARTISTICA), area(LENGUA), area(MATES)] },
      { id: '4b', nombre: '4º B', areas: [area(ARTISTICA), area(MATES)] }
    ];
  }

  function copia(x) { return JSON.parse(JSON.stringify(x)); }

  /* Operaciones sobre la lista de grupos: devuelven una lista nueva (o lanzan Error con un mensaje claro). */
  function anadirGrupo(grupos, nombre) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) throw new Error('Escribe el nombre del grupo.');
    var gid = id(nombre).replace(/-/g, '');
    if (grupos.some(function (x) { return x.id === gid; })) throw new Error('Ya hay un grupo ' + nombre + '.');
    return grupos.concat([{ id: gid, nombre: nombre, areas: [] }]);
  }
  function quitarGrupo(grupos, gid) { return grupos.filter(function (x) { return x.id !== gid; }); }
  function anadirArea(grupos, gid, nombre) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) throw new Error('Escribe el nombre del área.');
    var l = copia(grupos), gr = l.filter(function (x) { return x.id === gid; })[0];
    if (!gr) throw new Error('No existe ese grupo.');
    if (gr.areas.some(function (a) { return a.id === id(nombre); })) throw new Error('Ese grupo ya tiene «' + nombre + '».');
    gr.areas.push(area(nombre));
    return l;
  }
  function quitarArea(grupos, gid, aid) {
    var l = copia(grupos);
    l.forEach(function (x) { if (x.id === gid) x.areas = x.areas.filter(function (a) { return a.id !== aid; }); });
    return l;
  }

  /* Cambia el nombre de un grupo (y con él su id). Solo si nadie más lo usa: ni alumnado ni trabajo guardado. */
  function renombrarGrupo(grupos, gid, nombre) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) throw new Error('Escribe el nombre del grupo.');
    var nid = id(nombre).replace(/-/g, '');
    if (nid !== gid && grupos.some(function (x) { return x.id === nid; })) throw new Error('Ya hay un grupo ' + nombre + '.');
    return grupos.map(function (x) { return x.id === gid ? { id: nid, nombre: nombre, areas: copia(x.areas) } : x; });
  }

  function guardarGrupos(carpeta, grupos) { return carpeta.escribirJSON('grupos.json', grupos); }

  /* Del alumnado se guarda solo el nombre y el grupo. Nada más, aunque el listado traiga más columnas. */
  function guardarAlumnado(carpeta, gid, nombres) {
    return carpeta.escribirJSON('alumnado/' + gid + '.json', { grupo: gid, alumnos: nombres.map(function (n) { return { nombre: String(n) }; }) });
  }
  async function leerAlumnado(carpeta, gid) {
    var d = await carpeta.leerJSON('alumnado/' + gid + '.json');
    return d && d.alumnos ? d.alumnos.map(function (a) { return a.nombre; }) : [];
  }
  async function contarAlumnos(carpeta, grupos) {
    var cuenta = {};
    for (var i = 0; i < grupos.length; i++) cuenta[grupos[i].id] = (await leerAlumnado(carpeta, grupos[i].id)).length;
    return cuenta;
  }

  /* Cuánto se usa un criterio en la clase: actividades de ese trimestre que lo evalúan y rúbricas guardadas de esas actividades (de cualquier trimestre).
     Actividad: { id, trimestre, criterios: ['matematicas:1.1.b', …] }. Rúbrica: { actividad: id }. Las filas 3 y 4 las crean. */
  async function usoDeCriterio(carpeta, criterioId, trimestre) {
    var act = [], nombres = await carpeta.listarJSON('actividades');
    for (var i = 0; i < nombres.length; i++) {
      var a = await carpeta.leerJSON('actividades/' + nombres[i]);
      if (a && Array.isArray(a.criterios) && a.criterios.indexOf(criterioId) >= 0) act.push(a);
    }
    var ids = act.map(function (a) { return a.id; }), rub = 0, rn = await carpeta.listarJSON('rubricas');
    for (var j = 0; j < rn.length; j++) { var r = await carpeta.leerJSON('rubricas/' + rn[j]); if (r && ids.indexOf(r.actividad) >= 0) rub++; }
    return { actividades: act.filter(function (a) { return Number(a.trimestre) === Number(trimestre); }).length, rubricas: rub };
  }

  var api = { usoDeCriterio: usoDeCriterio, gruposIniciales: gruposIniciales, renombrarGrupo: renombrarGrupo, area: area, NIVELES: NIVELES, CURSO: CURSO, anadirGrupo: anadirGrupo, quitarGrupo: quitarGrupo, anadirArea: anadirArea, quitarArea: quitarArea,
    guardarGrupos: guardarGrupos, guardarAlumnado: guardarAlumnado, leerAlumnado: leerAlumnado, contarAlumnos: contarAlumnos, CARPETAS: CARPETAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.RubDatos = api;
})(typeof window !== 'undefined' ? window : globalThis);
