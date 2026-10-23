/* El membrete oficial: se lee de la plantilla de Word (pagina/membrete/plantilla-acta.docx), que es la única que lo define.
   De ella salen las cuatro imágenes (para el PDF y el Word), el nombre del colegio y la dirección del pie.
   Sin pantalla: se prueba con node --test. */
(function (g) {
  'use strict';

  function textos(xml) {
    var l = [];
    String(xml || '').replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, function (m, t) { l.push(t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')); return m; });
    return l;
  }
  function dec(bytes) { return bytes ? new TextDecoder().decode(bytes) : ''; }
  function imagen(bytes, nombre) { return { bytes: bytes, tipo: /\.png$/i.test(nombre) ? 'png' : 'jpg' }; }

  /* buffer: la plantilla (.docx). Devuelve { zip, imagenes: { junta, ceip, escudo, simbolo }, consejeria, colegio, pie: [líneas], pieCiclo }. */
  async function leer(buffer) {
    var z = await g.Zip.leer(buffer);
    var cab = textos(dec(z['word/header2.xml'])), pie = textos(dec(z['word/footer2.xml']));
    if (cab.length < 2 || pie.length < 2 || !z['word/media/logo_junta.png']) throw new Error('La plantilla del membrete no es la esperada.');
    return {
      zip: z, consejeria: cab[0], colegio: cab[1], pie: pie, pieCiclo: textos(dec(z['word/footer1.xml']))[0] || '',
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

  g.Membrete = { leer: leer, cargar: cargar, textoPie: textoPie, textos: textos };
})(typeof window !== 'undefined' ? window : globalThis);
