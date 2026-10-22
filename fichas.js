/* Las fichas del alumnado (fila 16): lo dicho de cada alumno en las actas creadas con «Mis actas».
   Sin pantalla: la carpeta entra por parámetro (adaptador de carpeta.js) y se prueba con node --test.
   Las actas salen de ACTAS/para-el-documento/<id>.json (esperando al documento) y ACTAS/enviadas/<id>.json (ya escritas). Cada punto
   lleva `alumnado: [{nombre, grupo, enLista}]` desde que «Crear acta» lo guarda; las actas anteriores se leen por el nombre en el párrafo. */
(function (g) {
  'use strict';
  var A = g.Alumnado, PARA = 'para-el-documento', HECHAS = 'enviadas';
  var AVISO_PIE = 'Correcciones hechas después en el documento no aparecen aquí';
  var VACIA = 'Todavía no aparece en ninguna acta creada con Mis actas';

  /* «2026-2027» o «26-27» -> 2026 (el año en que empieza el curso), o null. */
  function anioCurso(curso) {
    var m = /(\d{2,4})\s*[-–\/]\s*(\d{2,4})/.exec(String(curso || ''));
    if (!m) return null;
    var a = Number(m[1]);
    return a < 100 ? 2000 + a : a;
  }
  /* El curso (año de inicio) al que pertenece una fecha aaaa-mm-dd: de septiembre a junio. */
  function cursoDeFecha(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
    if (!m) return null;
    return Number(m[2]) >= 9 ? Number(m[1]) : Number(m[1]) - 1;
  }

  async function leerBueno(raiz, ruta) { try { return await raiz.leerJSON(ruta); } catch (e) { return null; } }

  /* Todas las actas creadas del curso de la ficha, sin repetir (misma fecha de reunión: la última que se mandó), de la más antigua a la más reciente. */
  async function leerActas(raiz, ficha) {
    var anio = anioCurso(ficha && ficha.curso), todas = [], carpetas = [PARA, HECHAS];
    for (var c = 0; c < carpetas.length; c++) {
      var nombres = await raiz.listarJSON(carpetas[c]);
      for (var i = 0; i < nombres.length; i++) {
        var e = await leerBueno(raiz, carpetas[c] + '/' + nombres[i]);
        if (e && e.id && e.fecha && Array.isArray(e.puntos)) todas.push(e);
      }
    }
    var porFecha = {};
    todas.forEach(function (e) {
      var otro = porFecha[e.fecha];
      if (!otro || String(e.enviado || '') >= String(otro.enviado || '')) porFecha[e.fecha] = e;
    });
    return Object.keys(porFecha).sort().map(function (k) { return porFecha[k]; })
      .filter(function (e) { return anio == null || cursoDeFecha(e.fecha) === anio; });
  }

  function claveNombre(a) { return A.normalizar(a.nombre).replace(/\s+/g, ' ').trim(); }
  function mismoGrupo(x, y) { return !x || !y || A.normalizar(x) === A.normalizar(y); }
  /* ¿La misma persona? Mismo nombre y mismo grupo; «sin grupo» vale con cualquiera. */
  function mismoAlumno(a, b) { return claveNombre(a) === claveNombre(b) && mismoGrupo(a.grupo, b.grupo); }

  /* ¿El párrafo nombra al alumno por su nombre completo (con o sin «(grupo)»)? Sin mayúsculas ni tildes; un nombre suelto no cuenta. */
  function nombra(parrafo, alumno) {
    var t = A.normalizar(parrafo), n = claveNombre(alumno), desde = 0;
    if (!n) return false;
    for (;;) {
      var i = t.indexOf(n, desde);
      if (i < 0) return false;
      desde = i + 1;
      var antes = i > 0 ? Array.from(t.slice(0, i)).pop() : '', despues = t.slice(i + n.length);
      if (A.esLetra(antes) || A.esLetra(despues.charAt(0))) continue;
      var gr = /^\s*\(([^)]*)\)/.exec(despues);
      if (gr && alumno.grupo && A.normalizar(gr[1]).trim() !== A.normalizar(alumno.grupo).trim()) continue;
      return true;
    }
  }
  function parrafosDe(punto) {
    return String(punto.parrafo || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /* Lo dicho del alumno en un punto: la lista de párrafos, o [] si no sale. */
  function dichoEnPunto(punto, alumno) {
    if (!punto || punto.fijo) return [];
    var todos = parrafosDe(punto);
    if (!todos.length) return [];
    var propios = todos.filter(function (p) { return nombra(p, alumno); });
    if (propios.length) return propios;
    var enLista = (punto.alumnado || []).some(function (x) { return x && mismoAlumno(x, alumno); });
    return enLista ? [todos.join('\n')] : [];
  }

  /* La ficha: { alumno, curso, reuniones: [{ fecha, puntos: [{ titulo, parrafos }] }] }, de la reunión más antigua a la más reciente. */
  function ficha(actas, alumno, curso) {
    var reuniones = [];
    (actas || []).forEach(function (e) {
      var puntos = [];
      e.puntos.forEach(function (p) {
        var dicho = dichoEnPunto(p, alumno);
        if (dicho.length) puntos.push({ titulo: String(p.titulo || ''), parrafos: dicho });
      });
      if (puntos.length) reuniones.push({ fecha: e.fecha, puntos: puntos });
    });
    reuniones.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
    return { alumno: alumno, curso: curso || '', reuniones: reuniones };
  }

  /* Los alumnos citados en las actas, sin repetir: [{ nombre, grupo, enLista }]. Uno «sin grupo» se funde con el mismo nombre con grupo. */
  function citados(actas) {
    var res = [];
    (actas || []).forEach(function (e) {
      e.puntos.forEach(function (p) {
        (p.alumnado || []).forEach(function (x) {
          if (!x || !String(x.nombre || '').trim()) return;
          var a = { nombre: String(x.nombre).trim(), grupo: String(x.grupo || ''), enLista: x.enLista !== false };
          var dup = res.filter(function (r) { return claveNombre(r) === claveNombre(a); });
          if (dup.some(function (r) { return A.normalizar(r.grupo) === A.normalizar(a.grupo); })) return;
          if (!a.grupo && dup.length) return;
          if (a.grupo) res = res.filter(function (r) { return !(claveNombre(r) === claveNombre(a) && !r.grupo); });
          res.push(a);
        });
      });
    });
    return res;
  }

  /* Alumnado en el que buscar: el del ciclo (Rúbricas) y los citados en las actas que no están ya. */
  function candidatos(lista, actas) {
    var base = ((lista && lista.delCiclo) || []).map(function (a) { return { nombre: a.nombre, grupo: a.grupo, enLista: true }; });
    citados(actas).forEach(function (c) {
      if (!base.some(function (b) { return mismoAlumno(b, c); })) base.push(c);
    });
    return base;
  }

  /* Fecha larga de la reunión («23 de octubre de 2026»). */
  function fechaLarga(iso) { try { return g.fechaLarga ? g.fechaLarga(iso) : g.fechaCorta(iso); } catch (e) { return String(iso); } }

  /* La ficha como texto plano (para copiar y de reserva). */
  function aTexto(f, fechaDe) {
    var fd = fechaDe || fechaLarga, l = ['Ficha de ' + A.etiqueta(f.alumno)];
    if (f.curso) l.push('Curso ' + f.curso);
    l.push('');
    if (!f.reuniones.length) l.push(VACIA + '.', '');
    f.reuniones.forEach(function (r) {
      l.push('Reunión del ' + fd(r.fecha));
      r.puntos.forEach(function (p) { l.push(p.titulo); p.parrafos.forEach(function (x) { l.push(x); }); l.push(''); });
    });
    l.push(AVISO_PIE + '.');
    return l.join('\n');
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /* La ficha como HTML sencillo (para pegar con formato en un correo o un documento). */
  function aHtml(f, fechaDe) {
    var fd = fechaDe || fechaLarga, h = ['<h2>Ficha de ' + esc(A.etiqueta(f.alumno)) + '</h2>'];
    if (f.curso) h.push('<p>Curso ' + esc(f.curso) + '</p>');
    if (!f.reuniones.length) h.push('<p>' + esc(VACIA) + '.</p>');
    f.reuniones.forEach(function (r) {
      h.push('<h3>Reunión del ' + esc(fd(r.fecha)) + '</h3>');
      r.puntos.forEach(function (p) {
        h.push('<p><b>' + esc(p.titulo) + '</b></p>');
        p.parrafos.forEach(function (x) { h.push('<p>' + esc(x).replace(/\n/g, '<br>') + '</p>'); });
      });
    });
    h.push('<p><i>' + esc(AVISO_PIE) + '.</i></p>');
    return h.join('\n');
  }

  g.Fichas = { AVISO_PIE: AVISO_PIE, VACIA: VACIA, anioCurso: anioCurso, cursoDeFecha: cursoDeFecha, leerActas: leerActas, mismoAlumno: mismoAlumno,
    nombra: nombra, dichoEnPunto: dichoEnPunto, ficha: ficha, citados: citados, candidatos: candidatos, aTexto: aTexto, aHtml: aHtml };
})(typeof window !== 'undefined' ? window : globalThis);
