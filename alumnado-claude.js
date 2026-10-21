/* El alumnado y Claude: a Claude solo van iniciales entre corchetes («[M.S.P.]»); al volver, cada marca se cambia por «Nombre Apellidos (grupo)».
   También la red de seguridad: busca nombres de alumnado escritos o dictados sin elegir de la lista y los marca antes de enviar.
   Sin pantalla ni red: se prueba con node --test. Usa alumnado.js. */
(function (g) {
  'use strict';
  var A = g.Alumnado;
  var MARCA = /\[(?:[A-ZÁÉÍÓÚÜÑ]\.)+\d*\]/g;
  var AVISO_VARIOS = 'Elige el alumno de la lista: hay varios con ese nombre';
  var AVISO_NOMBRES = 'Revisa este párrafo: Claude ha cambiado los nombres';

  /* «María del Carmen de la Torre Gil» -> «M.C.T.G.» (sin contar de, del, la, las, los, y). */
  function iniciales(nombre) {
    var l = A.palabras(nombre).filter(function (w) { return A.PARTICULAS.indexOf(A.normalizar(w)) < 0; });
    return l.map(function (w) { var c = Array.from(w.replace(/^[^A-Za-zÀ-ÿ]+/, ''))[0]; return c ? c.toUpperCase() + '.' : ''; }).join('');
  }

  /* --- Red de seguridad --- */
  function patronesDe(a) {
    var norm = A.normalizar, res = [norm(a.nombre)];
    if (a.apellidos) {
      res.push(norm(a.apellidos + ' ' + a.pila));
      var ap = A.palabras(a.apellidos), corto = [];
      for (var i = 0; i < ap.length; i++) { corto.push(ap[i]); if (A.PARTICULAS.indexOf(norm(ap[i])) < 0) break; }
      if (a.pila) res.push(norm(a.pila + ' ' + corto.join(' ')));
    }
    return res.filter(function (p, i) { return A.palabras(p).length >= 2 && res.indexOf(p) === i; });
  }
  function claveAlumno(a) { return A.normalizar(a.nombre) + '|' + A.normalizar(a.grupo); }

  /* Un índice con todos los nombres posibles, por su primera palabra, los más largos antes. */
  function indice(todos) {
    var porPatron = {}, porPrimera = {};
    (todos || []).forEach(function (a) {
      patronesDe(a).forEach(function (p) {
        var e = porPatron[p]; if (!e) e = porPatron[p] = { patron: p, alumnos: {} };
        e.alumnos[claveAlumno(a)] = a;
      });
    });
    Object.keys(porPatron).forEach(function (p) {
      var e = porPatron[p], w = A.palabras(p)[0];
      e.regex = new RegExp(A.palabras(p).map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('\\s+'), 'y');
      (porPrimera[w] = porPrimera[w] || []).push(e);
    });
    Object.keys(porPrimera).forEach(function (w) { porPrimera[w].sort(function (x, y) { return y.patron.length - x.patron.length; }); });
    return porPrimera;
  }

  /* Un texto normal -> trozos [{ texto } | { alumno } | { ambiguo: { texto } }]. Solo nombres de dos palabras o más. */
  function detectar(texto, ind) {
    var t = String(texto), n = A.normalizar(t), res = [], ultimo = 0, i = 0;
    while (i < n.length) {
      if (!A.esLetra(n.charAt(i)) || (i > 0 && A.esLetra(n.charAt(i - 1)))) { i++; continue; }
      var fin = i; while (fin < n.length && A.esLetra(n.charAt(fin))) fin++;
      var cand = ind[n.slice(i, fin)], hallado = null;
      for (var k = 0; cand && k < cand.length && !hallado; k++) {
        cand[k].regex.lastIndex = i;
        var m = cand[k].regex.exec(n);
        if (m && !A.esLetra(n.charAt(i + m[0].length))) hallado = { e: cand[k], largo: m[0].length };
      }
      if (!hallado) { i = fin; continue; }
      if (i > ultimo) res.push({ texto: t.slice(ultimo, i) });
      var alumnos = Object.keys(hallado.e.alumnos).map(function (c) { return hallado.e.alumnos[c]; });
      if (alumnos.length === 1) res.push({ alumno: { nombre: alumnos[0].nombre, grupo: alumnos[0].grupo, enLista: true } });
      else res.push({ ambiguo: { texto: t.slice(i, i + hallado.largo) } });
      ultimo = i + hallado.largo; i = ultimo;
    }
    if (ultimo < t.length) res.push({ texto: t.slice(ultimo) });
    return res;
  }

  /* --- Hacia Claude y de vuelta --- */

  /* puntos: [{ n, titulo, notas }]; todos: todo el alumnado de Rúbricas (o null si no hay lista).
     Devuelve { puntos: [{ n, titulo, notas }] (lo que sale hacia Claude, solo iniciales),
                marcas: { n: { '[M.S.P.]': 'Marta Sánchez Pino (3º B)' } }, notasMarcadas: { n: notas con los alumnos detectados ya marcados },
                avisos: { n: texto } }. Las iniciales repetidas entre alumnos distintos de la misma petición se numeran. */
  function preparar(puntos, todos) {
    var ind = todos && todos.length ? indice(todos) : null;
    var marcaDe = {}, usadas = {}, res = { puntos: [], marcas: {}, notasMarcadas: {}, avisos: {} };

    function asignar(clave, nombre) {
      if (marcaDe[clave]) return marcaDe[clave];
      var base = iniciales(nombre) || 'X.', k = usadas[base] = (usadas[base] || 0) + 1;
      return (marcaDe[clave] = '[' + base + (k > 1 ? k : '') + ']');
    }

    puntos.forEach(function (p) {
      var trozos = [];
      A.trozos(p.notas).forEach(function (x) {
        if (x.alumno || !ind) trozos.push(x); else detectar(x.texto, ind).forEach(function (y) { trozos.push(y); });
      });
      var marcas = {}, aClaude = '', marcadas = '';
      trozos.forEach(function (x) {
        if (x.alumno) {
          var m = asignar('a|' + claveAlumno(x.alumno), x.alumno.nombre);
          marcas[m] = A.etiqueta(x.alumno); aClaude += m; marcadas += A.marca(x.alumno);
        } else if (x.ambiguo) {
          var m2 = asignar('x|' + A.normalizar(x.ambiguo.texto).replace(/\s+/g, ' '), x.ambiguo.texto);
          marcas[m2] = x.ambiguo.texto; aClaude += m2; marcadas += x.ambiguo.texto; res.avisos[p.n] = AVISO_VARIOS;
        } else { aClaude += x.texto; marcadas += x.texto; }
      });
      res.puntos.push({ n: p.n, titulo: p.titulo, notas: aClaude.trim() });
      res.marcas[p.n] = marcas; res.notasMarcadas[p.n] = marcadas;
    });
    return res;
  }

  function marcasEn(texto) { return String(texto || '').match(MARCA) || []; }

  /* ¿El párrafo trae exactamente las marcas que se enviaron para ese punto (ni una menos, ni una de más)? */
  function marcasBien(parrafo, marcas) {
    var hay = marcasEn(parrafo), enviadas = Object.keys(marcas || {});
    return hay.every(function (m) { return enviadas.indexOf(m) >= 0; }) && enviadas.every(function (m) { return hay.indexOf(m) >= 0; });
  }

  /* Cada marca vuelve a ser «Nombre Apellidos (grupo)». */
  function restaurar(parrafo, marcas) {
    return String(parrafo || '').replace(MARCA, function (m) { return marcas && marcas[m] != null ? marcas[m] : m; });
  }

  /* ¿Queda alguna marca de iniciales sin cambiar en el párrafo? (para el aviso de la revisión) */
  function quedanMarcas(parrafo) { return marcasEn(parrafo).length > 0; }

  g.AlumnadoClaude = {
    AVISO_VARIOS: AVISO_VARIOS, AVISO_NOMBRES: AVISO_NOMBRES, iniciales: iniciales, indice: indice, detectar: detectar, preparar: preparar,
    marcasEn: marcasEn, marcasBien: marcasBien, restaurar: restaurar, quedanMarcas: quedanMarcas
  };
})(typeof window !== 'undefined' ? window : globalThis);
