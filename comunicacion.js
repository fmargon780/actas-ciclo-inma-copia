/* Comunicaciones a familias (fila 109), la parte que calcula: circulares y autorizaciones de salida, lo que falta para crearlas, las autorizaciones entregadas y cómo se guardan.
   Sin pantalla ni red: se prueba con node --test.
   Cada comunicación se guarda en ACTAS/comunicaciones/<id>.json:
   { formato, id, tipo: 'circular' | 'autorizacion', estado: 'borrador' | 'creada', titulo (en la autorización es la actividad), fecha (la del papel), grupo, tutora, localidad, notas, texto,
     salida?: { actividad, destino, dia, sale, vuelve, transporte, coste, traer, limite } (solo la autorización), entregas?: [{ nombre: 'Apellidos, Nombre', entregada }] (solo la autorización),
     versiones?, documentos?: { curso, base, pdf, docx }, creada, creado, cambiado }. */
(function (g) {
  'use strict';
  var A = g.Alumnado, DIR = 'comunicaciones';
  var TIPOS = { circular: { nombre: 'Circular', etiqueta: 'Circular' }, autorizacion: { nombre: 'Autorización de salida', etiqueta: 'Autorización' } };
  var CAMPOS_SALIDA = ['actividad', 'destino', 'dia', 'sale', 'vuelve', 'transporte', 'coste', 'traer', 'limite'];

  function marcaTiempo(ahora) { return (ahora || new Date()).toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6); }
  function lleno(t) { return !!String(t == null ? '' : t).trim(); }
  function esAutorizacion(c) { return c.tipo === 'autorizacion'; }

  function claveOrden(a) { return A.normalizar(a.apellidos + ' ' + a.pila); }
  /* El alumnado del grupo (formato de Rúbricas) -> [{ nombre: 'Apellidos, Nombre', entregada }], por apellidos. Conserva lo ya marcado (por nombre). */
  function entregasDe(alumnos, antes) {
    var marcas = {};
    (antes || []).forEach(function (x) { marcas[A.normalizar(x.nombre)] = !!x.entregada; });
    return (alumnos || []).slice().sort(function (a, b) { var x = claveOrden(a), y = claveOrden(b); return x < y ? -1 : x > y ? 1 : 0; }).map(function (a) {
      var nombre = a.apellidos ? a.apellidos + ', ' + a.pila : a.nombre;
      return { nombre: nombre, entregada: marcas[A.normalizar(nombre)] === true };
    });
  }

  function nueva(tipo, tut, ficha, alumnos, hoyIso, ahora) {
    var t = (ahora || new Date()).toISOString();
    var c = {
      formato: 1, id: 'comunicacion-' + marcaTiempo(ahora), tipo: tipo === 'autorizacion' ? 'autorizacion' : 'circular', estado: 'borrador', titulo: '', fecha: hoyIso,
      grupo: tut.grupo, tutora: tut.tutora || '', localidad: String((ficha && ficha.localidad) || '').trim(), notas: '', texto: '', creada: null, creado: t, cambiado: t
    };
    if (esAutorizacion(c)) {
      c.salida = {}; CAMPOS_SALIDA.forEach(function (k) { c.salida[k] = ''; });
      c.entregas = entregasDe(alumnos);
    }
    return c;
  }

  /* Al abrir: la lista del grupo se pone al día (lo marcado se conserva). Si no está creada, el grupo, la tutora y la localidad vuelven a ser los de ahora. */
  function alinear(c, tut, ficha, alumnos) {
    if (c.estado !== 'creada') {
      c.grupo = tut.grupo; c.tutora = tut.tutora || '';
      if (ficha && lleno(ficha.localidad)) c.localidad = String(ficha.localidad).trim();
    }
    if (esAutorizacion(c) && alumnos && alumnos.length) c.entregas = entregasDe(alumnos, c.entregas);
    return c;
  }

  function tituloDe(c) { return String((esAutorizacion(c) ? (c.salida && c.salida.actividad) : c.titulo) || '').trim(); }
  /* En la autorización, el título es la actividad. */
  function ponerActividad(c, texto) { c.salida.actividad = texto; c.titulo = texto; }

  /* --- entregas --- */
  function contarEntregas(c) {
    var l = c.entregas || [], si = l.filter(function (x) { return x.entregada; }).length;
    return { si: si, total: l.length, faltan: l.length - si, todas: l.length > 0 && si === l.length };
  }
  /* «Pasada la fecha límite», las que faltan salen en ámbar. */
  function pasadaLimite(c, hoyIso) { return !!(c.salida && c.salida.limite && c.salida.limite < hoyIso); }

  /* --- lo que falta para crear --- */
  function faltas(c) {
    var f = [];
    if (!tituloDe(c)) f.push(esAutorizacion(c) ? 'actividad' : 'título');
    if (esAutorizacion(c)) {
      if (!lleno(c.salida.dia)) f.push('fecha de la salida');
      if (!lleno(c.salida.limite)) f.push('fecha límite de entrega');
    }
    if (!lleno(c.texto)) f.push('texto redactado');
    return f;
  }
  /* La frase que impide crear, o ''. */
  function problema(c) {
    var f = faltas(c);
    if (f.length) return 'Falta: ' + f.join(', ') + '.';
    var fechas = [c.fecha].concat(esAutorizacion(c) ? [c.salida.dia, c.salida.limite] : []);
    for (var i = 0; i < fechas.length; i++) { try { g.fechaLarga(fechas[i]); } catch (e) { return 'Alguna fecha no es válida.'; } }
    return '';
  }

  /* --- guardado --- */
  async function guardar(raiz, c, ahora) {
    c.cambiado = (ahora || new Date()).toISOString();
    await raiz.escribirJSON(DIR + '/' + c.id + '.json', c);
    return c;
  }
  async function leer(raiz, id) { return raiz.leerJSON(DIR + '/' + id + '.json'); }
  async function borrar(raiz, id) { await raiz.borrar(DIR + '/' + id + '.json', false); }
  /* Todas las comunicaciones legibles, la de fecha más reciente primero. Un fichero roto se salta. */
  async function listar(raiz) {
    var nombres = await raiz.listarJSON(DIR), lista = [];
    for (var i = 0; i < nombres.length; i++) {
      try {
        var c = await raiz.leerJSON(DIR + '/' + nombres[i]);
        if (c && c.id && c.fecha && (c.tipo === 'circular' || c.tipo === 'autorizacion')) lista.push(c);
      } catch (x) { /* fichero a medias: no se enseña */ }
    }
    return lista.sort(function (a, b) { return a.fecha === b.fecha ? (a.cambiado < b.cambiado ? 1 : -1) : (a.fecha < b.fecha ? 1 : -1); });
  }
  /* Las del curso (por la fecha del papel, de septiembre a junio). */
  function delCurso(lista, curso) { return g.Tutoria.delCurso(lista, curso); }
  function marcarCreada(c, ahora) { c.estado = 'creada'; c.creada = (ahora || new Date()).toISOString(); return c; }

  g.Comunicacion = {
    DIR: DIR, TIPOS: TIPOS, CAMPOS_SALIDA: CAMPOS_SALIDA, esAutorizacion: esAutorizacion, entregasDe: entregasDe, nueva: nueva, alinear: alinear, tituloDe: tituloDe, ponerActividad: ponerActividad,
    contarEntregas: contarEntregas, pasadaLimite: pasadaLimite, faltas: faltas, problema: problema, guardar: guardar, leer: leer, borrar: borrar, listar: listar, delCurso: delCurso, marcarCreada: marcarCreada
  };
})(typeof window !== 'undefined' ? window : globalThis);
