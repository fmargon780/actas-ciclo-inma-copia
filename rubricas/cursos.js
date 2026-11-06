/* Los cursos de la carpeta «RÚBRICAS» (formato 2): cada curso en cursos/<AA-AA>/, el actual es el único que se puede cambiar.
   Todo lo que lee o escribe datos de un curso pasa por `vista`, que sabe en qué curso se está y se niega a escribir en uno pasado.
   La carpeta (`raiz`) tiene la forma de carpeta.js: leerJSON, escribirJSON, leerTexto, escribirTexto, crearCarpeta, listarJSON, listar, borrar.
   Forma de la carpeta: docs/CONTEXTO.md, sección 3. */
(function (g) {
  'use strict';
  var D = typeof module !== 'undefined' && module.exports ? require('./datos.js') : g.RubDatos;
  var FORMATO = 2;
  var DE_CURSO = ['alumnado', 'situaciones', 'actividades', 'calificaciones'];
  var SOLO_CONSULTAR = 'Este curso es solo para consultar: no se puede cambiar.';

  var esPlantilla = function (nombre) { return /^plantilla-/.test(nombre); };
  var dos = function (n) { return (n < 10 ? '0' : '') + n; };

  /* La carpeta tal como la ve una pantalla: rutas de siempre (grupos.json, actividades/…) que aquí van a cursos/<curso>/…
     La clave, config.json y las plantillas de «Mis rúbricas» son de todos los cursos. */
  function vista(raiz, curso, editable) {
    var base = 'cursos/' + curso + '/';
    function destino(ruta) {
      if (ruta === 'clave.json' || ruta === 'rubricas.json') return { ruta: ruta, comun: true };
      if (ruta === 'config.json') return { ruta: ruta, comun: true, escala: true };
      var m = /^rubricas\/(.+)$/.exec(ruta);
      if (m && esPlantilla(m[1])) return { ruta: ruta, comun: true };
      if (ruta === 'grupos.json' || /^(alumnado|situaciones|actividades|rubricas|calificaciones|hojas)(\/|$)/.test(ruta)) return { ruta: base + ruta, comun: false };
      throw new Error('Ruta desconocida: ' + ruta);
    }
    function escritura(ruta) {
      var d = destino(ruta);
      if (!editable && (!d.comun || d.escala)) throw new Error(SOLO_CONSULTAR);
      return d.ruta;
    }
    return {
      nombre: raiz.nombre, curso: curso, editable: editable,
      async leerJSON(ruta) { return raiz.leerJSON(destino(ruta).ruta); },
      async escribirJSON(ruta, o) { return raiz.escribirJSON(escritura(ruta), o); },
      async crearCarpeta(ruta) { return raiz.crearCarpeta(escritura(ruta)); },
      async listarJSON(ruta) {
        if (ruta !== 'rubricas') return raiz.listarJSON(destino(ruta).ruta);
        var a = (await raiz.listarJSON('rubricas')).filter(esPlantilla), b = (await raiz.listarJSON(base + 'rubricas')).filter(function (n) { return !esPlantilla(n); });
        return a.concat(b).sort();
      }
    };
  }

  async function listarCursos(raiz) {
    var l = (await raiz.listar('cursos')) || [];
    return l.filter(function (e) { return e.tipo === 'directory' && /^\d\d-\d\d$/.test(e.nombre); }).map(function (e) { return e.nombre; }).sort().reverse();
  }

  async function crearCurso(raiz, curso, grupos) {
    var base = 'cursos/' + curso + '/';
    await raiz.crearCarpeta('cursos');
    for (var i = 0; i < D.CARPETAS.length; i++) await raiz.crearCarpeta(base + D.CARPETAS[i]);
    await raiz.escribirJSON(base + 'grupos.json', grupos);
  }

  /* Copia un fichero a su sitio nuevo y, solo si los bytes coinciden, borra el original. Se puede repetir sin riesgo. */
  async function mover(raiz, de, a) {
    var t = await raiz.leerTexto(de);
    if (t == null) return;
    if ((await raiz.leerTexto(a)) !== t) {
      await raiz.escribirTexto(a, t);
      if ((await raiz.leerTexto(a)) !== t) throw new Error('No he podido copiar ' + de + ' con seguridad.');
    }
    await raiz.borrar(de);
  }

  /* Formato 1 → 2. La marca de formato 2 es lo último que se escribe: si se corta, la siguiente apertura lo termina. */
  async function migrar(raiz, config) {
    config = config || { niveles: D.NIVELES };
    var curso = config.cursoActual || config.curso || D.CURSO, base = 'cursos/' + curso + '/';
    await raiz.crearCarpeta('cursos');
    await raiz.crearCarpeta('rubricas');
    await mover(raiz, 'grupos.json', base + 'grupos.json');
    var carpetas = DE_CURSO.concat(['rubricas']);
    for (var i = 0; i < carpetas.length; i++) {
      var ents = (await raiz.listar(carpetas[i])) || [];
      for (var j = 0; j < ents.length; j++) {
        var n = ents[j].nombre;
        if (ents[j].tipo !== 'file' || !/\.json$/.test(n) || (carpetas[i] === 'rubricas' && esPlantilla(n))) continue;
        await mover(raiz, carpetas[i] + '/' + n, base + carpetas[i] + '/' + n);
      }
    }
    for (var k = 0; k < D.CARPETAS.length; k++) await raiz.crearCarpeta(base + D.CARPETAS[k]);
    var resto = Object.assign({}, config); delete resto.curso; /* conserva lo demás */
    await raiz.escribirJSON('config.json', Object.assign(resto, { cursoActual: curso, niveles: config.niveles }));
    await borrarVacias(raiz, DE_CURSO.concat(['criterios']));
    await raiz.escribirJSON('rubricas.json', { formato: FORMATO, aplicacion: 'rubricas-inma' });
    return Object.assign(resto, { cursoActual: curso, niveles: config.niveles });
  }


  async function borrarVacias(raiz, nombres) {
    for (var i = 0; i < nombres.length; i++) {
      var ents = await raiz.listar(nombres[i]);
      if (ents && !ents.length) await raiz.borrar(nombres[i], true);
    }
  }

  /* En una carpeta de formato 2 no debe haber ficheros de curso en la raíz (los crea una versión vieja de la página):
     se borran si están vacíos y, si tienen datos, no se tocan. */
  async function limpiarRaiz(raiz) {
    var gr = await raiz.leerJSON('grupos.json');
    if (Array.isArray(gr) && !gr.length) await raiz.borrar('grupos.json');
    else if (gr) console.warn('Hay un grupos.json con datos fuera de cursos/: no lo toco.');
    await borrarVacias(raiz, DE_CURSO.concat(['criterios']));
  }

  /* Un curso más nuevo que el actual solo queda de un «Empezar» o un «Deshacer» cortados a medias: si no tiene trabajo, se quita. */
  async function repararHuerfanos(raiz, config) {
    var cursos = await listarCursos(raiz);
    for (var i = 0; i < cursos.length; i++) {
      if (cursos[i] <= config.cursoActual) continue;
      if (!(await tieneTrabajo(raiz, cursos[i]))) await raiz.borrar('cursos/' + cursos[i], true);
    }
    if (await raiz.leerTexto('cursos/' + config.cursoActual + '/escala.json') != null) await raiz.borrar('cursos/' + config.cursoActual + '/escala.json');
  }

  async function tieneTrabajo(raiz, curso) {
    return (await raiz.listarJSON('cursos/' + curso + '/actividades')).length + (await raiz.listarJSON('cursos/' + curso + '/situaciones')).length > 0;
  }

  /* Abre la carpeta: la crea si está vacía (con `{ sinGrupos: true }`, sin los grupos de siempre), pasa de formato 1 a 2 si hace falta y devuelve { config, cursos, nuevo }. */
  async function iniciar(raiz, opciones) {
    var marca = await raiz.leerJSON('rubricas.json');
    if (marca && marca.formato > FORMATO) throw new Error('Esta carpeta es de una versión más nueva: recarga la aplicación.');
    var config = await raiz.leerJSON('config.json');
    if (!marca) {
      config = { cursoActual: D.CURSO, niveles: D.NIVELES };
      await crearCurso(raiz, D.CURSO, opciones && opciones.sinGrupos ? [] : D.gruposIniciales());
      await raiz.crearCarpeta('rubricas');
      await raiz.escribirJSON('config.json', config);
      await raiz.escribirJSON('rubricas.json', { formato: FORMATO, aplicacion: 'rubricas-inma' });
    } else if (marca.formato < FORMATO) {
      config = await migrar(raiz, config);
    } else {
      config = config || { cursoActual: D.CURSO, niveles: D.NIVELES };
      await limpiarRaiz(raiz);
      await repararHuerfanos(raiz, config);
    }
    return { config: config, cursos: await listarCursos(raiz), nuevo: !marca };
  }

  /* La escala de un curso: la vigente si es el actual; si es pasado, la que se congeló al cerrarlo. */
  async function escalaDe(raiz, curso, config) {
    if (curso === config.cursoActual) return config.niveles;
    var e = await raiz.leerJSON('cursos/' + curso + '/escala.json');
    return e && e.niveles ? e.niveles : config.niveles;
  }

  /* Prepara un curso para las pantallas: { carpeta (la vista), editable, grupos, config (con la escala de ese curso) }. */
  async function abrir(raiz, config, curso) {
    var editable = curso === config.cursoActual, v = vista(raiz, curso, editable);
    var grupos = await v.leerJSON('grupos.json');
    if (!grupos) { grupos = []; if (editable) await v.escribirJSON('grupos.json', grupos); }
    var cfg = editable ? config : { cursoActual: config.cursoActual, niveles: await escalaDe(raiz, curso, config) };
    return { carpeta: v, editable: editable, grupos: grupos, config: cfg };
  }

  /* El curso que se propone al pulsar «Empezar curso nuevo»: 26-27 → 27-28. */
  function siguiente(curso) { var n = (parseInt(curso.slice(0, 2), 10) + 1) % 100; return dos(n) + '-' + dos((n + 1) % 100); }

  function validarNombre(nombre, actual, existentes) {
    nombre = String(nombre || '').trim();
    var m = /^(\d\d)-(\d\d)$/.exec(nombre);
    if (!m) throw new Error('Escribe el curso con dos años seguidos, por ejemplo 27-28.');
    if ((Number(m[1]) + 1) % 100 !== Number(m[2])) throw new Error('Los dos años tienen que ser seguidos, por ejemplo 27-28.');
    if (existentes.indexOf(nombre) >= 0) throw new Error('Ya existe el curso ' + nombre + '.');
    if (nombre <= actual) throw new Error('El curso nuevo tiene que ser posterior al ' + actual + '.');
    return nombre;
  }

  /* Empieza el curso nuevo: sus grupos y áreas (sin alumnado), la escala del viejo congelada y, lo último, el cambio de curso actual. */
  async function empezar(raiz, config, nombre, grupos) {
    nombre = validarNombre(nombre, config.cursoActual, await listarCursos(raiz));
    var propuesta = grupos.map(function (x) { return { id: x.id, nombre: x.nombre, areas: JSON.parse(JSON.stringify(x.areas)) }; });
    await crearCurso(raiz, nombre, propuesta);
    await raiz.escribirJSON('cursos/' + config.cursoActual + '/escala.json', { niveles: config.niveles });
    var nueva = Object.assign({}, config, { cursoActual: nombre, niveles: config.niveles });
    await raiz.escribirJSON('config.json', nueva);
    return nueva;
  }

  /* El curso anterior al actual, si «Deshacer curso nuevo» está permitido: el actual aún no tiene ninguna actividad ni situación. */
  async function puedeDeshacer(raiz, config) {
    var cursos = await listarCursos(raiz), i = cursos.indexOf(config.cursoActual);
    if (i < 0 || i + 1 >= cursos.length) return null;
    return (await tieneTrabajo(raiz, config.cursoActual)) ? null : cursos[i + 1];
  }

  async function deshacer(raiz, config) {
    var anterior = await puedeDeshacer(raiz, config);
    if (!anterior) throw new Error('Ya no se puede deshacer: el curso ' + config.cursoActual + ' tiene trabajo guardado.');
    var e = await raiz.leerJSON('cursos/' + anterior + '/escala.json');
    var nueva = Object.assign({}, config, { cursoActual: anterior, niveles: e && e.niveles ? e.niveles : config.niveles });
    await raiz.escribirJSON('config.json', nueva);
    await raiz.borrar('cursos/' + anterior + '/escala.json');
    await raiz.borrar('cursos/' + config.cursoActual, true);
    return nueva;
  }

  var api = { FORMATO: FORMATO, vista: vista, iniciar: iniciar, abrir: abrir, listarCursos: listarCursos, escalaDe: escalaDe, siguiente: siguiente, validarNombre: validarNombre,
    empezar: empezar, puedeDeshacer: puedeDeshacer, deshacer: deshacer, SOLO_CONSULTAR: SOLO_CONSULTAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.Cursos = api;
})(typeof window !== 'undefined' ? window : globalThis);
