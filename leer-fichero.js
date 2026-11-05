/* Lee el texto de un fichero que sube la docente (fila 106): Word (.docx), PDF, texto (.txt) y fotos (JPG, PNG). Todo se lee en el dispositivo: no sale nada.
   - Word y texto se leen directamente (docx.js).
   - PDF con texto: pdf.js. PDF escaneado y foto: se leen como imagen con Tesseract.js (idioma español); entonces `imagen` es true y el texto puede tener errores.
   - Las librerías están en lib/ (nada se pide a servidores de fuera) y se cargan solo al necesitarlas. En la copia sin internet (file:) no están: ahí un PDF o una
     imagen dan el mensaje de que no se ha podido leer.
   `leer(fichero, opciones)` -> { texto, imagen, aviso }. Si no se puede, lanza un error con `tipo: 'ilegible'` y la frase para la docente.
   opciones.motores: { pdf(), ocr() } para las pruebas; opciones.progreso(texto): lo que se va haciendo. */
(function (g) {
  'use strict';
  var MAX_PAGINAS = 15; /* páginas de un PDF escaneado que se leen como imagen */
  var MIN_LETRAS_PAGINA = 25; /* menos letras que esto en una página: se tiene por imagen */
  var LADO_MAX = 3200; /* una foto más grande se reduce a este lado largo */
  var LADO_MIN = 1600; /* una foto más pequeña se agranda hasta este lado largo */
  var CARPETA = 'lib/';

  function ilegible(nombre) {
    var e = new Error('No he podido leer «' + nombre + '». Escribe aquí lo que dice o sube una copia más clara.');
    e.tipo = 'ilegible';
    return e;
  }

  /* El tipo por el contenido (y, si hace falta, por el nombre): 'docx' | 'pdf' | 'txt' | 'imagen' | ''. */
  function tipoDe(nombre, bytes) {
    var b = bytes, ext = (/\.([a-z0-9]+)$/i.exec(String(nombre)) || [, ''])[1].toLowerCase();
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'imagen';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'imagen';
    if (b[0] === 0x50 && b[1] === 0x4B) return ext === 'docx' ? 'docx' : '';
    if (b[0] === 0xD0 && b[1] === 0xCF) return ''; /* Word antiguo (.doc) */
    if (ext === 'txt' || ext === 'text') {
      for (var i = 0; i < Math.min(b.length, 4096); i++) if (b[i] === 0) return '';
      return 'txt';
    }
    return '';
  }

  function decodificarTexto(bytes) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, ''); }
    catch (e) { return new TextDecoder('windows-1252').decode(bytes); }
  }

  function letras(t) { return (String(t).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/g) || []).length; }

  /* Las líneas de una página de PDF a partir de sus trozos de texto (pdf.js): salto cuando lo marca el PDF o cambia la altura; una línea por línea. */
  function textoDePagina(items) {
    var t = '', y = null, salto = false;
    (items || []).forEach(function (it) {
      if (typeof it.str !== 'string') return;
      if (it.str === '') { if (it.hasEOL) salto = true; return; }
      var yi = it.transform ? it.transform[5] : null;
      if (t && (salto || (y !== null && yi !== null && Math.abs(yi - y) > 2))) t += '\n';
      t += it.str; salto = !!it.hasEOL;
      if (yi !== null) y = yi;
    });
    return t.replace(/[ \t]+\n/g, '\n').trim();
  }

  /* --- Las librerías, cargadas solo al necesitarlas --- */
  var cargados = {};
  function cargarScript(ruta) {
    if (cargados[ruta]) return cargados[ruta];
    cargados[ruta] = new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = ruta; s.onload = function () { ok(); };
      s.onerror = function () { delete cargados[ruta]; mal(new Error('No se ha podido cargar ' + ruta)); };
      document.head.appendChild(s);
    });
    return cargados[ruta];
  }
  function absoluta(ruta) { return new URL(ruta, g.document.baseURI).href; }

  async function motorPdf() {
    if (g.location && g.location.protocol === 'file:') throw new Error('Sin internet no hay lector de PDF.');
    await cargarScript(CARPETA + 'pdfjs/pdf.min.js');
    g.pdfjsLib.GlobalWorkerOptions.workerSrc = absoluta(CARPETA + 'pdfjs/pdf.worker.min.js');
    return g.pdfjsLib;
  }

  /* El lector de imágenes: { reconocer(lienzo) -> texto, cerrar() }. Un solo trabajador de Tesseract para todas las páginas. */
  async function motorOcr(progreso) {
    if (g.location && g.location.protocol === 'file:') throw new Error('Sin internet no hay lector de imágenes.');
    await cargarScript(CARPETA + 'tesseract/tesseract.min.js');
    var cola = { pagina: '' };
    var trabajador = await g.Tesseract.createWorker('spa', 1, {
      workerPath: absoluta(CARPETA + 'tesseract/worker.min.js'), corePath: absoluta(CARPETA + 'tesseract/tesseract-core-lstm.wasm.js'),
      langPath: absoluta(CARPETA + 'tesseract'), workerBlobURL: false, cacheMethod: 'none',
      logger: function (m) {
        if (progreso && m && m.status === 'recognizing text') progreso('Leyendo la imagen' + cola.pagina + ': ' + Math.round(m.progress * 100) + ' %');
      }
    });
    return {
      reconocer: async function (lienzo, pagina) { cola.pagina = pagina || ''; return (await trabajador.recognize(lienzo)).data.text; },
      cerrar: function () { return trabajador.terminate(); }
    };
  }

  /* Un lienzo con la imagen, a un tamaño que Tesseract lea bien. */
  function lienzoDe(fuente, ancho, alto) {
    var escala = Math.max(ancho, alto) > LADO_MAX ? LADO_MAX / Math.max(ancho, alto) : Math.max(ancho, alto) < LADO_MIN ? LADO_MIN / Math.max(ancho, alto) : 1;
    var c = g.document.createElement('canvas'); c.width = Math.round(ancho * escala); c.height = Math.round(alto * escala);
    var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(fuente, 0, 0, c.width, c.height);
    return c;
  }

  function limpiarOcr(t) { return String(t || '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }

  /* fichero: un File (nombre en .name, contenido con .arrayBuffer()). */
  async function leer(fichero, opciones) {
    opciones = opciones || {};
    var nombre = fichero.name || 'el fichero', motores = opciones.motores || {}, progreso = opciones.progreso || function () {};
    var buffer, bytes, tipo;
    try { buffer = await fichero.arrayBuffer(); bytes = new Uint8Array(buffer); tipo = tipoDe(nombre, bytes); } catch (e) { throw ilegible(nombre); }
    if (!tipo || !bytes.length) throw ilegible(nombre);
    progreso('Leyendo «' + nombre + '»…');
    var texto = '', imagen = false, aviso = '', ocr = null;
    try {
      if (tipo === 'txt') texto = decodificarTexto(bytes);
      else if (tipo === 'docx') texto = await g.Docx.leerTexto(buffer);
      else if (tipo === 'pdf') {
        var pdfjs = await (motores.pdf || motorPdf)(), doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true }).promise, partes = [], leidas = 0;
        for (var n = 1; n <= doc.numPages; n++) {
          var pagina = await doc.getPage(n), parte = textoDePagina((await pagina.getTextContent()).items);
          if (letras(parte) < MIN_LETRAS_PAGINA) {
            if (leidas >= MAX_PAGINAS) { aviso = 'Solo he leído como imagen las primeras ' + MAX_PAGINAS + ' páginas de «' + nombre + '».'; parte = ''; }
            else {
              ocr = ocr || await (motores.ocr || motorOcr)(progreso);
              var vista = pagina.getViewport({ scale: 1 }), escala = LADO_MIN * 1.25 / Math.max(vista.width, vista.height), v = pagina.getViewport({ scale: escala });
              var lienzo = g.document.createElement('canvas'); lienzo.width = Math.ceil(v.width); lienzo.height = Math.ceil(v.height);
              await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: v, background: '#ffffff' }).promise;
              parte = limpiarOcr(await ocr.reconocer(lienzo, doc.numPages > 1 ? ' (página ' + n + ')' : ''));
              leidas++; imagen = true;
            }
          }
          if (parte) partes.push(parte);
        }
        texto = partes.join('\n\n');
      } else { /* imagen */
        var mapa = await g.createImageBitmap(fichero);
        ocr = await (motores.ocr || motorOcr)(progreso);
        texto = limpiarOcr(await ocr.reconocer(lienzoDe(mapa, mapa.width, mapa.height), ''));
        imagen = true;
      }
    } catch (e) { throw e && e.tipo === 'ilegible' ? e : ilegible(nombre); }
    finally { if (ocr && ocr.cerrar) { try { await ocr.cerrar(); } catch (e) { /* ya cerrado */ } } }
    if (!String(texto).trim()) throw ilegible(nombre);
    return { texto: String(texto).replace(/\r\n?/g, '\n').trim(), imagen: imagen, aviso: aviso };
  }

  g.LeerFichero = { leer: leer, tipoDe: tipoDe, textoDePagina: textoDePagina, AVISO_IMAGEN: 'Este fichero es una imagen. He leído el texto en tu ordenador y puede tener errores: revísalo aquí antes de seguir.' };
})(typeof window !== 'undefined' ? window : globalThis);
