/* El membrete oficial: se lee de la plantilla de Word (pagina/membrete/plantilla-acta.docx), que es la única que lo define.
   De ella salen las imágenes de la Junta (para el PDF y el Word) y el diseño; el nombre, la dirección, el pie y el logo del colegio
   los pone cada docente en Ajustes (ACTAS/colegio.json) y entran con conColegio().
   Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';

  function textos(xml) {
    var l = [];
    String(xml || '').replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, function (m, t) { l.push(t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')); return m; });
    return l;
  }
  function dec(bytes) { return bytes ? new TextDecoder().decode(bytes) : ''; }
  /* La línea de la Consejería la pone la app, no el docente. Si la Consejería cambia de nombre, se cambia aquí y solo aquí. */
  var CONSEJERIA = 'Consejería de Educación';
  /* El hueco del logo del colegio en el pie de la primera página (en EMU, como mide el Word): el logo se encaja dentro sin deformarlo. */
  var CAJA_LOGO = { cx: 812952, cy: 680085 };

  /* PNG o JPG -> 'png' | 'jpg' | '' (por los primeros bytes, no por la extensión). */
  function tipoDeImagen(b) {
    if (b && b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
    if (b && b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
    return '';
  }
  /* { ancho, alto } en píxeles, o null si no se puede leer. */
  function medida(b, tipo) {
    try {
      if (tipo === 'png') return { ancho: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, alto: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 };
      var i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null;
        var m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { alto: (b[i + 5] << 8) | b[i + 6], ancho: (b[i + 7] << 8) | b[i + 8] };
        i += 2 + ((b[i + 2] << 8) | b[i + 3]);
      }
    } catch (e) { /* imagen rara */ }
    return null;
  }
  function imagen(bytes, nombre) {
    var tipo = /\.png$/i.test(nombre) ? 'png' : 'jpg', m = medida(bytes, tipo) || {};
    return { bytes: bytes, tipo: tipo, ancho: m.ancho || 0, alto: m.alto || 0 };
  }
  /* Los bytes de un logo subido -> { bytes, tipo, ancho, alto }, o null si no es PNG ni JPG. */
  function imagenDe(bytes) {
    var tipo = tipoDeImagen(bytes), m = tipo ? medida(bytes, tipo) : null;
    return tipo && m && m.ancho && m.alto ? { bytes: bytes, tipo: tipo, ancho: m.ancho, alto: m.alto } : null;
  }
  /* Cuánto mide (EMU) la imagen al encajarla en la caja, con su proporción. Si ya es de la proporción de la caja, la llena. */
  function encajar(img, caja) {
    caja = caja || CAJA_LOGO;
    if (!img || !img.ancho || !img.alto) return { cx: caja.cx, cy: caja.cy };
    var e = Math.min(caja.cx / img.ancho, caja.cy / img.alto), cx = Math.round(img.ancho * e), cy = Math.round(img.alto * e);
    if (cx >= caja.cx * 0.995 && cy >= caja.cy * 0.995) return { cx: caja.cx, cy: caja.cy };
    return { cx: cx, cy: cy };
  }

  /* buffer: la plantilla (.docx). Devuelve { zip, imagenes: { junta, ceip, escudo, simbolo }, consejeria, colegio, pie: [líneas], pieCiclo }. */
  async function leer(buffer) {
    var z = await g.Zip.leer(buffer);
    var cab = textos(dec(z['word/header2.xml'])), pie = textos(dec(z['word/footer2.xml']));
    if (cab.length < 2 || pie.length < 2 || !z['word/media/logo_junta.png']) throw new Error('La plantilla del membrete no es la esperada.');
    return {
      zip: z, consejeria: CONSEJERIA, colegio: cab[1], pie: pie, pieCiclo: textos(dec(z['word/footer1.xml']))[0] || '',
      imagenes: {
        junta: imagen(z['word/media/logo_junta.png'], 'a.png'), ceip: imagen(z['word/media/logo_ceip.png'], 'a.png'),
        escudo: imagen(z['word/media/jda_escudo.jpg'], 'a.jpg'), simbolo: imagen(z['word/media/jda_simbolo.jpg'], 'a.jpg')
      }
    };
  }

  /* «Segundo ciclo» -> «Acta del Equipo de Segundo Ciclo» (el pie de las páginas siguientes a la primera). */
  function textoPie(ciclo) {
    var c = String(ciclo || '').trim().replace(/\s+/g, ' ').split(' ').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
    return 'Acta del Equipo de ' + (c || 'Ciclo');
  }

  function texto(x) { return String(x == null ? '' : x).trim(); }
  /* El membrete de un docente: lo de la plantilla con los datos de su colegio (colegio.json) y su logo (imagenDe() o null).
     pie son siempre cuatro líneas (dirección, código postal y localidad, teléfono, correo); las vacías no se dibujan. */
  function conColegio(mem, c, logo) {
    var tel = texto(c.telefono);
    return Object.assign({}, mem, {
      colegio: texto(c.nombre), pie: [texto(c.direccion), texto(c.cpLocalidad), tel ? 'T: ' + tel : '', texto(c.correo)],
      correo: texto(c.correo), sinJunta: !!c.sinLogoJunta, imagenes: Object.assign({}, mem.imagenes, { ceip: logo || null })
    });
  }

  var guardado = null;
  /* La plantilla instalada con la página (en la copia sin internet viene como texto en PLANTILLA_ACTA_B64, porque desde el disco fetch no lee ficheros). */
  async function cargar() {
    if (guardado) return guardado;
    var buffer;
    if (!g.PLANTILLA_ACTA_B64 && g.location && g.location.protocol === 'file:') {
      await new Promise(function (ok) { var s = g.document.createElement('script'); s.src = 'plantilla-acta-datos.js'; s.onload = s.onerror = ok; g.document.head.appendChild(s); });
    }
    if (g.PLANTILLA_ACTA_B64) {
      var bin = atob(g.PLANTILLA_ACTA_B64), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      buffer = bytes;
    } else {
      var r = await g.fetch('membrete/plantilla-acta.docx');
      if (!r.ok) throw new Error('No he podido cargar el membrete del acta. Recarga la página.');
      buffer = await r.arrayBuffer();
    }
    guardado = await leer(buffer);
    return guardado;
  }

  g.Membrete = { leer: leer, cargar: cargar, textoPie: textoPie, textos: textos, conColegio: conColegio, imagenDe: imagenDe, tipoDeImagen: tipoDeImagen, medida: medida, encajar: encajar,
    CONSEJERIA: CONSEJERIA, CAJA_LOGO: CAJA_LOGO };
})(typeof window !== 'undefined' ? window : globalThis);
