/* «Traer actas del documento antiguo» (fila 56), la parte que calcula: separa las actas del documento de Word, decide cuáles son de este curso,
   las guarda como datos (cabecera, orden del día, puntos con sus bloques tal cual, cierre) y las pone en el modelo del acta (PDF, Word y revisión).
   Sin pantalla ni carpeta: se prueba con node --test. Usa docx-bloques.js, fechas.js y revision.js. */
(function (g) {
  'use strict';
  var CELEBRADA = /Celebrada el d[ií]a\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i;

  function norm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim(); }
  function plano(b) { return b.runs.map(function (r) { return r.t; }).join(''); }
  function textoBloque(b) {
    if (b.t === 'p') return plano(b);
    return b.filas.map(function (f) { return f.map(function (c) { return c.parrafos.map(plano).join('\n'); }).join(' | '); }).join('\n');
  }
  function vacio(b) { return b.t === 'p' && !plano(b).trim(); }
  function lineasDe(b) { return plano(b).split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function sinNumero(t) { return String(t).replace(/^\s*\d{1,2}\s*[.)\-–]+\s*/, '').trim(); }

  /* Los bloques del documento -> [[bloques de cada acta]]. Cada acta empieza en su recuadro de título (el que lleva «Celebrada el día …»). */
  function trocear(bloques) {
    var inicios = [];
    bloques.forEach(function (b, i) { if (CELEBRADA.test(textoBloque(b))) inicios.push(i); });
    var puestos = inicios.map(function (i) {
      if (/\bacta\b/i.test(textoBloque(bloques[i]))) return i;
      for (var j = i - 1; j >= 0; j--) {
        if (vacio(bloques[j])) continue;
        return bloques[j].t === 'p' && /^acta\b/i.test(plano(bloques[j]).trim()) ? j : i;
      }
      return i;
    });
    return puestos.map(function (s, k) { return bloques.slice(s, k + 1 < puestos.length ? puestos[k + 1] : bloques.length); });
  }

  function posicion(bs, desde, fn) { for (var i = desde; i < bs.length; i++) if (fn(bs[i])) return i; return -1; }
  function esRotulo(b, que) { return b.t === 'p' && norm(plano(b)) === que; }

  /* ¿Este párrafo abre un punto de «Asuntos tratados»? Devuelve su título o null. */
  function titulo(b, esperado, estricto) {
    if (b.t !== 'p') return null;
    var t = plano(b).trim();
    if (!t) return null;
    var negrita = b.runs.every(function (r) { return r.b || !r.t.trim(); }), m = /^(\d{1,2})\s*[.)\-–]+\s*(\S[\s\S]*)$/.exec(t);
    if (m && +m[1] === esperado && (negrita || !estricto)) return m[2].trim();
    if (b.lista === 'num' && (negrita || (!estricto && b.runs[0] && b.runs[0].b))) return t;
    return null;
  }
  function partirPuntos(cuerpo) {
    for (var pasada = 0; pasada < 2; pasada++) {
      var puntos = [], previo = [];
      cuerpo.forEach(function (b) {
        var t = titulo(b, puntos.length + 1, pasada === 0);
        if (t !== null) puntos.push({ titulo: t, bloques: [] });
        else if (!vacio(b)) (puntos.length ? puntos[puntos.length - 1].bloques : previo).push(b);
      });
      if (puntos.length) { if (previo.length) puntos.unshift({ titulo: '', bloques: previo }); return puntos; }
    }
    return [{ titulo: '', bloques: cuerpo.filter(function (b) { return !vacio(b); }) }];
  }

  /* Los bloques de UN acta -> { titulo, celebrada, fecha, filas, puntosDia, puntos, cierre }. */
  function leerActa(bs) {
    var iPuntos = posicion(bs, 0, function (b) { return esRotulo(b, 'puntos del dia'); });
    var iAsuntos = posicion(bs, Math.max(iPuntos, 0), function (b) { return esRotulo(b, 'asuntos tratados'); });
    var finCabecera = iPuntos >= 0 ? iPuntos : (iAsuntos >= 0 ? iAsuntos : bs.length);
    var partesTitulo = [], celebrada = '', filas = [];
    bs.slice(0, finCabecera).forEach(function (b) {
      if (b.t === 'p') {
        lineasDe(b).forEach(function (l) { if (CELEBRADA.test(l)) celebrada = celebrada || l; else if (!filas.length) partesTitulo.push(l); });
        return;
      }
      b.filas.forEach(function (f) {
        var propio = f.length === 1 || CELEBRADA.test(f.map(function (c) { return c.parrafos.map(plano).join(' '); }).join(' '));
        if (propio) {
          f.forEach(function (c) { c.parrafos.forEach(function (p) { lineasDe(p).forEach(function (l) { if (CELEBRADA.test(l)) celebrada = celebrada || l; else partesTitulo.push(l); }); }); });
        } else {
          var lineas = [];
          f.slice(1).forEach(function (c) { c.parrafos.forEach(function (p) { lineas = lineas.concat(lineasDe(p)); }); });
          filas.push([f[0].parrafos.map(plano).join(' ').trim(), lineas.length ? lineas : ['']]);
        }
      });
    });
    var puntosDia = [];
    if (iPuntos >= 0) bs.slice(iPuntos + 1, iAsuntos >= 0 ? iAsuntos : bs.length).forEach(function (b) {
      if (b.t === 'p') lineasDe(b).forEach(function (l) { puntosDia.push(sinNumero(l)); });
    });
    var resto = iAsuntos >= 0 ? bs.slice(iAsuntos + 1) : bs.slice(finCabecera);
    var iCierre = posicion(resto, 0, function (b) { return b.t === 'p' && /^sin mas asuntos/.test(norm(plano(b))); });
    if (iCierre < 0) iCierre = posicion(resto, 0, function (b) { return b.t === 'p' && /^En [^,]{2,60}, a \d/.test(plano(b).trim()); });
    var cierre = [];
    if (iCierre >= 0) resto.slice(iCierre).forEach(function (b) { if (b.t === 'p') cierre = cierre.concat(lineasDe(b)); });
    var f = CELEBRADA.exec(celebrada);
    return { titulo: partesTitulo.join(' '), celebrada: celebrada, filas: filas, puntosDia: puntosDia, cierre: cierre,
      puntos: partirPuntos(iCierre >= 0 ? resto.slice(0, iCierre) : resto),
      fecha: f ? f[3] + '-' + ('0' + f[2]).slice(-2) + '-' + ('0' + f[1]).slice(-2) : '' };
  }

  function leerDocumento(bloques) { return trocear(bloques).map(leerActa).filter(function (a) { return a.fecha; }); }

  function todoElTexto(a) {
    var t = [a.titulo, a.celebrada].concat(a.puntosDia, a.cierre);
    a.filas.forEach(function (f) { t.push(f[0]); t = t.concat(f[1]); });
    a.puntos.forEach(function (p) { t.push(p.titulo); p.bloques.forEach(function (b) { t.push(textoBloque(b)); }); });
    return t.join('\n');
  }

  /* ¿Es de este curso? Se juntan varias señales (la cabecera sola engaña: hay actas del curso pasado con la fecha de este año en la cabecera y actas de
     este curso con el cierre del año anterior). ficha: Datos del curso. Devuelve { delCurso, puntos, motivos }. */
  function clasificar(a, ficha) {
    var anio = g.anioInicioDeTextoCurso(ficha && ficha.curso), puntos = 0, motivos = [];
    if (anio == null) throw new Error('Antes de traer actas, rellena «Datos del curso» en Ajustes.');
    function suma(n, motivo) { puntos += n; motivos.push((n > 0 ? '+' : '') + n + ' ' + motivo); }
    var porFecha = g.anioInicioCurso(a.fecha) === anio;
    suma(porFecha ? 1 : -1, 'la fecha de la cabecera ' + (porFecha ? 'es' : 'no es') + ' de este curso');
    var coord = norm(ficha.coordinadoraNombre), fila = a.filas.filter(function (f) { return norm(f[0]).indexOf('coordinador') === 0; })[0];
    if (coord && fila) { var ok = norm(fila[1].join(' ')).indexOf(coord) >= 0; suma(ok ? 2 : -2, 'la coordinadora ' + (ok ? 'es' : 'no es') + ' la de los Datos del curso'); }
    var cursos = [], re = /curso\s+(?:escolar\s+)?(\d{4})\s*[-\/–]\s*(\d{2,4})/gi, m, texto = todoElTexto(a);
    while ((m = re.exec(texto)) !== null) cursos.push(+m[1]);
    var buenos = cursos.filter(function (c) { return c === anio; }).length, malos = cursos.length - buenos;
    if (buenos && !malos) suma(1, 'dice «curso ' + anio + '-' + (anio + 1) + '»');
    else if (malos && !buenos) suma(-1, 'dice otro curso');
    var fc = a.cierre.map(function (l) { return /^\s*En [^,]+, a /.test(l) && g.fechasEnLinea(l)[0]; }).filter(Boolean)[0];
    if (fc && fc.iso) { var bien = g.anioInicioCurso(fc.iso) === anio; suma(bien ? 1 : -1, 'el cierre ' + (bien ? 'es' : 'no es') + ' de este curso'); }
    return { delCurso: puntos > 0 || (puntos === 0 && porFecha), puntos: puntos, motivos: motivos };
  }

  function textoParrafo(bloques) {
    return bloques.map(function (b) { return b.t === 'p' ? (b.lista === 'num' ? b.n + '. ' : '') + plano(b) : textoBloque(b); }).join('\n');
  }
  function recalcular(d) { d.puntos.forEach(function (p) { p.parrafo = textoParrafo(p.bloques); }); return d; }

  /* Los datos que se guardan en ACTAS/enviadas/<id>.json. id: 'traida-aaaa-mm-dd' (y '-2'… si el documento repite fecha). */
  function datos(a, id, fuente, ahora) {
    var d = { id: id, origen: 'traida', tipo: 'ciclo', fecha: a.fecha, enviado: ahora.toISOString(), traida: ahora.toISOString(), fuente: fuente,
      titulo: a.titulo, celebrada: a.celebrada, filas: a.filas, puntosDia: a.puntosDia, cierre: a.cierre,
      puntos: a.puntos.map(function (p) { return { titulo: p.titulo, bloques: p.bloques, parrafo: '' }; }) };
    return recalcular(d);
  }

  function lineaDe(b) {
    if (b.t === 'tabla') return { tabla: b };
    var runs = b.lista === 'num' ? [{ t: b.n + '. ' }].concat(b.runs) : b.runs;
    return { texto: runs.map(function (r) { return r.t; }).join(''), runs: runs, vineta: b.lista === 'vineta', numerada: b.lista === 'num' };
  }
  /* Lo mismo que devuelve montarActa(): para el PDF, el Word y el libro. */
  function modeloDe(d) {
    return { titulo: d.titulo, celebrada: d.celebrada, filas: d.filas, puntos: d.puntosDia.map(function (t, i) { return (i + 1) + '. ' + t; }),
      asuntos: d.puntos.map(function (p, i) { return { titulo: p.titulo ? (i + 1) + '. ' + p.titulo : '', lineas: p.bloques.map(lineaDe) }; }),
      cierre: d.cierre.length ? d.cierre : [''] };
  }

  /* Cambia el texto de un párrafo (conserva negrita/cursiva del primer tramo; un enlace solo si era todo el párrafo). */
  function ponerTexto(b, nuevo) {
    if (plano(b) === nuevo) return;
    var p = b.runs[0] || {}, unico = b.runs.length === 1, r = { t: nuevo };
    if (p.b) r.b = true;
    if (p.i) r.i = true;
    if (unico && p.h) r.h = p.h;
    b.runs = nuevo ? [r] : [];
  }

  /* Todo lo que tiene texto, en el orden del acta: [{ id, texto, linea, donde, set }]. `set` es null si no se puede cambiar (rótulos fijos).
     `linea` es lo que ven las reglas de «Revisar acta» (con el número de los puntos). */
  function unidades(d) {
    var u = [];
    function fijo(texto) { u.push({ id: '', texto: texto, linea: texto, donde: '', set: null }); }
    function editable(id, texto, linea, donde, set) { u.push({ id: id, texto: texto, linea: linea == null ? texto : linea, donde: donde, set: set }); }
    function parrafo(id, b, donde, prefijo) { editable(id, plano(b), (prefijo || '') + plano(b), donde, function (t) { ponerTexto(b, t); }); }
    editable('titulo', d.titulo, null, 'El título del acta', function (t) { d.titulo = t; });
    editable('celebrada', d.celebrada, null, 'La fecha y la hora de la reunión', function (t) { d.celebrada = t; });
    d.filas.forEach(function (f, i) {
      fijo(f[0]);
      f[1].forEach(function (l, j) { editable('f-' + i + '-' + j, l, null, 'La cabecera (' + f[0] + ')', function (t) { f[1][j] = t; }); });
    });
    if (d.puntosDia.length) fijo('PUNTOS DEL DÍA');
    d.puntosDia.forEach(function (t, i) { editable('d-' + i, t, (i + 1) + '. ' + t, 'El punto ' + (i + 1) + ' del orden del día', function (x) { d.puntosDia[i] = x; }); });
    fijo('ASUNTOS TRATADOS');
    d.puntos.forEach(function (p, i) {
      var donde = 'El punto ' + (i + 1);
      if (p.titulo) editable('a-' + i, p.titulo, (i + 1) + '. ' + p.titulo, donde, function (t) { p.titulo = t; });
      p.bloques.forEach(function (b, k) {
        if (b.t === 'p') { parrafo('b-' + i + '-' + k, b, donde); return; }
        b.filas.forEach(function (f, r) { f.forEach(function (c, ci) { c.parrafos.forEach(function (q, z) { if (c.vm !== 'c') parrafo('c-' + i + '-' + k + '-' + r + '-' + ci + '-' + z, q, donde + ' (tabla)'); }); }); });
      });
    });
    d.cierre.forEach(function (t, i) { editable('z-' + i, t, null, 'El cierre del acta', function (x) { d.cierre[i] = x; }); });
    return u;
  }

  /* Dónde está (en el texto) cada fragmento marcado: [[desde, hasta]] ordenados y sin solaparse. */
  function rangosDe(texto, marcas) {
    var r = [];
    marcas.forEach(function (m) {
      [m.fragmento, sinNumero(m.fragmento)].some(function (f) {
        var desde = 0, i, hallado = false;
        while (f && (i = String(texto).indexOf(f, desde)) >= 0) { r.push([i, i + f.length]); desde = i + f.length; hallado = true; }
        return hallado;
      });
    });
    r.sort(function (a, b) { return a[0] - b[0]; });
    var fusion = [];
    r.forEach(function (x) { var l = fusion[fusion.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else fusion.push(x.slice()); });
    return fusion;
  }

  /* Lo que no cuadre, con las mismas reglas de «Revisar acta»: { porId: { id: [{ fragmento, frase }] }, otros: [{ donde, fragmento, frase }] }.
     No toca nada. ficha: Datos del curso (da el curso). fechaAnterior: aaaa-mm-dd del acta anterior del curso, o null. */
  function revisar(d, ficha, fechaAnterior) {
    var us = unidades(d), res = { porId: {}, otros: [] };
    var anio = g.anioInicioDeTextoCurso(ficha && ficha.curso);
    var hall = g.revisarLineasActa(us.map(function (x) { return x.linea; }), { anioInicio: anio == null ? g.anioInicioCurso(d.fecha) : anio, fechaAnterior: fechaAnterior || null });
    hall.forEach(function (h) {
      var x = us[h.linea];
      if (x.id) (res.porId[x.id] = res.porId[x.id] || []).push({ fragmento: h.fragmento, frase: h.frase });
      else res.otros.push({ donde: 'El acta', fragmento: h.fragmento, frase: h.frase });
    });
    return res;
  }

  g.ActaTraida = { trocear: trocear, leerActa: leerActa, leerDocumento: leerDocumento, clasificar: clasificar, datos: datos, modeloDe: modeloDe, unidades: unidades,
    recalcular: recalcular, revisar: revisar, rangosDe: rangosDe, textoBloque: textoBloque, plano: plano };
})(typeof window !== 'undefined' ? window : globalThis);
