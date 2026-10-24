/* Petición a orientación (fila 76), la parte que calcula: el acta de la reunión del equipo docente, la fecha de revisión a los tres meses, los estados,
   la solicitud de evaluación psicopedagógica y cómo se guarda. Sin pantalla ni red: se prueba con node --test. Cada petición se guarda en ACTAS/peticiones/<id>.json:
   { formato, id, curso ('2026-2027'), alumno: { nombre, grupo, enLista, genero },
     reunion: { fecha, asistentes (uno por línea), observado, ambitos: [etiquetas], medidas (notas con marcas de alumnado), textoActa, notasRedactadas, documentos? },
     revision: 'aaaa-mm-dd', revisionAMano, solicitud?: { fecha, motivoAdelanto?, observado, medidas, comoHaIdo, texto, notasRedactadas, documentos? },
     estado: 'borrador'|'medidas'|'solicitada'|'cerrada', actualizado, creado }. */
(function (g) {
  'use strict';
  var DIR = 'peticiones';
  var AMBITOS = [
    'Desarrollo cognitivo', 'Desarrollo motor', 'Desarrollo sensorial', 'Comunicación y lenguaje', 'Social y afectivo', 'Atención y concentración',
    'Aprendizajes básicos (lectura, escritura y cálculo)'
  ];
  var MOTIVOS = ['Se ha agravado la situación', 'Hay informes externos'];
  var MESES_REVISION = 3;
  function dosCifras(n) { return (n < 10 ? '0' : '') + n; }

  function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + dosCifras(d.getMonth() + 1) + '-' + dosCifras(d.getDate()); }
  function lleno(t) { return !!String(t || '').trim(); }
  function marcaTiempo(ahora) { return (ahora || new Date()).toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6); }

  /* La misma fecha tres meses después; si ese día no existe, el último día de ese mes (30-nov -> 28-feb o 29-feb). */
  function sumarMeses(iso, n) {
    var p = g.partesFecha(iso), m0 = p.m - 1 + n, a = p.a + Math.floor(m0 / 12), m = ((m0 % 12) + 12) % 12 + 1;
    var ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return a + '-' + dosCifras(m) + '-' + dosCifras(Math.min(p.d, ultimo));
  }
  function fechaRevisionPorDefecto(fecha) { return sumarMeses(fecha, MESES_REVISION); }

  function nueva(alumno, fecha, ahora) {
    var t = (ahora || new Date()).toISOString();
    return {
      formato: 1, id: 'peticion-' + marcaTiempo(ahora), curso: g.cursoEscolar(fecha),
      alumno: { nombre: alumno.nombre, grupo: alumno.grupo || '', enLista: alumno.enLista !== false, genero: alumno.genero === 'a' ? 'a' : 'o' },
      reunion: { fecha: fecha, asistentes: '', observado: '', ambitos: [], medidas: '', textoActa: '', notasRedactadas: '', documentos: null },
      revision: fechaRevisionPorDefecto(fecha), revisionAMano: false, solicitud: null, estado: 'borrador', actualizado: t, creado: t
    };
  }

  /* Cambia la fecha de la reunión; la de revisión la sigue mientras nadie la haya cambiado a mano. */
  function ponerFechaReunion(p, fecha) {
    p.reunion.fecha = fecha;
    if (p.estado === 'borrador') p.curso = g.cursoEscolar(fecha);
    if (!p.revisionAMano) p.revision = fechaRevisionPorDefecto(fecha);
  }
  function ponerRevision(p, fecha) { p.revision = fecha; p.revisionAMano = true; }

  /* --- ámbitos --- */
  function marcarAmbito(p, etiqueta, si) {
    var l = p.reunion.ambitos.filter(function (x) { return x !== etiqueta; });
    if (si) l.push(etiqueta);
    p.reunion.ambitos = AMBITOS.filter(function (x) { return l.indexOf(x) >= 0; });
  }

  /* --- asistentes --- */
  function listaAsistentes(p) { return String(p.reunion.asistentes || '').split(/\r?\n|;/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function anadirAsistente(p, nombre) {
    var l = listaAsistentes(p), n = String(nombre || '').trim();
    if (!n || l.indexOf(n) >= 0) return false;
    l.push(n); p.reunion.asistentes = l.join('\n'); return true;
  }

  /* --- estados --- */
  function fechaCorta(iso) { try { return g.fechaCorta(iso); } catch (e) { return iso; } }
  /* ¿Ya puede hacerse la solicitud sin motivo de adelanto? (desde el mismo día de la revisión) */
  function llegoLaRevision(p, hoy) { return p.estado === 'medidas' && !!p.revision && hoy >= p.revision; }
  function estadoTexto(p, hoy) {
    if (p.estado === 'borrador') return 'Borrador';
    if (p.estado === 'cerrada') return 'Cerrada sin solicitud';
    if (p.estado === 'solicitada') return 'Solicitud hecha el ' + fechaCorta((p.solicitud && p.solicitud.fecha) || hoy);
    return llegoLaRevision(p, hoy) ? 'Ya puedes hacer la solicitud' : 'Medidas en marcha · revisión el ' + fechaCorta(p.revision);
  }
  function contarListas(lista, hoy) { return (lista || []).filter(function (p) { return llegoLaRevision(p, hoy); }).length; }

  function actaCreada(p, ahora) { if (p.estado === 'borrador') p.estado = 'medidas'; p.actualizado = (ahora || new Date()).toISOString(); }
  function cerrar(p) { if (p.estado === 'medidas') p.estado = 'cerrada'; }
  function reabrir(p) { if (p.estado === 'cerrada') p.estado = 'medidas'; }

  /* --- solicitud --- */
  /* Empieza la solicitud con lo observado y las medidas del acta ya copiados (el acta no cambia). `motivo`: { motivo, linea } si se adelanta. */
  function iniciarSolicitud(p, fecha, motivo) {
    if (p.solicitud) return p.solicitud;
    var m = motivo && (lleno(motivo.motivo) || lleno(motivo.linea)) ? [motivo.motivo, motivo.linea].filter(lleno).join('. ') : '';
    p.solicitud = { fecha: fecha, motivoAdelanto: m, observado: p.reunion.observado, medidas: p.reunion.medidas, comoHaIdo: '', texto: '', notasRedactadas: '', documentos: null };
    return p.solicitud;
  }
  function solicitudCreada(p, ahora) { p.estado = 'solicitada'; p.actualizado = (ahora || new Date()).toISOString(); }

  function firmaActa(p) { return [p.reunion.observado, p.reunion.ambitos.join('|'), p.reunion.medidas, p.revision].join('\u0001'); }
  function firmaSolicitud(p) { var s = p.solicitud || {}; return [s.observado, s.medidas, s.comoHaIdo, s.motivoAdelanto].join('\u0001'); }
  function problemaActa(p) {
    if (!lleno(p.reunion.observado) && !p.reunion.ambitos.length) return 'Cuenta qué se ha observado o marca algún ámbito.';
    if (!lleno(p.reunion.medidas)) return 'Escribe las medidas que se van a aplicar.';
    if (!p.reunion.fecha) return 'Pon la fecha de la reunión.';
    return '';
  }
  function problemaSolicitud(p) {
    var s = p.solicitud || {};
    if (!lleno(s.comoHaIdo)) return 'Cuenta cómo han ido las medidas.';
    if (!lleno(s.medidas)) return 'Escribe las medidas que se han aplicado.';
    return '';
  }

  /* --- guardado --- */
  async function guardar(raiz, p, ahora) {
    p.actualizado = (ahora || new Date()).toISOString();
    await raiz.escribirJSON(DIR + '/' + p.id + '.json', p);
    return p;
  }
  async function leer(raiz, id) { return raiz.leerJSON(DIR + '/' + id + '.json'); }
  async function borrar(raiz, id) { await raiz.borrar(DIR + '/' + id + '.json', false); }
  /* Todas las peticiones legibles, la cambiada más recientemente primero. Un fichero roto se salta. */
  async function listar(raiz) {
    var nombres = await raiz.listarJSON(DIR), lista = [];
    for (var i = 0; i < nombres.length; i++) {
      try {
        var p = await raiz.leerJSON(DIR + '/' + nombres[i]);
        if (p && p.id && p.alumno && p.alumno.nombre && p.reunion) lista.push(p);
      } catch (x) { /* fichero a medias: no se enseña */ }
    }
    return lista.sort(function (a, b) { return a.actualizado < b.actualizado ? 1 : -1; });
  }
  function delCurso(lista, curso) { return (lista || []).filter(function (p) { return !curso || p.curso === curso; }); }
  /* Las del curso y, de cursos anteriores, las que siguen con las medidas en marcha (una reunión de junio se revisa en septiembre). */
  function visibles(lista, curso) { return (lista || []).filter(function (p) { return !curso || p.curso === curso || p.estado === 'medidas'; }); }

  g.Peticion = {
    DIR: DIR, hoyIso: hoyIso, AMBITOS: AMBITOS, MOTIVOS: MOTIVOS, sumarMeses: sumarMeses, fechaRevisionPorDefecto: fechaRevisionPorDefecto, nueva: nueva, ponerFechaReunion: ponerFechaReunion,
    ponerRevision: ponerRevision, marcarAmbito: marcarAmbito, listaAsistentes: listaAsistentes, anadirAsistente: anadirAsistente, llegoLaRevision: llegoLaRevision,
    estadoTexto: estadoTexto, contarListas: contarListas, actaCreada: actaCreada, cerrar: cerrar, reabrir: reabrir, iniciarSolicitud: iniciarSolicitud,
    solicitudCreada: solicitudCreada, firmaActa: firmaActa, firmaSolicitud: firmaSolicitud, problemaActa: problemaActa, problemaSolicitud: problemaSolicitud,
    guardar: guardar, leer: leer, borrar: borrar, listar: listar, delCurso: delCurso, visibles: visibles
  };
})(typeof window !== 'undefined' ? window : globalThis);
