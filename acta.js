// Contenido de un acta, montado como datos. Sin nada de Google: se prueba con node --test.

var PUNTO_ACTA_ANTERIOR = 'Lectura y aprobación del acta anterior';
var TEXTO_PENDIENTE = 'Escribe aquí lo tratado.';

function tituloActa(ciclo, evaluacionTxt) {
  return 'ACTA DEL EQUIPO DE ' + String(ciclo).trim().toUpperCase() + '. ' +
    String(evaluacionTxt).trim().toUpperCase() + ' EVALUACIÓN';
}

function lineaCelebrada(fechaIso, horaInicio) {
  return 'Celebrada el día ' + fechaCorta(fechaIso) + ' a las ' + horaNormal(horaInicio) + ' horas';
}

function textoCierre(fechaIso, horaFin) {
  return 'Sin más asuntos que tratar, se levanta la sesión el ' + fechaEnLetra(fechaIso) +
    ', siendo las ' + horaNormal(horaFin) + ' horas.';
}

function lineaLugarFecha(localidad, fechaIso) {
  return 'En ' + String(localidad).trim() + ', a ' + fechaLarga(fechaIso) + '.';
}

function textoActaAnterior(fechaAnteriorIso) {
  return 'Reunidos los miembros del segundo ciclo, se lleva a cabo la lectura del acta anterior, ' +
    'de fecha ' + fechaCorta(fechaAnteriorIso) + ', y se aprueba.';
}

function esPuntoActaAnterior(punto) {
  return String(punto).trim().toLowerCase() === PUNTO_ACTA_ANTERIOR.toLowerCase();
}

// Todas las fechas «Celebrada el día dd/mm/aaaa» del texto del documento, en orden.
function fechasDeActas(textoDocumento) {
  var re = /Celebrada el día (\d{2}\/\d{2}\/\d{4})/g;
  var res = [], m;
  while ((m = re.exec(String(textoDocumento || ''))) !== null) {
    try { res.push(fechaDesdeCorta(m[1])); } catch (e) { /* fecha rara: se ignora */ }
  }
  return res;
}

// Fecha de la última acta del documento que sea de ese curso (año en que empieza); null si no hay.
function ultimaActaDelCurso(textoDocumento, anioInicio) {
  var fechas = fechasDeActas(textoDocumento).filter(function (f) {
    return anioInicioCurso(f) === anioInicio;
  });
  return fechas.length ? fechas[fechas.length - 1] : null;
}

function limpiarPuntos(texto) {
  return String(texto || '').split(/\r?\n/).map(function (l) {
    return l.replace(/^\s*\d+\s*[.)-]\s+/, '').trim();
  }).filter(function (l) { return l; });
}

// «• uno\n• dos» -> [{texto, vineta}]. Cada línea que empieza por «• » es una viñeta; el resto, texto normal.
function lineasDeParrafo(texto) {
  return String(texto || '').split(/\r?\n/).map(function (l) { return l.trim(); })
    .filter(function (l) { return l; })
    .map(function (l) {
      var m = /^[•·]\s*(.*)$/.exec(l);
      return m ? { texto: m[1], vineta: true } : { texto: l, vineta: false };
    });
}

// datos: {fecha, horaInicio, horaFin, evaluacion, asistentes:[texto], fechaActaAnterior,
//   puntos:[texto | {titulo, parrafo}]}. Un punto sin párrafo sale con el texto gris de relleno.
function montarActa(ficha, datos) {
  var puntos = datos.puntos.map(function (p) {
    return typeof p === 'string' ? { titulo: p, parrafo: '' } : { titulo: p.titulo, parrafo: p.parrafo || '' };
  });
  return {
    titulo: tituloActa(ficha.ciclo, datos.evaluacion),
    celebrada: lineaCelebrada(datos.fecha, datos.horaInicio),
    filas: [
      ['CICLO', [String(ficha.ciclo).trim()]],
      ['COORDINADORA', [lineaPersona({ cargo: ficha.coordinadoraCargo, nombre: ficha.coordinadoraNombre })]],
      ['PROFESORADO ASISTENTE', datos.asistentes.slice()]
    ],
    puntos: puntos.map(function (p, i) { return (i + 1) + '. ' + p.titulo; }),
    asuntos: puntos.map(function (p, i) {
      var titulo = (i + 1) + '. ' + p.titulo;
      if (esPuntoActaAnterior(p.titulo) && datos.fechaActaAnterior) {
        var fijo = textoActaAnterior(datos.fechaActaAnterior);
        return { titulo: titulo, texto: fijo, pendiente: false, lineas: [{ texto: fijo, vineta: false }] };
      }
      var lineas = lineasDeParrafo(p.parrafo);
      if (!lineas.length) return { titulo: titulo, texto: TEXTO_PENDIENTE, pendiente: true, lineas: [{ texto: TEXTO_PENDIENTE, vineta: false }] };
      return { titulo: titulo, texto: p.parrafo, pendiente: false, lineas: lineas };
    }),
    cierre: [
      textoCierre(datos.fecha, datos.horaFin),
      lineaLugarFecha(ficha.localidad, datos.fecha),
      'FIRMA ELECTRÓNICA'
    ]
  };
}

// Devuelve un texto con el problema de los datos del formulario, o '' si valen.
function problemaDeDatosActa(d) {
  try { partesFecha(d.fecha); } catch (e) { return 'La fecha no es válida.'; }
  if (!horaValida(d.horaInicio)) return 'La hora de inicio no es válida.';
  if (!horaValida(d.horaFin)) return 'La hora de fin no es válida.';
  if (['PRIMERA', 'SEGUNDA', 'TERCERA'].indexOf(d.evaluacion) < 0) return 'Falta la evaluación.';
  if (!d.asistentes || !d.asistentes.length) return 'Marca al menos una persona del profesorado.';
  if (!d.puntos || !d.puntos.length) return 'Escribe al menos un punto del orden del día.';
  return '';
}
