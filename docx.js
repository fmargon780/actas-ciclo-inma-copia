/* Lee el texto de un documento de Word (.docx) en el navegador, sin librerías: un .docx es un zip y el texto está en word/document.xml.
   Las listas numeradas de Word/Google Docs no llevan el número en el texto: aquí se les pone («1. ») para que el acta se lea como en pantalla.
   Sin pantalla: se prueba con node --test (DecompressionStream existe en Chrome y en Node). */
(function (g) {
  'use strict';

  async function inflar(bytes) {
    var flujo = new Blob([bytes]).stream().pipeThrough(new g.DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(flujo).arrayBuffer());
  }

  /* Las entradas del zip: { 'ruta': Uint8Array sin comprimir }, solo las que pide `quiero`. */
  async function leerZip(buffer, quiero) {
    var v = new DataView(buffer), b = new Uint8Array(buffer), i, res = {};
    for (i = b.length - 22; i >= 0 && v.getUint32(i, true) !== 0x06054b50; i--) { /* busca el final del zip */ }
    if (i < 0) throw new Error('Este fichero no es un documento de Word (.docx).');
    var n = v.getUint16(i + 10, true), p = v.getUint32(i + 16, true);
    for (var k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      var metodo = v.getUint16(p + 10, true), comp = v.getUint32(p + 20, true), largoN = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), coment = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
      var nombre = new TextDecoder().decode(b.subarray(p + 46, p + 46 + largoN));
      if (quiero.indexOf(nombre) >= 0) {
        var datos = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true), crudo = b.subarray(datos, datos + comp);
        res[nombre] = metodo === 0 ? crudo : await inflar(crudo);
      }
      p += 46 + largoN + extra + coment;
    }
    return res;
  }

  function decodificar(t) {
    return t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (m, e) {
      if (e.charAt(0) === '#') return String.fromCodePoint(e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
    });
  }

  /* numbering.xml -> { numId: { ilvl: 'decimal' | 'bullet' | ... } } */
  function formatosNumeracion(xml) {
    var abstractos = {}, res = {};
    (xml.match(/<w:abstractNum\b[\s\S]*?<\/w:abstractNum>/g) || []).forEach(function (a) {
      var id = (/w:abstractNumId="(\d+)"/.exec(a) || [])[1], niveles = {};
      (a.match(/<w:lvl\b[\s\S]*?<\/w:lvl>/g) || []).forEach(function (l) {
        niveles[(/w:ilvl="(\d+)"/.exec(l) || [, '0'])[1]] = (/<w:numFmt w:val="([^"]+)"/.exec(l) || [, 'decimal'])[1];
      });
      abstractos[id] = niveles;
    });
    (xml.match(/<w:num\b[\s\S]*?<\/w:num>/g) || []).forEach(function (m) {
      var id = (/w:numId="(\d+)"/.exec(m) || [])[1], a = (/<w:abstractNumId w:val="(\d+)"/.exec(m) || [])[1];
      if (id && abstractos[a]) res[id] = abstractos[a];
    });
    return res;
  }

  /* El texto de word/document.xml: un párrafo por línea. */
  function textoDeXml(xml, numeracion) {
    var lineas = [], contador = {};
    (xml.match(/<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) || []).forEach(function (p) {
      var t = '';
      p.replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g, function (m, texto) {
        t += texto != null ? decodificar(texto) : (m.indexOf('tab') > 0 ? '\t' : '\n');
      });
      var num = /<w:numPr>[\s\S]*?<\/w:numPr>/.exec(p);
      if (num && t.trim()) {
        var ilvl = (/<w:ilvl w:val="(\d+)"/.exec(num[0]) || [, '0'])[1], id = (/<w:numId w:val="(\d+)"/.exec(num[0]) || [])[1];
        var formato = numeracion && numeracion[id] && numeracion[id][ilvl];
        if (formato === 'bullet') t = '• ' + t;
        else if (formato) {
          var clave = id + '|' + ilvl;
          contador[clave] = (contador[clave] || 0) + 1;
          t = contador[clave] + '. ' + t;
        }
      }
      lineas.push(t.replace(/[ \t]+/g, ' ').trim());
    });
    return lineas.join('\n');
  }

  /* buffer: ArrayBuffer de un .docx -> texto. */
  async function leerTexto(buffer) {
    var z = await leerZip(buffer, ['word/document.xml', 'word/numbering.xml']), dec = new TextDecoder();
    if (!z['word/document.xml']) throw new Error('Este fichero no es un documento de Word (.docx).');
    return textoDeXml(dec.decode(z['word/document.xml']), z['word/numbering.xml'] ? formatosNumeracion(dec.decode(z['word/numbering.xml'])) : null);
  }

  g.Docx = { leerTexto: leerTexto, textoDeXml: textoDeXml };
})(typeof window !== 'undefined' ? window : globalThis);
