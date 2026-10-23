/* Lee un documento de Word (.docx) con su forma: párrafos (con negritas, cursivas y enlaces), listas con «•» o numeradas y tablas (con celdas combinadas).
   Sirve para «Traer actas del documento antiguo». Sin pantalla: se prueba con node --test. Usa zip.js y docx.js.
   Un bloque es { t:'p', runs:[{t, b?, i?, h?}], lista: null|'vineta'|'num', n } o { t:'tabla', anchos:[twips], filas:[[celda]] },
   con celda = { col, span, vm: null|'r'|'c', rs, fondo, parrafos:[bloque p] }. Las tablas dentro de tablas no se leen. */
(function (g) {
  'use strict';

  function etiquetaOn(xml, etiqueta) {
    var m = new RegExp('<w:' + etiqueta + '(?:\\s[^>]*)?\\/?>').exec(xml);
    if (!m) return false;
    var v = /w:val="([^"]*)"/.exec(m[0]);
    return !v || !/^(0|false|none|off)$/i.test(v[1]);
  }

  /* Los enlaces de word/_rels/document.xml.rels: { rId: url }. */
  function enlaces(xml) {
    var res = {};
    (String(xml || '').match(/<Relationship\b[^>]*>/g) || []).forEach(function (r) {
      var id = /\bId="([^"]+)"/.exec(r), url = /\bTarget="([^"]*)"/.exec(r);
      if (id && url && /hyperlink/.test(r)) res[id[1]] = g.Docx.decodificar(url[1]);
    });
    return res;
  }

  function mismoFormato(a, b) { return !!a.b === !!b.b && !!a.i === !!b.i && (a.h || '') === (b.h || ''); }

  function runsDe(p, rels, negritaEstilo) {
    var runs = [];
    function anadir(texto, rpr, href) {
      if (!texto) return;
      var r = { t: texto };
      if (negritaEstilo || etiquetaOn(rpr, 'b')) r.b = true;
      if (etiquetaOn(rpr, 'i')) r.i = true;
      if (href) r.h = href;
      var u = runs[runs.length - 1];
      if (u && mismoFormato(u, r)) u.t += texto; else runs.push(r);
    }
    function tramos(xml, href) {
      (xml.match(/<w:r\b[\s\S]*?<\/w:r>/g) || []).forEach(function (r) {
        var rpr = (/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(r) || [''])[0], t = '';
        r.replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b[^>]*\/>/g, function (m, texto) {
          if (texto != null) t += g.Docx.decodificar(texto);
          else if (m.indexOf('tab') > 0) t += ' ';
          else if (!/w:type="page"/.test(m)) t += '\n';
          return m;
        });
        anadir(t, rpr, href);
      });
    }
    var orden = /<w:hyperlink\b([^>]*)>([\s\S]*?)<\/w:hyperlink>|<w:r\b[\s\S]*?<\/w:r>/g, m;
    while ((m = orden.exec(p)) !== null) {
      if (m[0].indexOf('<w:hyperlink') === 0) { var id = /r:id="([^"]+)"/.exec(m[1]); tramos(m[2], id && rels[id[1]] ? rels[id[1]] : ''); }
      else tramos(m[0], '');
    }
    return runs;
  }

  function parrafo(p, ctx) {
    var estilo = (/<w:pStyle w:val="([^"]+)"/.exec(p) || [])[1] || '';
    var runs = runsDe(p, ctx.rels, /^(Heading|Ttulo|Title)/i.test(estilo)), b = { t: 'p', runs: runs, lista: null, n: 0 };
    var texto = runs.map(function (r) { return r.t; }).join('');
    var num = /<w:numPr>[\s\S]*?<\/w:numPr>/.exec(p);
    if (num && texto.trim()) {
      var ilvl = (/<w:ilvl w:val="(\d+)"/.exec(num[0]) || [, '0'])[1], id = (/<w:numId w:val="(\d+)"/.exec(num[0]) || [])[1];
      var formato = ctx.numeracion && ctx.numeracion[id] && ctx.numeracion[id][ilvl];
      if (id !== '0' && formato) {
        if (formato === 'bullet') b.lista = 'vineta';
        else { var clave = id + '|' + ilvl; ctx.cuenta[clave] = (ctx.cuenta[clave] || 0) + 1; b.lista = 'num'; b.n = ctx.cuenta[clave]; }
      }
    } else if (texto.trim()) ctx.cuenta = {}; /* un párrafo normal entre medias: la numeración vuelve a empezar */
    var v = /^\s*[•·▪●]\s+/.exec(texto);
    if (!b.lista && v && runs.length) { b.lista = 'vineta'; runs[0].t = runs[0].t.slice(v[0].length); }
    return b;
  }

  function tabla(t, ctx) {
    var anchos = (t.match(/<w:gridCol\b[^>]*>/g) || []).map(function (c) { return +((/w:w="(\d+)"/.exec(c) || [, '0'])[1]); });
    var filas = (t.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || []).map(function (tr) {
      var col = 0;
      return (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(function (tc) {
        var pr = (/<w:tcPr>[\s\S]*?<\/w:tcPr>/.exec(tc) || [''])[0], span = +((/<w:gridSpan w:val="(\d+)"/.exec(pr) || [, '1'])[1]);
        var vm = /<w:vMerge\b/.test(pr) ? (/<w:vMerge w:val="restart"/.test(pr) ? 'r' : 'c') : null;
        var fondo = (/<w:shd\b[^>]*w:fill="([0-9A-Fa-f]{6})"/.exec(pr) || [])[1] || '';
        var celda = { col: col, span: span, vm: vm, rs: 1, fondo: /^(FFFFFF)$/i.test(fondo) ? '' : fondo, parrafos: [] };
        (tc.match(/<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) || []).forEach(function (p) { celda.parrafos.push(parrafo(p, ctx)); });
        col += span;
        return celda;
      });
    });
    var ncols = filas.reduce(function (m, f) { return Math.max(m, f.reduce(function (s, c) { return s + c.span; }, 0)); }, 0);
    if (anchos.length !== ncols) anchos = Array.apply(null, Array(ncols)).map(function () { return 1; });
    filas.forEach(function (f, i) {
      f.forEach(function (c) {
        if (c.vm !== 'r') return;
        for (var k = i + 1; k < filas.length; k++) {
          if (!filas[k].some(function (d) { return d.vm === 'c' && d.col === c.col; })) break;
          c.rs++;
        }
      });
    });
    return { t: 'tabla', anchos: anchos, filas: filas };
  }

  /* El cuerpo del documento -> lista de bloques. */
  function bloquesDeXml(xml, numeracion, relsXml) {
    var cuerpo = (/<w:body>([\s\S]*)<\/w:body>/.exec(xml) || [, xml])[1].replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g, '');
    var ctx = { rels: enlaces(relsXml), numeracion: numeracion || null, cuenta: {} }, res = [];
    (cuerpo.match(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) || []).forEach(function (x) {
      res.push(x.indexOf('<w:tbl>') === 0 ? tabla(x, ctx) : parrafo(x, ctx));
    });
    return res;
  }

  /* buffer: ArrayBuffer de un .docx -> bloques. */
  async function leerBloques(buffer) {
    var z = await g.Zip.leer(buffer), dec = new TextDecoder();
    if (!z['word/document.xml']) throw new Error('Este fichero no es un documento de Word (.docx).');
    var num = z['word/numbering.xml'] ? g.Docx.formatosNumeracion(dec.decode(z['word/numbering.xml'])) : null;
    return bloquesDeXml(dec.decode(z['word/document.xml']), num, z['word/_rels/document.xml.rels'] ? dec.decode(z['word/_rels/document.xml.rels']) : '');
  }

  function textoDe(b) { return b.runs.map(function (r) { return r.t; }).join(''); }

  g.DocxBloques = { leerBloques: leerBloques, bloquesDeXml: bloquesDeXml, textoDe: textoDe };
})(typeof window !== 'undefined' ? window : globalThis);
