/* Tutoría y entrevistas con la familia (fila 40): lo que se guarda en la carpeta ACTAS y cómo se lee.
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

  g.Tutoria = {
    nueva: nueva, leerTutoria: leerTutoria, guardarTutoria: guardarTutoria, proponerTutora: proponerTutora, alumnadoDelGrupo: alumnadoDelGrupo,
    leerEntrevista: leerEntrevista, guardarEntrevista: guardarEntrevista, borrarEntrevista: borrarEntrevista, listarEntrevistas: listarEntrevistas,
    mismoAlumno: mismoAlumno, deAlumno: deAlumno, terminadas: terminadas, sinTerminar: sinTerminar, pendientes: pendientes
  };
})(typeof window !== 'undefined' ? window : globalThis);
