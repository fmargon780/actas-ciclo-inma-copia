/* Lógica de los borradores del acta de ciclo. Sin pantalla ni carpeta: se prueba con node --test.
   Usa las funciones de fechas.js (la misma regla que el documento). */
(function (g) {
  'use strict';
  var PUNTO_ANTERIOR = 'Lectura y aprobación del acta anterior';
  var TIPOS = { ciclo: { nombre: 'Acta de ciclo' } };

  function esPuntoAnterior(titulo) { return String(titulo || '').trim().toLowerCase() === PUNTO_ANTERIOR.toLowerCase(); }

  /* ficha: lo que escribe el documento en ficha.json (o null). ahora: Date. */
  function nuevo(ficha, hoyIso, ahora, id) {
    var marca = ahora.toISOString();
    var puntos = [];
    if (ficha && ficha.ultimaActa) puntos.push({ titulo: PUNTO_ANTERIOR, notas: '' });
    return {
      id: id || nuevoId(ahora), tipo: 'ciclo', creado: marca, cambiado: marca,
      fecha: hoyIso, inicio: '13:00', fin: '13:50', evaluacion: g.evaluacion(hoyIso),
      asistentes: ficha && ficha.profesorado ? ficha.profesorado.slice() : [],
      puntos: puntos
    };
  }

  function nuevoId(ahora) {
    var t = ahora.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    return 'acta-' + t + '-' + Math.random().toString(36).slice(2, 6);
  }

  function ponerFecha(b, iso, evaluacionManual) {
    b.fecha = iso;
    if (!evaluacionManual) { try { b.evaluacion = g.evaluacion(iso); } catch (e) { /* fecha a medias: se deja */ } }
    return b;
  }

  /* ¿La evaluación guardada es distinta de la calculada? Entonces la cambió Inma a mano. */
  function evaluacionEsManual(b) {
    try { return b.evaluacion !== g.evaluacion(b.fecha); } catch (e) { return false; }
  }

  function anadirPunto(b) { b.puntos.push({ titulo: '', notas: '' }); return b; }
  function quitarPunto(b, i) { b.puntos.splice(i, 1); return b; }
  function moverPunto(b, i, delta) {
    var j = i + delta;
    if (j < 0 || j >= b.puntos.length) return b;
    var p = b.puntos[i]; b.puntos[i] = b.puntos[j]; b.puntos[j] = p;
    return b;
  }

  function marcarAsistente(b, linea, marcado) {
    var i = b.asistentes.indexOf(linea);
    if (marcado && i < 0) b.asistentes.push(linea);
    if (!marcado && i >= 0) b.asistentes.splice(i, 1);
    return b;
  }

  /* Los asistentes se guardan en el orden de la ficha. */
  function ordenarAsistentes(b, ficha) {
    if (!ficha || !ficha.profesorado) return b;
    var orden = ficha.profesorado;
    b.asistentes.sort(function (x, y) {
      var a = orden.indexOf(x), c = orden.indexOf(y);
      return (a < 0 ? 1e6 : a) - (c < 0 ? 1e6 : c);
    });
    return b;
  }

  /* Primer punto que Inma ha escrito (el de la lectura del acta anterior no cuenta). */
  function primerPunto(b) {
    for (var i = 0; i < b.puntos.length; i++) {
      var t = String(b.puntos[i].titulo || '').trim();
      if (t && !esPuntoAnterior(t)) return t;
    }
    return '';
  }

  function hace(desde, ahora) {
    var s = Math.max(0, Math.round((ahora - new Date(desde)) / 1000));
    if (s < 60) return 'hace un momento';
    var m = Math.round(s / 60);
    if (m < 60) return 'hace ' + m + (m === 1 ? ' minuto' : ' minutos');
    var h = Math.round(m / 60);
    if (h < 24) return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
    var d = Math.round(h / 24);
    return 'hace ' + d + (d === 1 ? ' día' : ' días');
  }

  /* Lo que se escribe en borradores/<id>.json: solo los campos del formato. */
  function paraGuardar(b, ahora) {
    return {
      id: b.id, tipo: b.tipo, creado: b.creado, cambiado: ahora.toISOString(),
      fecha: b.fecha, inicio: b.inicio, fin: b.fin, evaluacion: b.evaluacion,
      asistentes: b.asistentes.slice(),
      puntos: b.puntos.map(function (p) {
        var o = { titulo: String(p.titulo || ''), notas: String(p.notas || '') };
        if (p.parrafo) { o.parrafo = String(p.parrafo); o.notasRedactadas = String(p.notasRedactadas == null ? p.notas || '' : p.notasRedactadas); o.manual = !!p.manual; }
        return o;
      })
    };
  }

  g.Borradores = {
    PUNTO_ANTERIOR: PUNTO_ANTERIOR, TIPOS: TIPOS, esPuntoAnterior: esPuntoAnterior, nuevo: nuevo, ponerFecha: ponerFecha,
    evaluacionEsManual: evaluacionEsManual, anadirPunto: anadirPunto, quitarPunto: quitarPunto, moverPunto: moverPunto,
    marcarAsistente: marcarAsistente, ordenarAsistentes: ordenarAsistentes, primerPunto: primerPunto, hace: hace,
    paraGuardar: paraGuardar
  };
})(typeof window !== 'undefined' ? window : globalThis);
