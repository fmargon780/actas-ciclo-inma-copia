/* Acta de evaluación (fila 60): el «% con dificultades» de cada área sale de las notas de Rúbricas. Sin pantalla; solo LEE la carpeta RÚBRICAS
   (la carpeta entra por parámetro como el adaptador de carpeta.js: leerJSON y listarJSON). Se prueba con node --test.
   Con dificultades = media del alumno en el área por debajo del valor de «Suficiente» de la escala del curso de Rúbricas.
   Resultado de leer: { estado: 'ok' | 'sinDatos', nivel, areas: [{ nombre, porcentaje, con, de, sinFecha }] }. */
(function (g) {
  'use strict';
  var A = g.Alumnado;

  /* El nombre de un área, reducido a una clave para emparejar Rúbricas con el acta (Lengua = Lengua Castellana y Literatura…). */
  function clave(nombre) {
    var n = A.normalizar(nombre).replace(/\s+/g, ' ').trim();
    if (/^lengua\b/.test(n)) return 'lengua';
    if (/^(conocimiento del medio|ciencias)/.test(n)) return 'ciencias';
    if (/artistica/.test(n)) return 'artistica';
    if (/^religion/.test(n)) return 'religion';
    return n;
  }
  /* «2026-2027» -> «26-27» (así se llaman las carpetas de curso de Rúbricas). */
  function cursoDeRubricas(curso) {
    var m = /^(\d{4})\s*-\s*(\d{4})$/.exec(String(curso || ''));
    return m ? m[1].slice(2) + '-' + m[2].slice(2) : String(curso || '');
  }
  /* Desde cuándo cuentan las notas de cada sesión. */
  function inicioPeriodo(sesion, fecha) {
    var a = Number(String(fecha).slice(0, 4)), m = Number(String(fecha).slice(5, 7));
    var anioCurso = m >= 9 ? a : a - 1;
    if (sesion === 'segunda') return (anioCurso + 1) + '-01-01';
    if (sesion === 'final') return (anioCurso + 1) + '-04-01';
    return anioCurso + '-09-01';
  }
  function fechaDe(x) { var t = x && x.fecha ? String(x.fecha).slice(0, 10) : ''; return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''; }
  function numero(x) { var n = Number(x); return isNaN(n) ? null : n; }

  /* Media ponderada de una actividad para un alumno (null si no tiene ninguna nota). */
  function notaActividad(notasAlumno, filas, niveles) {
    var suma = 0, pesos = 0, suma1 = 0, cuantas = 0;
    (filas || []).forEach(function (f) {
      var nivel = notasAlumno ? numero(notasAlumno[f.id]) : null, n = nivel == null ? null : niveles[nivel];
      if (!n || numero(n.valor) == null) return;
      var p = numero(f.peso); p = p == null || p < 0 ? 1 : p;
      suma += p * numero(n.valor); pesos += p; suma1 += numero(n.valor); cuantas++;
    });
    if (!cuantas) return null;
    return pesos > 0 ? suma / pesos : suma1 / cuantas;
  }

  /* Lee Rúbricas y calcula, por área, cuántos alumnos de la clase están por debajo de Suficiente. e: { curso, clase, sesion, fecha }. */
  async function leer(raiz, e) {
    var sin = { estado: 'sinDatos', nivel: '', areas: [] };
    var config = await raiz.leerJSON('config.json'), cursoR = cursoDeRubricas(e.curso), base = '';
    if (await raiz.leerJSON('cursos/' + cursoR + '/grupos.json')) base = 'cursos/' + cursoR + '/';
    else if (config && config.cursoActual && (await raiz.leerJSON('cursos/' + config.cursoActual + '/grupos.json'))) return sin;
    var niveles = (base && cursoR !== (config && config.cursoActual) && (await raiz.leerJSON(base + 'escala.json')) || {}).niveles || (config && config.niveles);
    if (!Array.isArray(niveles) || niveles.length < 2) return sin;
    var suf = niveles.filter(function (n) { return A.normalizar(n && n.nombre) === 'suficiente'; })[0] || niveles[1];
    var umbral = numero(suf && suf.valor);
    if (umbral == null) return sin;

    var grupos = (await raiz.leerJSON(base + 'grupos.json')) || [];
    var clase = A.normalizar(e.clase), grupo = grupos.filter(function (x) { return A.normalizar(x.nombre) === clase || A.normalizar(x.id) === clase; })[0];
    if (!grupo) return sin;
    var nombresArea = {};
    (grupo.areas || []).forEach(function (a) { nombresArea[A.normalizar(a.id)] = a.nombre; nombresArea[A.normalizar(a.nombre)] = a.nombre; });
    var desde = inicioPeriodo(e.sesion, e.fecha), hasta = e.fecha;

    var porArea = {}, ficheros = await raiz.listarJSON(base + 'actividades');
    for (var i = 0; i < ficheros.length; i++) {
      var act = await raiz.leerJSON(base + 'actividades/' + ficheros[i]);
      if (!act || !act.id) continue;
      var cal = await raiz.leerJSON(base + 'calificaciones/' + act.id + '.json');
      if (!cal || !cal.notas) continue;
      var dueno = A.normalizar(act.grupo || cal.grupo);
      if (dueno !== A.normalizar(grupo.id) && dueno !== A.normalizar(grupo.nombre)) continue;
      var nombreArea = nombresArea[A.normalizar(act.area)];
      if (!nombreArea) continue;
      var fecha = fechaDe(cal) || fechaDe(act);
      if (fecha && (fecha < desde || fecha > hasta)) continue;
      var rub = await raiz.leerJSON(base + 'rubricas/' + act.id + '.json');
      var d = porArea[nombreArea] || (porArea[nombreArea] = { alumnos: {}, sinFecha: false });
      if (!fecha) d.sinFecha = true;
      Object.keys(cal.notas).forEach(function (alumno) {
        var nota = notaActividad(cal.notas[alumno], rub && rub.filas, niveles);
        if (nota == null) return;
        (d.alumnos[alumno] = d.alumnos[alumno] || []).push(nota);
      });
    }
    var areas = Object.keys(porArea).map(function (nombre) {
      var d = porArea[nombre], nombres = Object.keys(d.alumnos), con = 0;
      nombres.forEach(function (n) {
        var v = d.alumnos[n], media = v.reduce(function (s, x) { return s + x; }, 0) / v.length;
        if (media < umbral) con++;
      });
      return { nombre: nombre, porcentaje: nombres.length ? Math.round(con * 100 / nombres.length) : null, con: con, de: nombres.length, sinFecha: d.sinFecha };
    }).filter(function (a) { return a.de > 0; });
    return { estado: 'ok', nivel: String((suf && suf.nombre) || 'Suficiente'), areas: areas };
  }

  function frase(r, nivel) {
    return 'Sacado de Rúbricas: ' + r.con + ' de ' + r.de + ' alumnos con media por debajo de ' + nivel + (r.sinFecha ? ' (con todas las notas del curso)' : '');
  }

  /* Pone el resultado en el acta. Lo que la tutora escribió a mano no se pisa; un área de Rúbricas que no está en el acta se añade, salvo que la
     hubiera quitado. Devuelve { cambiaron: ¿cambió algún porcentaje que no era a mano? }. */
  function aplicar(e, res) {
    var cambiaron = false;
    if (!res || res.estado !== 'ok') return { cambiaron: false };
    var quitadas = (e.areasQuitadas || []).map(clave);
    res.areas.forEach(function (r) {
      var k = clave(r.nombre), a = e.areas.filter(function (x) { return clave(x.nombre) === k; })[0];
      if (!a) {
        if (quitadas.indexOf(k) >= 0) return;
        a = g.Evaluacion.areaVacia(r.nombre); e.areas.push(a);
      }
      a.porcentajeDeRubricas = r.porcentaje; a.fraseRubricas = frase(r, res.nivel);
      if (!a.porcentajeAMano) {
        if (a.porcentaje !== r.porcentaje && g.Evaluacion.hayTextos(e)) cambiaron = true;
        a.porcentaje = r.porcentaje;
      }
    });
    e.areas.forEach(function (a) {
      if (res.areas.some(function (r) { return clave(r.nombre) === clave(a.nombre); })) return;
      delete a.porcentajeDeRubricas; a.fraseRubricas = '';
    });
    return { cambiaron: cambiaron };
  }

  /* «Usar el de Rúbricas»: la casilla vuelve a seguir a Rúbricas. */
  function usarElDeRubricas(a) {
    if (a.porcentajeDeRubricas == null || a.porcentajeDeRubricas === '') return false;
    a.porcentaje = a.porcentajeDeRubricas; a.porcentajeAMano = false;
    return true;
  }

  g.EvaluacionRubricas = { clave: clave, cursoDeRubricas: cursoDeRubricas, inicioPeriodo: inicioPeriodo, leer: leer, frase: frase, aplicar: aplicar, usarElDeRubricas: usarElDeRubricas };
})(typeof window !== 'undefined' ? window : globalThis);
