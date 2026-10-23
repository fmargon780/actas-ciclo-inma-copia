/* Zip mínimo, sin librerías: lee todo un .zip (el Word de plantilla) y escribe uno nuevo (el Word del acta).
   Sin pantalla: se prueba con node --test (CompressionStream y DecompressionStream existen en Chrome y en Node). */
(function (g) {
  'use strict';

  var TABLA = null;
  function crc32(bytes) {
    if (!TABLA) {
      TABLA = new Uint32Array(256);
      for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLA[n] = c >>> 0; }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = TABLA[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  async function pasar(bytes, flujo) {
    var salida = new Blob([bytes]).stream().pipeThrough(flujo);
    return new Uint8Array(await new Response(salida).arrayBuffer());
  }
  function inflar(bytes) { return pasar(bytes, new g.DecompressionStream('deflate-raw')); }
  function desinflar(bytes) { return pasar(bytes, new g.CompressionStream('deflate-raw')); }

  /* buffer (ArrayBuffer o Uint8Array) -> { 'ruta': Uint8Array sin comprimir }, solo ficheros (no carpetas). */
  async function leer(buffer) {
    var b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    var v = new DataView(b.buffer, b.byteOffset, b.byteLength), i, res = {};
    for (i = b.length - 22; i >= 0 && v.getUint32(i, true) !== 0x06054b50; i--) { /* busca el final del zip */ }
    if (i < 0) throw new Error('Este fichero no es un .zip ni un documento de Word.');
    var n = v.getUint16(i + 10, true), p = v.getUint32(i + 16, true);
    for (var k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      var metodo = v.getUint16(p + 10, true), comp = v.getUint32(p + 20, true), largoN = v.getUint16(p + 28, true);
      var extra = v.getUint16(p + 30, true), coment = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
      var nombre = new TextDecoder().decode(b.subarray(p + 46, p + 46 + largoN));
      if (nombre.charAt(nombre.length - 1) !== '/') {
        var datos = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true), crudo = b.subarray(datos, datos + comp);
        res[nombre] = metodo === 0 ? crudo.slice() : await inflar(crudo);
      }
      p += 46 + largoN + extra + coment;
    }
    return res;
  }

  function texto(s) { return new TextEncoder().encode(s); }

  /* { 'ruta': Uint8Array | texto } -> Uint8Array del .zip. Las imágenes ya vienen comprimidas: se guardan tal cual. */
  async function escribir(ficheros) {
    var partes = [], central = [], pos = 0, ahora = new Date();
    var hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
    var dia = ((Math.max(ahora.getFullYear(), 1980) - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
    var nombres = Object.keys(ficheros);
    for (var i = 0; i < nombres.length; i++) {
      var nombre = nombres[i], datos = typeof ficheros[nombre] === 'string' ? texto(ficheros[nombre]) : ficheros[nombre];
      var yaComprimido = /\.(png|jpe?g)$/i.test(nombre), crc = crc32(datos);
      var cuerpo = yaComprimido ? datos : await desinflar(datos), metodo = yaComprimido ? 0 : 8, n = texto(nombre);
      var cab = new DataView(new ArrayBuffer(30));
      cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true); cab.setUint16(8, metodo, true);
      cab.setUint16(10, hora, true); cab.setUint16(12, dia, true); cab.setUint32(14, crc, true);
      cab.setUint32(18, cuerpo.length, true); cab.setUint32(22, datos.length, true); cab.setUint16(26, n.length, true);
      var cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, metodo, true);
      cen.setUint16(12, hora, true); cen.setUint16(14, dia, true); cen.setUint32(16, crc, true);
      cen.setUint32(20, cuerpo.length, true); cen.setUint32(24, datos.length, true); cen.setUint16(28, n.length, true); cen.setUint32(42, pos, true);
      partes.push(new Uint8Array(cab.buffer), n, cuerpo);
      central.push(new Uint8Array(cen.buffer), n);
      pos += 30 + n.length + cuerpo.length;
    }
    var tamCentral = central.reduce(function (s, x) { return s + x.length; }, 0);
    var fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, nombres.length, true); fin.setUint16(10, nombres.length, true);
    fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
    var todo = partes.concat(central, [new Uint8Array(fin.buffer)]), total = todo.reduce(function (s, x) { return s + x.length; }, 0);
    var salida = new Uint8Array(total), o = 0;
    todo.forEach(function (x) { salida.set(x, o); o += x.length; });
    return salida;
  }

  g.Zip = { leer: leer, escribir: escribir, crc32: crc32 };
})(typeof window !== 'undefined' ? window : globalThis);
