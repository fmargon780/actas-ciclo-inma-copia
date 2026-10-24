/* El acta de ciclo en Word (.docx): se parte de la plantilla oficial (membrete, logos, A4) y solo se rellena el cuerpo.
   Recibe el modelo de montarActa() y el membrete leído de la plantilla. Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';
  var NUM_VINETA = '90';

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }

  function tramo(texto, o) {
    var rpr =  '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' + (o.negrita ? '<w:b/><w:bCs/>' : '') + (o.cursiva ? '<w:i/><w:iCs/>' : '') +
      (o.enlace ? '<w:color w:val="0645A6"/>' : o.gris ? '<w:color w:val="999999"/>' : '') + '<w:sz w:val="' + (o.tam || 22) + '"/><w:szCs w:val="' + (o.tam || 22) + '"/>' + (o.enlace ? '<w:u w:val="single"/>' : '');
    return '<w:r><w:rPr>' + rpr + '</w:rPr><w:t xml:space="preserve">' + esc(texto) + '</w:t></w:r>';
  }
  /* opc: { negrita, gris, alin: 'left'|'center'|'both', antes, despues, sangria: { izq, primera }, lista } */
  function parrafo(texto, opc) {
    opc = opc || {};
    var ppr = (opc.lista ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + NUM_VINETA + '"/></w:numPr>' : '') +
      '<w:spacing w:before="' + (opc.antes || 0) + '" w:after="' + (opc.despues == null ? 120 : opc.despues) + '" w:line="276" w:lineRule="auto"/>' +
      (opc.sangria ? '<w:ind w:left="' + opc.sangria.izq + '" w:hanging="' + (opc.sangria.izq - opc.sangria.primera) + '"/>' : '') +
      '<w:jc w:val="' + (opc.alin || 'left') + '"/>';
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + (texto === '' ? '' : tramo(texto, opc)) + '</w:p>';
  }

  /* Párrafo con tramos (negrita, cursiva, enlaces). enlaces: lista donde se apuntan las direcciones; el Id de cada enlace sale de su posición. */
  function parrafoRuns(runs, opc, enlaces) {
    opc = opc || {};
    var tam = opc.tam || 22, lista = opc.lista;
    var ppr = (lista ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + NUM_VINETA + '"/></w:numPr>' : '') +
      '<w:spacing w:before="0" w:after="' + (opc.despues == null ? 120 : opc.despues) + '" w:line="276" w:lineRule="auto"/>' +
      (opc.sangria ? '<w:ind w:left="' + opc.sangria.izq + '" w:hanging="' + (opc.sangria.izq - opc.sangria.primera) + '"/>' : '') + '<w:jc w:val="' + (opc.alin || 'left') + '"/>';
    var x = runs.map(function (r) {
      var t = tramo(r.t.replace(/\n/g, ' '), { negrita: r.b, cursiva: r.i, enlace: !!r.h, tam: tam });
      if (!r.h) return t;
      enlaces.push(r.h);
      return '<w:hyperlink r:id="rIdEnl' + enlaces.length + '" w:history="1">' + t + '</w:hyperlink>';
    }).join('');
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + x + '</w:p>';
  }

  var BORDES = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (b) { return '<w:' + b + ' w:val="single" w:sz="8" w:space="0" w:color="000000"/>'; }).join('');
  function celda(ancho, parrafos, fondo) {
    return '<w:tc><w:tcPr><w:tcW w:w="' + ancho + '" w:type="dxa"/>' + (fondo ? '<w:shd w:val="clear" w:color="auto" w:fill="' + fondo + '"/>' : '') + '</w:tcPr>' + parrafos.join('') + '</w:tc>';
  }
  function tabla(anchos, filas) {
    return '<w:tbl><w:tblPr><w:tblW w:w="' + anchos.reduce(function (a, b) { return a + b; }, 0) + '" w:type="dxa"/><w:tblBorders>' + BORDES + '</w:tblBorders><w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' +
      anchos.map(function (a) { return '<w:gridCol w:w="' + a + '"/>'; }).join('') + '</w:tblGrid>' + filas.map(function (f) { return '<w:tr>' + f + '</w:tr>'; }).join('') + '</w:tbl>';
  }

  /* Una tabla leída del documento antiguo, con sus celdas combinadas. */
  function tablaTraida(t, enlaces) {
    var suma = t.anchos.reduce(function (a, b) { return a + b; }, 0), ANCHO = 9468, anchos = t.anchos.map(function (a) { return Math.round(a / suma * ANCHO); });
    var filas = t.filas.map(function (f) {
      return f.map(function (c) {
        var w = 0, i;
        for (i = c.col; i < c.col + c.span; i++) w += anchos[i];
        var pr = '<w:tcW w:w="' + w + '" w:type="dxa"/>' + (c.span > 1 ? '<w:gridSpan w:val="' + c.span + '"/>' : '') +
          (c.vm === 'r' ? '<w:vMerge w:val="restart"/>' : c.vm === 'c' ? '<w:vMerge/>' : '') + (c.fondo ? '<w:shd w:val="clear" w:color="auto" w:fill="' + c.fondo + '"/>' : '');
        var ps = c.parrafos.length ? c.parrafos.map(function (p) { return parrafoRuns(p.runs, { tam: 19, despues: 0 }, enlaces); }) : [parrafo('', { despues: 0 })];
        return '<w:tc><w:tcPr>' + pr + '</w:tcPr>' + ps.join('') + '</w:tc>';
      }).join('');
    });
    return tabla(anchos, filas);
  }

  /* El cuerpo del acta, en el mismo orden y con los mismos textos que escribe el documento de Google. */
  function cuerpo(m, enlaces) {
    var x = [], ANCHO = 9468;
    var l1 = parrafo(m.titulo, { negrita: true, alin: 'center', despues: 0 }), l2 = parrafo(m.celebrada, { alin: 'center', despues: 0 });
    x.push(tabla([ANCHO], [celda(ANCHO, [l1, l2], 'EEEEEE')]), parrafo(''));
    x.push(tabla([2160, ANCHO - 2160], m.filas.map(function (f) {
      return celda(2160, [parrafo(f[0], { negrita: true, despues: 0 })]) + celda(ANCHO - 2160, f[1].map(function (t) { return parrafo(t, { despues: 0 }); }));
    })), parrafo(''));
    x.push(parrafo((m.encabezados || {}).puntos || 'PUNTOS DEL DÍA', { negrita: true, alin: 'center' }));
    m.puntos.forEach(function (p) { x.push(parrafo(p, { sangria: { izq: 720, primera: 360 } })); });
    x.push(parrafo(''), parrafo((m.encabezados || {}).asuntos || 'ASUNTOS TRATADOS', { negrita: true, alin: 'center' }));
    m.asuntos.forEach(function (a) {
      if (a.titulo) x.push(parrafo(a.titulo, { negrita: true, antes: 120 }));
      (a.lineas || [{ texto: a.texto, vineta: false }]).forEach(function (l) {
        if (l.tabla) x.push(tablaTraida(l.tabla, enlaces), parrafo('', { despues: 60 }));
        else if (l.runs) x.push(parrafoRuns(l.runs, l.vineta ? { lista: true, alin: 'both' } : l.numerada ? { sangria: { izq: 720, primera: 360 }, alin: 'both' } : { alin: 'both' }, enlaces));
        else x.push(l.vineta ? parrafo(l.texto, { lista: true, alin: 'both', gris: a.pendiente }) : parrafo(l.texto, { alin: 'both', gris: a.pendiente }));
      });
    });
    x.push(parrafo(''));
    m.cierre.slice(0, -1).forEach(function (l) { x.push(parrafo(l, { alin: 'both' })); });
    x.push(parrafo(''), parrafo(m.cierre[m.cierre.length - 1], { negrita: true, alin: 'center' }));
    return x.join('');
  }

  var NUMERACION = '<w:abstractNum w:abstractNumId="' + NUM_VINETA + '"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/>' +
    '<w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:lvl></w:abstractNum>';
  var NUM = '<w:num w:numId="' + NUM_VINETA + '"><w:abstractNumId w:val="' + NUM_VINETA + '"/></w:num>';


  /* El membrete de la plantilla (cabecera y pie de la primera página, y el símbolo de las siguientes) con los datos del colegio: su nombre, su dirección y su
     logo, o sin nada de la Junta (membrete.sinJunta). Con los datos de la propia plantilla sale el mismo XML que trae. */
  function dibujo(rid, id, nombre, cx, cy) {
    return '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="' + esc(nombre) + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
      '<pic:nvPicPr><pic:cNvPr id="' + id + '" name="' + esc(nombre) + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>';
  }
  var SIN_BORDES = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000"/>';
  function celdaMembrete(ancho, contenido) { return '<w:tc><w:tcPr><w:tcW w:w="' + ancho + '" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>' + contenido + '</w:tc>'; }
  function tablaMembrete(total, anchos, celdas, altoMinimo) {
    return '<w:tbl><w:tblPr><w:tblW w:w="' + total + '" w:type="dxa"/>' + SIN_BORDES + '</w:tblPr><w:tblGrid>' + anchos.map(function (a) { return '<w:gridCol w:w="' + a + '"/>'; }).join('') + '</w:tblGrid>' +
      '<w:tr>' + (altoMinimo ? '<w:trPr><w:trHeight w:val="' + altoMinimo + '" w:hRule="atLeast"/></w:trPr>' : '') + celdas.join('') + '</w:tr></w:tbl>';
  }
  function parrafoMembrete(estilo, texto) {
    return '<w:p><w:pPr><w:pStyle w:val="' + estilo + '"/><w:spacing w:before="0" w:after="0"/></w:pPr>' + (texto == null ? '' : '<w:r>' + (estilo === 'Cabecera-Consejera' ? '<w:rPr><w:b/></w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(texto) + '</w:t></w:r>') + '</w:p>';
  }
  var PARRAFO_ENTRE = '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>', PARRAFO_FINO = '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>';
  function raizDe(xml) { return xml.slice(0, xml.indexOf('<w:tbl>')); }
  function relaciones(lista) { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + lista.join('') + '</Relationships>'; }
  function relacion(id, tipo, destino, externa) { return '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + tipo + '" Target="' + esc(destino).replace(/"/g, '&quot;') + '"' + (externa ? ' TargetMode="External"' : '') + '/>'; }

  function ponerMembrete(z, membrete, colegio, dec) {
    var junta = !membrete.sinJunta, logo = membrete.imagenes.ceip, h2 = dec.decode(z['word/header2.xml']), f2 = dec.decode(z['word/footer2.xml']);
    /* cabecera de la primera página */
    var alto = 1134; /* lo que mide el logo de la Junta: la fila no cambia de altura sin él */
    if (junta) {
      h2 = h2.replace(/(<w:pStyle w:val="Cabecera-Consejera"\/>[\s\S]*?<w:t xml:space="preserve">)[^<]*(<\/w:t>)/, function (m, a, b) { return a + esc(membrete.consejeria) + b; })
        .replace(/(<w:pStyle w:val="Cabecera-Centrodirectivo"\/>[\s\S]*?<w:t xml:space="preserve">)[^<]*(<\/w:t>)/, function (m, a, b) { return a + esc(colegio) + b; });
    } else {
      h2 = raizDe(h2) + tablaMembrete(9468, [9468], [celdaMembrete(9468, parrafoMembrete('Cabecera-Consejera', colegio) + parrafoMembrete('Cabecera-Centrodirectivo', null))], alto) + PARRAFO_FINO + '</w:hdr>';
      z['word/_rels/header2.xml.rels'] = relaciones([]);
      delete z['word/media/logo_junta.png'];
    }
    z['word/header2.xml'] = h2;
    /* símbolo de las páginas siguientes */
    if (!junta) {
      var h1 = dec.decode(z['word/header1.xml']);
      z['word/header1.xml'] = h1.slice(0, h1.indexOf('<w:p ')) + '<w:p/></w:hdr>';
      z['word/_rels/header1.xml.rels'] = relaciones([]);
      delete z['word/media/jda_simbolo.jpg'];
    }
    /* pie de la primera página: logo del colegio, dos parejas de líneas y el escudo */
    var pie = membrete.pie, parejas = [[pie[0], pie[1]], [pie[2], pie[3]]].map(function (par) { return par.filter(Boolean); }).filter(function (par) { return par.length; });
    var correo = pie[3] && /^[^\s@]+@[^\s@]+$/.test(pie[3]) ? pie[3] : '';
    var texto = parejas.map(function (par) {
      return '<w:p><w:pPr><w:pStyle w:val="Piedepgina-Datos"/><w:spacing w:before="40" w:after="40"/></w:pPr>' + par.map(function (t) {
        return t === correo ? '<w:hyperlink r:id="rId1"><w:r><w:rPr><w:rStyle w:val="Hipervnculo"/></w:rPr><w:t>' + esc(t) + '</w:t></w:r></w:hyperlink>' : '<w:r><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
      }).join('<w:r><w:br/></w:r>') + '</w:p>';
    }).join('') || '<w:p/>';
    var anchos = [], celdas = [], rels = [], m = logo ? g.Membrete.encajar(logo) : null, ancho = 10224;
    if (logo) {
      var wl = junta ? 6242 : 1562;
      anchos.push(wl); ancho -= wl;
      celdas.push(celdaMembrete(wl, PARRAFO_ENTRE + '<w:r>' + dibujo('rId9', 202, 'Logo del colegio', m.cx, m.cy) + '</w:r></w:p>'));
    }
    if (junta) ancho -= 738;
    anchos.push(ancho); celdas.push(celdaMembrete(ancho, texto));
    if (junta) { anchos.push(738); celdas.push(celdaMembrete(738, '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="right"/></w:pPr><w:r>' + dibujo('rId3', 203, 'Escudo Junta de Andalucia', 468630, 680085) + '</w:r></w:p>')); }
    z['word/footer2.xml'] = raizDe(f2) + tablaMembrete(10224, anchos, celdas, 0) + PARRAFO_FINO + '</w:ftr>';
    if (correo) rels.push(relacion('rId1', 'hyperlink', 'mailto:' + correo, true));
    if (junta) rels.push(relacion('rId3', 'image', 'media/jda_escudo.jpg'));
    else delete z['word/media/jda_escudo.jpg'];
    delete z['word/media/logo_ceip.png'];
    if (logo) { z['word/media/logo_ceip.' + logo.tipo] = logo.bytes; rels.push(relacion('rId9', 'image', 'media/logo_ceip.' + logo.tipo)); }
    z['word/_rels/footer2.xml.rels'] = relaciones(rels);
  }

  /* membrete: lo que devuelve Membrete.leer(). modelos: una o varias actas (el libro del curso: cada una en su sección, con el membrete completo en su primera
     página). opciones: { colegio, pie }. Devuelve los bytes del .docx. */
  async function crearLibro(modelos, membrete, opciones) {
    opciones = opciones || {};
    var z = Object.assign({}, membrete.zip), dec = new TextDecoder(), enlaces = [];
    var doc = dec.decode(z['word/document.xml']), sect = /<w:sectPr[\s\S]*<\/w:sectPr>/.exec(doc), ini = doc.indexOf('<w:body>');
    if (!sect || ini < 0) throw new Error('La plantilla del membrete no es la esperada.');
    var cuerpos = modelos.map(function (m, k) { return cuerpo(m, enlaces) + (k < modelos.length - 1 ? '<w:p><w:pPr>' + sect[0] + '</w:pPr></w:p>' : ''); });
    z['word/document.xml'] = doc.slice(0, ini) + '<w:body>' + cuerpos.join('') + sect[0] + '</w:body></w:document>';
    var num = dec.decode(z['word/numbering.xml']), primero = num.indexOf('<w:num ');
    z['word/numbering.xml'] = num.slice(0, primero) + NUMERACION + num.slice(primero).replace('</w:numbering>', NUM + '</w:numbering>');
    ponerMembrete(z, membrete, opciones.colegio || membrete.colegio, dec);
    if (opciones.pie && membrete.pieCiclo) z['word/footer1.xml'] = dec.decode(z['word/footer1.xml']).replace(esc(membrete.pieCiclo), esc(opciones.pie));
    var rels = dec.decode(z['word/_rels/document.xml.rels']).replace(/<Relationship Id="rId7"[^>]*\/>/, ''); /* el enlace de la plantilla original */
    var tipoEnlace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
    z['word/_rels/document.xml.rels'] = rels.replace('</Relationships>', enlaces.map(function (u, i) {
      return '<Relationship Id="rIdEnl' + (i + 1) + '" Type="' + tipoEnlace + '" Target="' + esc(u).replace(/"/g, '&quot;') + '" TargetMode="External"/>';
    }).join('') + '</Relationships>');
    return g.Zip.escribir(z);
  }

  function crear(modelo, membrete, opciones) { return crearLibro([modelo], membrete, opciones); }

  g.ActaDocx = { crear: crear, crearLibro: crearLibro };
})(typeof window !== 'undefined' ? window : globalThis);
