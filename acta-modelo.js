/* El acta de ciclo como datos para el PDF, el Word y la revisión. Sin pantalla ni carpeta: se prueba con node --test.
   Usa las mismas funciones que el documento de Google (acta.js, ficha.js, revision.js y fechas.js son copias exactas de las de src/,
   vigiladas por pruebas/pagina-acta-copias.test.js): mismas frases, mismos cierres, mismas reglas de revisión. */
(function (g) {
  'use strict';

  function texto(x) { return String(x == null ? '' : x).trim(); }

  /* Lo que necesita montarActa(), sacado del envío (igual que datosDeEnvio de src/recogida.js). */
  function datosDeEnvio(env) {
    return {
      fecha: env.fecha, horaInicio: env.horaInicio, horaFin: env.horaFin, evaluacion: env.evaluacion,
      asistentes: env.asistentes || [], fechaActaAnterior: env.fechaActaAnterior || null,
      puntos: (env.puntos || []).map(function (p) { return { titulo: texto(p.titulo), parrafo: p.parrafo || '' }; })
        .filter(function (p) { return p.titulo; })
    };
  }

  /* La ficha de ACTAS/ficha.json tal como la quiere montarActa: el profesorado puede venir como lista o como texto. */
  function fichaParaActa(f) {
    f = f || {};
    var prof = Array.isArray(f.profesorado) ? f.profesorado.join('\n') : texto(f.profesorado);
    return { curso: texto(f.curso), ciclo: texto(f.ciclo), localidad: texto(f.localidad), coordinadoraCargo: texto(f.coordinadoraCargo),
      coordinadoraNombre: texto(f.coordinadoraNombre), profesorado: prof };
  }

  /* '' si la ficha vale para montar el acta; si no, la frase para quien la usa. */
  function problemaDeFichaActa(f) {
    if (!f) return 'Antes de crear el acta, rellena «Datos del curso» en Ajustes.';
    var p = g.problemaDeFicha(fichaParaActa(f));
    return p ? p + ' Se rellena en Ajustes › Datos del curso.' : '';
  }

  /* El modelo del acta (título, tablas, puntos, asuntos y cierre) y su error si los datos no valen. */
  function montar(ficha, env) {
    var d = datosDeEnvio(env), problema = g.problemaDeDatosActa(d);
    if (problema) { var e = new Error(problema); e.enEspanol = true; throw e; }
    return g.montarActa(fichaParaActa(ficha), d);
  }

  /* Las líneas del acta en el orden en que salen en el documento, cada una con de dónde viene. */
  function lineasConOrigen(m) {
    var L = [], O = [];
    function add(t, o) { L.push(t); O.push(o || { tipo: 'otro', donde: '' }); }
    add(m.titulo, { tipo: 'otro', donde: 'El título del acta' });
    add(m.celebrada, { tipo: 'otro', donde: 'La fecha y la hora de la reunión' });
    m.filas.forEach(function (f) {
      add(f[0]);
      f[1].forEach(function (l) { add(l, { tipo: f[0] === 'PROFESORADO ASISTENTE' ? 'asistente' : 'otro', donde: 'El profesorado asistente' }); });
    });
    add('PUNTOS DEL DÍA');
    m.puntos.forEach(function (t, i) { add(t, { tipo: 'titulo', punto: i }); });
    add('ASUNTOS TRATADOS');
    m.asuntos.forEach(function (a, i) {
      add(a.titulo, { tipo: 'titulo', punto: i });
      a.lineas.forEach(function (l, k) { add(l.texto, a.pendiente || a.fijo ? { tipo: 'parrafo', punto: i, linea: k, vacio: true } : { tipo: 'parrafo', punto: i, linea: k }); });
    });
    m.cierre.forEach(function (t) { add(t, { tipo: 'otro', donde: 'El cierre del acta' }); });
    return { lineas: L, origen: O };
  }

  /* La fecha (aaaa-mm-dd) del acta anterior de este mismo curso: la última que ya existe (ficha, esperando o creadas), sin contar la propia. */
  function fechaActaAnterior(b, ficha, otras) {
    var curso = g.anioInicioCurso(b.fecha), l = [];
    (otras || []).forEach(function (x) { if (x && x.fecha && x.id !== b.id) l.push(x.fecha); });
    if (ficha && ficha.ultimaActa) { try { l.push(g.fechaDesdeCorta(ficha.ultimaActa)); } catch (e) { /* fecha rara: se ignora */ } }
    l = l.filter(function (f) { try { return g.anioInicioCurso(f) === curso && f <= b.fecha; } catch (e) { return false; } }).sort();
    return l.length ? l[l.length - 1] : null;
  }

  function sinTildes(t) { return String(t).toLowerCase().replace(/\s+/g, ' ').trim(); }

  /* Lo que no cuadre: { porPunto: { i: [{ linea, fragmento, frase }] }, otros: [{ donde, fragmento, frase }] }.
     env: el envío que se haría ahora (con la fecha del acta anterior). ficha: la de ACTAS/ficha.json (o null). */
  function revisar(env, ficha) {
    var res = { porPunto: {}, otros: [] }, m;
    try { m = montar(ficha || { ciclo: 'Ciclo', localidad: 'Localidad', coordinadoraNombre: '-', profesorado: '-' }, env); } catch (e) { return res; }
    var li = lineasConOrigen(m), fijos = {};
    env.puntos.filter(function (p) { return p.titulo; }).forEach(function (p, i) { fijos[i] = !!p.fijo; });
    var hall = g.revisarLineasActa(li.lineas, { anioInicio: g.anioInicioCurso(env.fecha), fechaAnterior: env.fechaActaAnterior });
    hall.forEach(function (h) {
      var o = li.origen[h.linea];
      if (o.tipo === 'parrafo' && !fijos[o.punto]) {
        (res.porPunto[o.punto] = res.porPunto[o.punto] || []).push({ linea: o.linea, fragmento: h.fragmento, frase: h.frase });
      } else if (o.tipo === 'titulo' || o.tipo === 'parrafo') {
        res.otros.push({ donde: 'El punto ' + (o.punto + 1), fragmento: h.fragmento, frase: h.frase });
      } else {
        res.otros.push({ donde: o.donde || 'El acta', fragmento: h.fragmento, frase: h.frase });
      }
    });
    if (ficha) {
      var conocidos = (Array.isArray(ficha.profesorado) ? ficha.profesorado : String(ficha.profesorado || '').split(/\r?\n/)).map(sinTildes);
      (env.asistentes || []).forEach(function (a) {
        if (conocidos.indexOf(sinTildes(a)) < 0) res.otros.push({ donde: 'El profesorado asistente', fragmento: a, frase: 'Este docente no está en los Datos del curso: “' + a + '”.' });
      });
    }
    return res;
  }

  /* Dónde empieza y acaba (en el texto de la caja) lo que hay que marcar en la línea `linea` (contando solo las líneas con texto). */
  function rangosDeMarcas(parrafo, marcas) {
    var re = /[^\r\n]+/g, m, k = -1, rangos = [], porLinea = {};
    marcas.forEach(function (x) { (porLinea[x.linea] = porLinea[x.linea] || []).push(x); });
    while ((m = re.exec(String(parrafo || ''))) !== null) {
      if (!m[0].trim()) continue;
      k++;
      (porLinea[k] || []).forEach(function (x) {
        var desde = 0, i;
        while ((i = m[0].indexOf(x.fragmento, desde)) >= 0) { rangos.push([m.index + i, m.index + i + x.fragmento.length]); desde = i + x.fragmento.length; }
      });
    }
    rangos.sort(function (a, b) { return a[0] - b[0]; });
    var fusion = [];
    rangos.forEach(function (r) { var u = fusion[fusion.length - 1]; if (u && r[0] <= u[1]) u[1] = Math.max(u[1], r[1]); else fusion.push(r.slice()); });
    return fusion;
  }

  g.ActaModelo = { datosDeEnvio: datosDeEnvio, fichaParaActa: fichaParaActa, problemaDeFichaActa: problemaDeFichaActa, montar: montar, lineasConOrigen: lineasConOrigen,
    fechaActaAnterior: fechaActaAnterior, revisar: revisar, rangosDeMarcas: rangosDeMarcas };
})(typeof window !== 'undefined' ? window : globalThis);
