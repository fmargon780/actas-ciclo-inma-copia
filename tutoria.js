/* Tutoría y entrevistas con la familia (filas 40 y 41): lo que se guarda en la carpeta ACTAS y cómo se lee.
   Sin pantalla: la carpeta entra por parámetro (adaptador de carpeta.js) y se prueba con node --test.
   - ACTAS/tutoria.json: { formato, grupo, tutora }. El grupo de tutoría de Inma y su nombre como tutora (lo usan también las filas 41 y 42).
   - ACTAS/entrevistas/<id>.json: una entrevista { formato, id, estado: 'borrador' | 'terminada', fecha, alumno: { nombre, grupo, enLista, genero },
     notas: { temas, tutora, familia, otros } (con marcas de alumnado), textos: { temas, decisiones, otros } (lo redactado), compromisos: [...] }.
   Una entrevista sin terminar no cuenta para la ficha ni para los pendientes. */
(function (g) {
  'use strict';
  var A = g.Alumnado, DIR = 'entrevistas';

  function nueva(alumno, fecha, ahora) {
    var t = (ahora || new Date()).toISOString();
    return {
      formato: 1, id: 'entrevista-' + t.replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6), estado: 'borrador', fecha: fecha,
      alumno: { nombre: alumno.nombre, grupo: alumno.grupo || '', enLista: alumno.enLista !== false, genero: alumno.genero === 'a' ? 'a' : 'o' },
      notas: { temas: '', tutora: '', familia: '', otros: '' }, textos: { temas: '', decisiones: '', otros: '' }, compromisos: [],
      notasRedactadas: '', creado: t, cambiado: t
    };
  }

  /* --- grupo de tutoría --- */
  async function leerTutoria(raiz) {
    var t = await raiz.leerJSON('tutoria.json');
    if (!t || !String(t.grupo || '').trim()) return null;
    return { grupo: String(t.grupo).trim(), tutora: String(t.tutora || '').trim() };
  }
  async function guardarTutoria(raiz, grupo, tutora) {
    await raiz.escribirJSON('tutoria.json', { formato: 1, grupo: String(grupo || '').trim(), tutora: String(tutora || '').trim() });
  }
  /* El nombre de la tutora que se propone la primera vez: el de la coordinadora de la ficha del curso. */
  function proponerTutora(ficha) { return String((ficha && ficha.coordinadoraNombre) || '').trim(); }

  /* El alumnado del grupo de tutoría, en el formato de la lista que usa el buscador. */
  function alumnadoDelGrupo(lista, grupo) {
    var g1 = A.normalizar(grupo).trim();
    return ((lista && lista.todos) || []).filter(function (a) { return A.normalizar(a.grupo).trim() === g1; });
  }

  /* --- entrevistas guardadas --- */
  async function leerEntrevista(raiz, id) { return raiz.leerJSON(DIR + '/' + id + '.json'); }
  async function guardarEntrevista(raiz, e, ahora) {
    e.cambiado = (ahora || new Date()).toISOString();
    await raiz.escribirJSON(DIR + '/' + e.id + '.json', e);
    return e;
  }
  async function borrarEntrevista(raiz, id) { await raiz.borrar(DIR + '/' + id + '.json', false); }
  /* Todas las entrevistas legibles, la más reciente primero (por fecha y, a igual fecha, por cuándo se cambió). Un fichero roto se salta. */
  async function listarEntrevistas(raiz) {
    var nombres = await raiz.listarJSON(DIR), lista = [];
    for (var i = 0; i < nombres.length; i++) {
      try {
        var e = await raiz.leerJSON(DIR + '/' + nombres[i]);
        if (e && e.id && e.alumno && e.alumno.nombre && e.fecha) lista.push(e);
      } catch (x) { /* fichero a medias: no se enseña */ }
    }
    return lista.sort(function (a, b) { return a.fecha === b.fecha ? (a.cambiado < b.cambiado ? 1 : -1) : (a.fecha < b.fecha ? 1 : -1); });
  }

  function claveNombre(a) { return A.normalizar(a.nombre).replace(/\s+/g, ' ').trim(); }
  function mismoGrupo(x, y) { return !x || !y || A.normalizar(x) === A.normalizar(y); }
  /* ¿La misma persona? Mismo nombre y mismo grupo («sin grupo» vale con cualquiera), como en las fichas. */
  function mismoAlumno(a, b) { return claveNombre(a) === claveNombre(b) && mismoGrupo(a.grupo, b.grupo); }

  function deAlumno(entrevistas, alumno) { return (entrevistas || []).filter(function (e) { return mismoAlumno(e.alumno, alumno); }); }
  function terminadas(entrevistas) { return (entrevistas || []).filter(function (e) { return e.estado === 'terminada'; }); }
  /* La entrevista sin terminar más reciente de ese alumno, o null. */
  function sinTerminar(entrevistas, alumno) {
    return deAlumno(entrevistas, alumno).filter(function (e) { return e.estado !== 'terminada'; })[0] || null;
  }

  /* Compromisos sin marcar de entrevistas ya terminadas del alumno (salvo la que se está viendo):
     [{ entrevistaId, fecha, indice, quien, texto }], de la más antigua a la más reciente. */
  function pendientes(entrevistas, alumno, salvoId) {
    var res = [];
    terminadas(deAlumno(entrevistas, alumno)).slice().reverse().forEach(function (e) {
      if (e.id === salvoId) return;
      (e.compromisos || []).forEach(function (c, i) {
        if (!c.hecho) res.push({ entrevistaId: e.id, fecha: e.fecha, indice: i, quien: c.quien, texto: c.texto });
      });
    });
    return res;
  }

  /* --- Mi tutoría (fila 41): el grupo de un vistazo --- */
  function delCurso(entrevistas, curso) {
    var F = g.Fichas, anio = F.anioCurso(curso);
    return (entrevistas || []).filter(function (e) { return anio == null || F.cursoDeFecha(e.fecha) === anio; });
  }
  /* Cada alumno del grupo, por orden de apellidos: { alumno, ultima (la entrevista terminada más reciente o null), enCurso (hay otra sin terminar), pendientes: [...] }.
     Solo cuentan las entrevistas del curso. Una sin terminar no cuenta ni como última ni por sus compromisos. */
  function resumenGrupo(alumnos, entrevistas, curso) {
    var delC = delCurso(entrevistas, curso);
    return (alumnos || []).slice().sort(function (a, b) {
      var x = A.normalizar(a.apellidos + ' ' + a.pila), y = A.normalizar(b.apellidos + ' ' + b.pila);
      return x < y ? -1 : x > y ? 1 : 0;
    }).map(function (a) {
      return { alumno: a, ultima: terminadas(deAlumno(delC, a))[0] || null, enCurso: !!sinTerminar(delC, a), pendientes: pendientes(delC, a) };
    });
  }
  /* Los compromisos de las entrevistas terminadas del alumno, marcados o no: [{ entrevistaId, fecha, indice, quien, texto, hecho }], de la más antigua a la más reciente. */
  function compromisosDe(entrevistas, alumno) {
    var res = [];
    terminadas(deAlumno(entrevistas, alumno)).slice().reverse().forEach(function (e) {
      (e.compromisos || []).forEach(function (c, i) { res.push({ entrevistaId: e.id, fecha: e.fecha, indice: i, quien: c.quien, texto: c.texto, hecho: !!c.hecho }); });
    });
    return res;
  }
  /* Marca o desmarca un compromiso en su entrevista (la misma casilla que en la entrevista nueva). false si ya no existe. */
  async function marcarCompromiso(raiz, entrevistaId, indice, hecho, ahora) {
    var e = await leerEntrevista(raiz, entrevistaId);
    if (!e || !e.compromisos || !e.compromisos[indice]) return false;
    e.compromisos[indice].hecho = !!hecho;
    await guardarEntrevista(raiz, e, ahora);
    return true;
  }

  g.Tutoria = {
    nueva: nueva, leerTutoria: leerTutoria, guardarTutoria: guardarTutoria, proponerTutora: proponerTutora, alumnadoDelGrupo: alumnadoDelGrupo,
    leerEntrevista: leerEntrevista, guardarEntrevista: guardarEntrevista, borrarEntrevista: borrarEntrevista, listarEntrevistas: listarEntrevistas,
    mismoAlumno: mismoAlumno, deAlumno: deAlumno, terminadas: terminadas, sinTerminar: sinTerminar, pendientes: pendientes,
    delCurso: delCurso, resumenGrupo: resumenGrupo, compromisosDe: compromisosDe, marcarCompromiso: marcarCompromiso
  };
})(typeof window !== 'undefined' ? window : globalThis);
