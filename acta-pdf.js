/* El acta de ciclo en PDF (A4, membrete oficial), con pdf-lib (pagina/lib/pdf-lib.min.js, dentro del repositorio).
   Recibe el modelo de montarActa() y el membrete leído de la plantilla. Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var A4 = [595.28, 841.89], IZQ = 56.7, DER = 65.2, ARRIBA = 105.15, ABAJO = 90.7, ANCHO = A4[0] - IZQ - DER;
  var TAM = 11, LINEA = 14.5, DESPUES = 6, EMU = 12700;
  var GRIS = [0.6, 0.6, 0.6], FONDO = [0.933, 0.933, 0.933];

  /* modelos: uno o varios actas (el libro del curso): cada una empieza en página nueva con el membrete completo. */
  async function crearLibro(modelos, membrete, opciones) {
    var P = g.PDFLib, doc = await P.PDFDocument.create(), rgb = P.rgb, modelo = modelos[0];
    var normal = await doc.embedFont(P.StandardFonts.Helvetica), negrita = await doc.embedFont(P.StandardFonts.HelveticaBold);
    var cursiva = await doc.embedFont(P.StandardFonts.HelveticaOblique), negritaCursiva = await doc.embedFont(P.StandardFonts.HelveticaBoldOblique);
    var validos = {};
    normal.getCharacterSet().forEach(function (c) { validos[c] = true; });
    var colegio = (opciones && opciones.colegio) || membrete.colegio;
    var imgs = {};
    for (var k in membrete.imagenes) {
      var im = membrete.imagenes[k];
      if (im) imgs[k] = im.tipo === 'png' ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
    }
    doc.setTitle(opciones && opciones.tituloLibro ? opciones.tituloLibro : modelo.titulo); doc.setProducer('Mis actas'); doc.setCreator('Mis actas');

    function limpio(t) {
      var s = String(t).replace(/[   ]/g, ' ').replace(/\t/g, ' ').replace(/[‘’]/g, '’').replace(/[​-‏﻿]/g, '');
      return Array.from(s).map(function (c) { return validos[c.codePointAt(0)] ? c : '?'; }).join('');
    }
    function ancho(t, f, tam) { return f.widthOfTextAtSize(t, tam || TAM); }
    function color(c) { return rgb(c[0], c[1], c[2]); }
    function imagen(pag, nombre, x, ytop, wEmu, hEmu) {
      var w = wEmu / EMU, h = hEmu / EMU;
      pag.drawImage(imgs[nombre], { x: x, y: ytop - h, width: w, height: h });
    }

    var AZUL = [0.02, 0.27, 0.65];
    function cabeceraYPie(pag, primera) {
      var top = A4[1] - 35.45;
      if (primera) {
        var x = IZQ + 5776 / 20, yc = top - 30;
        if (membrete.sinJunta) {
          /* sin logo de la Junta: el nombre del colegio, en negrita, arriba a la izquierda y a la altura que tenía la línea de la Consejería */
          pag.drawText(limpio(colegio), { x: IZQ, y: yc, size: 9, font: negrita });
        } else {
          imagen(pag, 'junta', IZQ, top - (60 - 718840 / EMU) / 2, 1259840, 718840);
          pag.drawText(limpio(membrete.consejeria), { x: x, y: yc, size: 9, font: negrita });
          pag.drawText(limpio(colegio), { x: x, y: yc - 11, size: 9, font: normal });
        }
        var base = 33, alto = 680085 / EMU, logo = imgs.ceip, xTexto = IZQ;
        if (logo) {
          var m = g.Membrete.encajar(membrete.imagenes.ceip);
          imagen(pag, 'ceip', IZQ, base + (alto + m.cy / EMU) / 2, m.cx, m.cy);
          xTexto = IZQ + (membrete.sinJunta ? 1562 : 6242) / 20; /* sin el escudo, el texto se corre a la izquierda y ocupa su hueco */
        }
        if (!membrete.sinJunta) imagen(pag, 'escudo', IZQ + 9486 / 20, base + alto, 468630, 680085);
        /* dos parejas (dirección + localidad, teléfono + correo); las líneas vacías no se dibujan y la pareja que se queda sin líneas pierde su hueco */
        var parejas = [[membrete.pie[0], membrete.pie[1]], [membrete.pie[2], membrete.pie[3]]].map(function (par) { return par.filter(Boolean); }).filter(function (par) { return par.length; });
        var nLineas = parejas.reduce(function (s, par) { return s + par.length; }, 0);
        var y = base + alto / 2 + 1.6 + ((nLineas - 1) * 9.6 + (parejas.length - 1) * 4) / 2;
        parejas.forEach(function (par) { par.forEach(function (t) { pag.drawText(limpio(t), { x: xTexto, y: y, size: 8, font: normal }); y -= 9.6; }); y -= 4; });
      } else {
        if (!membrete.sinJunta) imagen(pag, 'simbolo', IZQ, top, 563880, 530352);
        var t = limpio(opciones && opciones.pie ? opciones.pie : membrete.pieCiclo), w = ancho(t, normal, 8.5);
        pag.drawText(t, { x: IZQ + (ANCHO - w) / 2, y: 36, size: 8.5, font: normal, color: rgb(0.392, 0.392, 0.392) });
      }
    }

    var pagina = null, y = 0, primeraDeActa = true;
    function nueva() { pagina = doc.addPage(); pagina.setSize(A4[0], A4[1]); cabeceraYPie(pagina, primeraDeActa); primeraDeActa = false; y = A4[1] - ARRIBA; }
    function hueco(alto) { if (y - alto < ABAJO) nueva(); }

    /* Parte un texto en líneas que quepan en `maximo`. */
    function partir(texto, f, maximo) {
      var palabras = limpio(texto).split(/ +/).filter(Boolean), res = [], actual = '';
      palabras.forEach(function (p) {
        var prueba = actual ? actual + ' ' + p : p;
        if (!actual || ancho(prueba, f) <= maximo) actual = prueba; else { res.push(actual); actual = p; }
      });
      if (actual || !res.length) res.push(actual);
      return res;
    }
    function dibujaLinea(t, f, x, maximo, alin, justificar, col) {
      var yy = y - TAM * 0.95, opc = { y: yy, size: TAM, font: f };
      if (col) opc.color = color(col);
      if (justificar) {
        var ps = t.split(' '), suma = ps.reduce(function (s, p) { return s + ancho(p, f); }, 0), sep = (maximo - suma) / (ps.length - 1), cx = x;
        ps.forEach(function (p) { pagina.drawText(p, Object.assign({ x: cx }, opc)); cx += ancho(p, f) + sep; });
        return;
      }
      var w = ancho(t, f);
      pagina.drawText(t, Object.assign({ x: alin === 'centro' ? x + (maximo - w) / 2 : x }, opc));
    }
    /* Un párrafo: opc = { negrita, alin: 'izq'|'centro'|'justificado', sangria, primera, antes, gris }. */
    function parrafo(texto, opc) {
      opc = opc || {};
      var f = opc.negrita ? negrita : normal, sang = opc.sangria || 0, prim = opc.primera == null ? sang : opc.primera;
      if (opc.antes) y -= opc.antes;
      var lineas = partir(texto, f, ANCHO - Math.max(sang, prim)), i, linea;
      /* las líneas se parten con el ancho de la sangría mayor; el reparto exacto es secundario */
      hueco(LINEA * (opc.juntoConSiguiente ? lineas.length + 2 : Math.min(lineas.length, 2)));
      for (i = 0; i < lineas.length; i++) {
        hueco(LINEA);
        linea = lineas[i];
        var x = IZQ + (i === 0 ? prim : sang), max = ANCHO - (i === 0 ? prim : sang);
        if (linea) dibujaLinea(linea, f, x, max, opc.alin, opc.alin === 'justificado' && i < lineas.length - 1 && linea.indexOf(' ') > 0, opc.gris ? GRIS : null);
        y -= LINEA;
      }
      y -= DESPUES;
      return lineas.length;
    }
    function vacio() { y -= LINEA + DESPUES; if (y < ABAJO) nueva(); }
    function vineta(texto, gris) {
      var lineas = partir(texto, normal, ANCHO - 36);
      hueco(LINEA * Math.min(lineas.length, 2));
      lineas.forEach(function (l, i) {
        hueco(LINEA);
        if (i === 0) pagina.drawText('•', { x: IZQ + 18, y: y - TAM * 0.95, size: TAM, font: normal, color: color(gris ? GRIS : [0, 0, 0]) });
        dibujaLinea(l, normal, IZQ + 36, ANCHO - 36, 'justificado', i < lineas.length - 1 && l.indexOf(' ') > 0, gris ? GRIS : null);
        y -= LINEA;
      });
      y -= DESPUES;
    }


    /* Párrafos con tramos (negrita, cursiva, enlaces): para las actas traídas. Se reparte en palabras; los enlaces van en azul y subrayados y se pueden pulsar. */
    function fuenteDe(r) { return r.b ? (r.i ? negritaCursiva : negrita) : (r.i ? cursiva : normal); }
    function palabras(runs) {
      var res = [], pegado = false;
      runs.forEach(function (r) {
        var f = fuenteDe(r);
        limpio(r.t.replace(/\n/g, ' ')).split(/( +)/).forEach(function (p) {
          if (!p) return;
          if (/^ +$/.test(p)) { pegado = res.length > 0; return; }
          res.push({ t: p, f: f, h: r.h || '', sp: pegado }); pegado = false;
        });
      });
      return res;
    }
    function lineasDeRuns(runs, maximo, tam) {
      var ps = palabras(runs), sp = normal.widthOfTextAtSize(' ', tam), lineas = [], act = [], w = 0;
      ps.forEach(function (p) {
        p.w = p.f.widthOfTextAtSize(p.t, tam);
        var extra = act.length && p.sp ? sp : 0;
        if (act.length && w + extra + p.w > maximo) { lineas.push(act); act = []; w = 0; extra = 0; }
        w += extra + p.w; act.push(p);
      });
      lineas.push(act);
      return lineas;
    }
    function enlace(pag, url, x, yy, w, tam) {
      var P2 = g.PDFLib;
      pag.drawRectangle({ x: x, y: yy - 1.8, width: w, height: 0.5, color: color(AZUL) });
      var nota = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x, yy - 2, x + w, yy + tam], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: P2.PDFString.of(url) } });
      pag.node.addAnnot(doc.context.register(nota));
    }
    /* Dibuja una línea de palabras en (x, yBase). Si `justifica`, reparte el espacio sobrante entre las palabras separadas. */
    function dibujaPalabras(pag, linea, x, yBase, maximo, tam, justifica, gris) {
      var sp = normal.widthOfTextAtSize(' ', tam), gaps = linea.filter(function (p, i) { return i && p.sp; }).length, suma = linea.reduce(function (s, p) { return s + p.w; }, 0);
      var huecoSp = justifica && gaps ? (maximo - suma) / gaps : sp, cx = x, grupo = null;
      function cerrar() { if (grupo) { enlace(pag, grupo.h, grupo.x0, yBase, grupo.x1 - grupo.x0, tam); grupo = null; } }
      linea.forEach(function (p, i) {
        if (i && p.sp) cx += huecoSp;
        pag.drawText(p.t, { x: cx, y: yBase, size: tam, font: p.f, color: p.h ? color(AZUL) : gris ? color(GRIS) : rgb(0, 0, 0) });
        if (grupo && grupo.h !== p.h) cerrar();
        if (p.h) { if (!grupo) grupo = { h: p.h, x0: cx, x1: cx }; grupo.x1 = cx + p.w; }
        cx += p.w;
      });
      cerrar();
    }
    /* opc: { sangria, primera, vineta, antes }. */
    function parrafoRuns(runs, opc) {
      opc = opc || {};
      var sang = opc.vineta ? 36 : (opc.sangria || 0), prim = opc.vineta ? 36 : (opc.primera == null ? sang : opc.primera);
      var lineas = lineasDeRuns(runs, ANCHO - Math.max(sang, prim), TAM);
      if (opc.antes) y -= opc.antes;
      hueco(LINEA * Math.min(lineas.length, 2));
      lineas.forEach(function (l, i) {
        hueco(LINEA);
        var x = IZQ + (i === 0 ? prim : sang), max = ANCHO - (i === 0 ? prim : sang);
        if (opc.vineta && i === 0) pagina.drawText('•', { x: IZQ + 18, y: y - TAM * 0.95, size: TAM, font: normal });
        dibujaPalabras(pagina, l, x, y - TAM * 0.95, max, TAM, i < lineas.length - 1 && l.length > 1, false);
        y -= LINEA;
      });
      y -= DESPUES;
    }

    /* Tablas (con celdas combinadas): las filas unidas por una celda combinada en vertical no se parten entre páginas. */
    var TT = 9.5, LT = 12, PADT = 4;
    function tablaPdf(t) {
      var suma = t.anchos.reduce(function (s, a) { return s + a; }, 0), xs = [0];
      t.anchos.forEach(function (a, i) { xs.push(xs[i] + a / suma * ANCHO); });
      var altos = t.filas.map(function () { return LT + 2 * PADT; }), pend = [], calc = t.filas.map(function () { return []; });
      t.filas.forEach(function (fila, r) {
        fila.forEach(function (c, ci) {
          if (c.vm === 'c') return;
          var w = xs[c.col + c.span] - xs[c.col] - 2 * PADT, n = 0, k = { lineas: null, alto: 0 };
          k.lineas = c.parrafos.map(function (p) { var l = lineasDeRuns(p.runs, w, TT); n += l.length; return l; });
          k.alto = Math.max(n, 1) * LT + 2 * PADT;
          calc[r][ci] = k;
          if (c.rs > 1) pend.push([r, c, k]); else altos[r] = Math.max(altos[r], k.alto);
        });
      });
      pend.forEach(function (x) {
        var r = x[0], c = x[1], tot = 0, k;
        for (k = r; k < r + c.rs; k++) tot += altos[k];
        if (tot < x[2].alto) altos[r + c.rs - 1] += x[2].alto - tot;
      });
      var pag = A4[1] - ARRIBA - ABAJO, r0 = 0;
      while (r0 < t.filas.length) {
        var r1 = r0 + 1;
        for (var k = r0; k < r1; k++) t.filas[k].forEach(function (c) { if (c.vm === 'r') r1 = Math.max(r1, k + c.rs); });
        var alto = 0;
        for (k = r0; k < r1; k++) alto += altos[k];
        if (alto > pag) { r1 = r0 + 1; alto = altos[r0]; }
        if (y - alto < ABAJO) nueva();
        var yTop = y;
        for (k = r0; k < r1; k++) {
          t.filas[k].forEach(function (c, ci) {
            if (c.vm === 'c') return;
            var rs = Math.min(c.rs, r1 - k), h = 0, q;
            for (q = k; q < k + rs; q++) h += altos[q];
            var yc = yTop - altos.slice(r0, k).reduce(function (s, a) { return s + a; }, 0), x = IZQ + xs[c.col], w = xs[c.col + c.span] - xs[c.col];
            if (yc - h < ABAJO - 0.5 && k === r0 && h > pag) h = yc - ABAJO;
            pagina.drawRectangle({ x: x, y: yc - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.75, color: c.fondo ? rgb(parseInt(c.fondo.slice(0, 2), 16) / 255, parseInt(c.fondo.slice(2, 4), 16) / 255, parseInt(c.fondo.slice(4, 6), 16) / 255) : undefined });
            var yy = yc - PADT;
            calc[k][ci].lineas.forEach(function (ls) { ls.forEach(function (l) { dibujaPalabras(pagina, l, x + PADT, yy - TT * 0.95, w - 2 * PADT, TT, false, false); yy -= LT; }); });
          });
        }
        var total = 0;
        for (k = r0; k < r1; k++) total += altos[k];
        y -= total; r0 = r1;
      }
      y -= DESPUES;
    }

    function acta(modelo) {
      /* Recuadro del título y tabla CICLO / COORDINADORA / PROFESORADO */
      function caja(x, ytop, w, alto, fondo) {
        pagina.drawRectangle({ x: x, y: ytop - alto, width: w, height: alto, borderColor: rgb(0, 0, 0), borderWidth: 1, color: fondo ? color(FONDO) : undefined });
      }
      var pad = 5, ts = partir(modelo.titulo, negrita, ANCHO - 2 * pad), cs = partir(modelo.celebrada, normal, ANCHO - 2 * pad);
      var altoCaja = (ts.length + cs.length) * LINEA + 2 * pad;
      hueco(altoCaja);
      caja(IZQ, y, ANCHO, altoCaja, true);
      var yy = y - pad;
      ts.concat(cs).forEach(function (l, i) {
        var f = i < ts.length ? negrita : normal, w = ancho(l, f);
        pagina.drawText(l, { x: IZQ + (ANCHO - w) / 2, y: yy - TAM * 0.95, size: TAM, font: f }); yy -= LINEA;
      });
      y -= altoCaja; vacio();

      var c0 = 150, c1 = ANCHO - c0;
      modelo.filas.forEach(function (fila) {
        var izq = partir(fila[0], negrita, c0 - 2 * pad), der = [];
        fila[1].forEach(function (t) { der = der.concat(partir(t, normal, c1 - 2 * pad)); });
        var alto = Math.max(izq.length, der.length) * LINEA + 2 * pad;
        hueco(alto);
        caja(IZQ, y, c0, alto, false); caja(IZQ + c0, y, c1, alto, false);
        izq.forEach(function (l, i) { pagina.drawText(l, { x: IZQ + pad, y: y - pad - i * LINEA - TAM * 0.95, size: TAM, font: negrita }); });
        der.forEach(function (l, i) { pagina.drawText(l, { x: IZQ + c0 + pad, y: y - pad - i * LINEA - TAM * 0.95, size: TAM, font: normal }); });
        y -= alto;
      });
      vacio();

      parrafo((modelo.encabezados || {}).puntos || 'PUNTOS DEL DÍA', { negrita: true, alin: 'centro' });
      modelo.puntos.forEach(function (p) { parrafo(p, { sangria: 36, primera: 18 }); });
      vacio();
      parrafo((modelo.encabezados || {}).asuntos || 'ASUNTOS TRATADOS', { negrita: true, alin: 'centro', juntoConSiguiente: true });
      modelo.asuntos.forEach(function (a) {
        if (a.titulo) parrafo(a.titulo, { negrita: true, antes: DESPUES, juntoConSiguiente: true });
        (a.lineas || [{ texto: a.texto, vineta: false }]).forEach(function (l) {
          if (l.tabla) tablaPdf(l.tabla);
          else if (l.runs) parrafoRuns(l.runs, l.vineta ? { vineta: true } : l.numerada ? { sangria: 36, primera: 18 } : {});
          else if (l.vineta) vineta(l.texto, a.pendiente); else parrafo(l.texto, { alin: 'justificado', gris: a.pendiente });
        });
      });
      vacio();
      modelo.cierre.slice(0, -1).forEach(function (l) { parrafo(l, { alin: 'justificado' }); });
      vacio();
      parrafo(modelo.cierre[modelo.cierre.length - 1], { negrita: true, alin: 'centro' });
    }

    modelos.forEach(function (m, k) { if (k) primeraDeActa = true; nueva(); acta(m); });
    return doc.save();
  }

  function crear(modelo, membrete, opciones) { return crearLibro([modelo], membrete, opciones); }

  g.ActaPdf = { crear: crear, crearLibro: crearLibro };
})(typeof window !== 'undefined' ? window : globalThis);
