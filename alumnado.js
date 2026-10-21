/* El alumnado de «Mis actas»: leer la lista de Rúbricas, ordenar el nombre, sugerir al escribir y las marcas de alumno en las notas.
   Sin pantalla ni carpeta real (la carpeta entra por parámetro): se prueba con node --test.
   En las notas, un alumno elegido de la lista es una marca dentro del texto: ⟦Nombre Apellidos|grupo|1⟧ (el último campo es 1 si está
   en la lista de Rúbricas y 0 si no). El texto suelto de antes (iniciales a mano) se lee igual que siempre. */
(function (g) {
  'use strict';
  var ABRE = '⟦', CIERRA = '⟧';
  var PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y'];
  var CICLOS = [[/primer/i, [1, 2]], [/segundo/i, [3, 4]], [/tercer/i, [5, 6]]];

  /* Una letra por letra, sin tildes ni mayúsculas: el texto normalizado mide lo mismo que el original (sirve para buscar posiciones). */
  function normalizar(t) {
    var s = '';
    Array.from(String(t == null ? '' : t)).forEach(function (c) {
      var n = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      s += n.length === c.length ? n : (n.charAt(0) || c);
    });
    return s;
  }
  function esLetra(c) { return !!c && /[a-z0-9ñ]/.test(normalizar(c)); }
  function palabras(t) { return String(t || '').trim().split(/\s+/).filter(Boolean); }

  /* «Sánchez Pino, Marta» -> «Marta Sánchez Pino». Sin coma, tal cual. */
  function ordenNombre(crudo) {
    var t = String(crudo || '').replace(/\s+/g, ' ').trim(), i = t.indexOf(',');
    if (i < 0) return t;
    var apellidos = t.slice(0, i).trim(), pila = t.slice(i + 1).trim();
    return (pila + ' ' + apellidos).trim();
  }
  function partesNombre(crudo) {
    var t = String(crudo || '').replace(/\s+/g, ' ').trim(), i = t.indexOf(',');
    if (i >= 0) return { pila: t.slice(i + 1).trim(), apellidos: t.slice(0, i).trim() };
    var p = palabras(t);
    return { pila: p.slice(0, 1).join(' '), apellidos: p.slice(1).join(' ') };
  }

  /* El ciclo de la ficha -> los cursos que lleva ([3, 4]), o null si no se reconoce (entonces, todos los grupos). */
  function cursosDelCiclo(texto) {
    for (var i = 0; i < CICLOS.length; i++) if (CICLOS[i][0].test(String(texto || ''))) return CICLOS[i][1];
    return null;
  }
  function cursoDelGrupo(nombre) { var m = /\d/.exec(String(nombre || '')); return m ? Number(m[0]) : null; }

  /* Lee la carpeta RÚBRICAS (solo lee): formato 2 (cursos/<curso>/...) o formato 1 (grupos.json y alumnado/ en la raíz).
     raiz: el adaptador de carpeta.js (leerJSON). Devuelve { todos, delCiclo, grupos }; cada alumno { nombre, pila, apellidos, grupo, grupoId }. */
  async function leerLista(raiz, cicloFicha) {
    var base = '', config = await raiz.leerJSON('config.json');
    if (config && config.cursoActual) {
      var con = 'cursos/' + config.cursoActual + '/';
      if (await raiz.leerJSON(con + 'grupos.json')) base = con;
    }
    var grupos = (await raiz.leerJSON(base + 'grupos.json')) || [], todos = [];
    for (var i = 0; i < grupos.length; i++) {
      var gr = grupos[i], datos = null;
      try { datos = await raiz.leerJSON(base + 'alumnado/' + gr.id + '.json'); } catch (e) { datos = null; }
      ((datos && datos.alumnos) || []).forEach(function (a) {
        if (!a || !String(a.nombre || '').trim()) return;
        var p = partesNombre(a.nombre);
        todos.push({ nombre: ordenNombre(a.nombre), pila: p.pila, apellidos: p.apellidos, grupo: String(gr.nombre || ''), grupoId: gr.id });
      });
    }
    var cursos = cursosDelCiclo(cicloFicha);
    var delGrupo = function (nombre) { return !cursos || cursos.indexOf(cursoDelGrupo(nombre)) >= 0; };
    return {
      todos: todos,
      delCiclo: todos.filter(function (a) { return delGrupo(a.grupo); }),
      grupos: grupos.filter(function (x) { return delGrupo(x.nombre); }).map(function (x) { return String(x.nombre || ''); })
    };
  }

  function etiqueta(a) { return a.grupo ? a.nombre + ' (' + a.grupo + ')' : a.nombre; }

  /* Sugerencias para lo escrito (3 letras o más): alumnos en cuyo nombre cada palabra escrita es el principio de su nombre o de un apellido. Máximo 6. */
  function sugerir(lista, texto, maximo) {
    var q = palabras(normalizar(texto)).filter(function (w) { return PARTICULAS.indexOf(w) < 0; });
    if (!q.length || Array.from(q.join('')).length < 3) return [];
    var res = [];
    for (var i = 0; i < lista.length && res.length < (maximo || 6); i++) {
      var nombre = palabras(normalizar(lista[i].nombre)).filter(function (w) { return PARTICULAS.indexOf(w) < 0; });
      var todas = q.every(function (w) { return nombre.some(function (n) { return n.indexOf(w) === 0; }); });
      if (todas) res.push(lista[i]);
    }
    return res;
  }

  /* Las marcas. nombre/grupo no pueden llevar los signos de la marca. */
  function limpio(t) { return String(t || '').split(ABRE).join('').split(CIERRA).join('').split('|').join('').replace(/\s+/g, ' ').trim(); }
  function marca(a) { return ABRE + limpio(a.nombre) + '|' + limpio(a.grupo) + '|' + (a.enLista === false ? '0' : '1') + CIERRA; }

  /* El texto de las notas en trozos: [{ texto }] y [{ alumno: { nombre, grupo, enLista } }], en orden. */
  function trozos(texto) {
    var t = String(texto == null ? '' : texto), res = [], i = 0;
    while (i < t.length) {
      var a = t.indexOf(ABRE, i), c = a < 0 ? -1 : t.indexOf(CIERRA, a);
      if (a < 0 || c < 0) { res.push({ texto: t.slice(i) }); break; }
      var partes = t.slice(a + 1, c).split('|');
      if (a > i) res.push({ texto: t.slice(i, a) });
      res.push({ alumno: { nombre: partes[0] || '', grupo: partes[1] || '', enLista: partes[2] !== '0' } });
      i = c + 1;
    }
    return res;
  }

  /* Cómo se ve el texto con las marcas: «Marta Sánchez Pino (3º B)». */
  function aVisible(texto) {
    return trozos(texto).map(function (x) { return x.alumno ? etiqueta(x.alumno) : x.texto; }).join('');
  }

  /* Alumnos citados en un texto con marcas, sin repetir: [{ nombre, grupo, enLista }]. */
  function alumnosCitados(texto) {
    var vistos = {}, res = [];
    trozos(texto).forEach(function (x) {
      if (!x.alumno) return;
      var k = normalizar(x.alumno.nombre) + '|' + normalizar(x.alumno.grupo);
      if (!vistos[k]) { vistos[k] = 1; res.push({ nombre: x.alumno.nombre, grupo: x.alumno.grupo, enLista: x.alumno.enLista }); }
    });
    return res;
  }

  g.Alumnado = {
    ABRE: ABRE, CIERRA: CIERRA, PARTICULAS: PARTICULAS, normalizar: normalizar, esLetra: esLetra, palabras: palabras, ordenNombre: ordenNombre,
    cursosDelCiclo: cursosDelCiclo, leerLista: leerLista, etiqueta: etiqueta, sugerir: sugerir, marca: marca, trozos: trozos,
    aVisible: aVisible, alumnosCitados: alumnosCitados
  };
})(typeof window !== 'undefined' ? window : globalThis);
