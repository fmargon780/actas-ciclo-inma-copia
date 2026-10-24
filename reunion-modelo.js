/* La reunión general con familias como datos para el PDF y el Word (fila 57): mismo modelo que usa acta-pdf.js / acta-docx.js para el acta de ciclo,
   con sus propios encabezados y el anexo de asistencia como tabla. Mismas frases que las del documento de Google (src/reunion.js).
   Sin pantalla ni carpeta: se prueba con node --test. */
(function (g) {
  'use strict';
  var TEXTO_ASISTENTES = 'Reunión Inicial de padres/madres.', PIE = 'Acta de la reunión general con familias', BASE = 'Reunión general con familias';

  function dosCifras(n) { return (n < 10 ? '0' : '') + n; }
  function fechaCortaDosCifras(iso) { var p = g.partesFecha(iso); return dosCifras(p.d) + '/' + dosCifras(p.m) + '/' + String(p.a).slice(-2); }
  function fechaEnMayusculas(iso) { var p = g.partesFecha(iso); return p.d + ' DE ' + g.MESES[p.m - 1].toUpperCase() + ' DE ' + p.a; }
  /* «C.E.I.P. Jorge Guillén» se dice «CEIP Jorge Guillén» en esta frase, como siempre. */
  function nombreEnFrase(colegio) { return String(colegio || '').trim().replace(/^C\.E\.I\.P\.\s*/i, 'CEIP ').trim() || 'centro'; }
  function textoReunionInicial(localidad, colegio) {
    var l = String(localidad).trim();
    return 'En la localidad de ' + l + ', se reúnen en el ' + nombreEnFrase(colegio) + ' de la localidad de ' + l +
      ' los padres/madres/representantes legales del alumnado del curso arriba indicados con el/la tutor/a del citado curso, al objeto de tratar los siguientes puntos:';
  }

  function runs(t, negrita) { return [{ t: t, b: !!negrita }]; }
  function celda(col, span, t, negrita, fondo) { return { col: col, span: span, rs: 1, vm: null, fondo: fondo || '', parrafos: [{ runs: runs(t, negrita) }] }; }

  /* r: la reunión guardada (ACTAS/reuniones/<id>.json). Devuelve el modelo para ActaPdf / ActaDocx. */
  function montar(r, colegio) {
    var env = g.Reunion.armarEnvio(r), fecha = env.fecha, grupo = env.grupo;
    var filas = [[celda(0, 1, 'ALUMNOS ' + grupo, true, 'EEEEEE'), celda(1, 1, 'reunión inicial ' + fechaCortaDosCifras(fecha), true, 'EEEEEE')]];
    env.asistencia.forEach(function (a) { filas.push([celda(0, 1, a.nombre, false), celda(1, 1, a.asiste ? 'sí' : 'no', false)]); });
    return {
      titulo: 'Reunión de TUTORÍA', celebrada: 'celebrada el día ' + g.fechaLarga(fecha),
      encabezados: { puntos: 'TEMAS TRATADOS', asuntos: 'ACUERDOS DE LA REUNIÓN' },
      filas: [['CURSO:', [grupo]], ['TUTOR / A', [env.tutora]], ['PROFESORES / AS ASISTENTES', [TEXTO_ASISTENTES, textoReunionInicial(env.localidad, colegio)]]],
      puntos: env.puntos.map(function (p, i) { return (i + 1) + '. ' + p.titulo; }),
      asuntos: env.puntos.map(function (p, i) { return { titulo: (i + 1) + '. ' + p.tituloAcuerdo, lineas: g.lineasDeParrafo(p.parrafo) }; })
        .concat([{ titulo: 'ANEXO. Asistencia de padres', lineas: [{ tabla: { anchos: [3, 1], filas: filas } }] }]),
      cierre: ['En ' + env.localidad + ' a ' + fechaEnMayusculas(fecha)]
    };
  }

  g.ReunionModelo = { montar: montar, PIE: PIE, BASE: BASE, fechaCortaDosCifras: fechaCortaDosCifras, fechaEnMayusculas: fechaEnMayusculas, textoReunionInicial: textoReunionInicial };
})(typeof window !== 'undefined' ? window : globalThis);
