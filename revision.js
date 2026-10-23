// Reglas de «Revisar acta». Sin nada de Google: se prueban con node --test.
// Trabajan sobre las líneas de texto de UN acta y devuelven lo que hay que marcar en amarillo:
// [{linea, fragmento, frase}] (linea = posición en la lista de líneas; frase = lo que se dice a Inma).

var COLOR_REVISION = '#FFF176';

var MESES_RE = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
var DIAS_RE = 'lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo';

function sinTildes(t) {
  return String(t).toLowerCase().replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u');
}

function isoDe(a, m, d) {
  var f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return a + '-' + dosCifras(m) + '-' + dosCifras(d);
}

// Fechas escritas en una línea: «2/9/2026», «02/09/2026», «2 de septiembre de 2026»,
// con día de la semana delante si lo hay. Devuelve [{ini, fin, texto, iso|null, dia|null}].
function fechasEnLinea(linea) {
  var res = [];
  var re = new RegExp('(?:\\b(' + DIAS_RE + ')\\s+)?(?:(\\d{1,2})\\s+de\\s+(' + MESES_RE +
    ')\\s+de\\s+(\\d{4})|(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4}))\\b', 'gi');
  var m;
  while ((m = re.exec(linea)) !== null) {
    var a, mes, d;
    if (m[2]) {
      var nombre = sinTildes(m[3]).replace('setiembre', 'septiembre');
      mes = MESES.map(sinTildes).indexOf(nombre) + 1; d = +m[2]; a = +m[4];
    } else { d = +m[5]; mes = +m[6]; a = +m[7]; }
    res.push({ ini: m.index, fin: m.index + m[0].length, texto: m[0], iso: isoDe(a, mes, d),
      dia: m[1] ? sinTildes(m[1]) : null, anio: a });
  }
  return res;
}

function dentro(rangos, ini, fin) {
  return rangos.some(function (r) { return ini >= r[0] && fin <= r[1]; });
}

function limitesCurso(anioInicio) {
  return [anioInicio + '-09-01', (anioInicio + 1) + '-08-31'];
}

// Reglas 1, 3 y 4 sobre una línea: años, día de la semana y fechas fuera del curso.
function revisarFechasYAnios(linea, n, anioInicio) {
  var out = [];
  var ocupado = [];
  var lim = limitesCurso(anioInicio);
  function marca(texto, frase) { out.push({ linea: n, fragmento: texto, frase: frase }); }

  fechasEnLinea(linea).forEach(function (f) {
    ocupado.push([f.ini, f.fin]);
    if (!f.iso) { marca(f.texto, 'Fecha que no existe: “' + f.texto + '”.'); return; }
    if (f.iso < lim[0]) marca(f.texto, 'Fecha del curso pasado: “' + f.texto + '”.');
    else if (f.iso > lim[1]) marca(f.texto, 'Fecha de un curso posterior al ' + anioInicio + '-' +
      (anioInicio + 1) + ': “' + f.texto + '”.');
    if (f.dia && sinTildes(diaSemana(f.iso)) !== f.dia) {
      marca(f.texto, 'El día de la semana no coincide con la fecha: “' + f.texto + '” (fue ' +
        diaSemana(f.iso) + ').');
    }
  });

  // «miércoles 10 de septiembre» (sin año): el año es el del curso (septiembre-diciembre, el de inicio; enero-agosto, el siguiente).
  var sinAnio = new RegExp('\\b(' + DIAS_RE + ')\\s+(\\d{1,2})\\s+de\\s+(' + MESES_RE + ')\\b(?!\\s+de\\s+\\d{4})', 'gi'), s;
  while ((s = sinAnio.exec(linea)) !== null) {
    var mesS = MESES.map(sinTildes).indexOf(sinTildes(s[3]).replace('setiembre', 'septiembre')) + 1;
    var isoS = isoDe(mesS >= 9 ? anioInicio : anioInicio + 1, mesS, +s[2]);
    if (!isoS) marca(s[0], 'Fecha que no existe: “' + s[0] + '”.');
    else if (sinTildes(diaSemana(isoS)) !== sinTildes(s[1])) {
      marca(s[0], 'El día de la semana no coincide con la fecha: “' + s[0] + '” (el ' + fechaLarga(isoS) + ' es ' + diaSemana(isoS) + ').');
    }
  }

  var cursos = /(?:^|[^\d\/-])(\d{4})\s*[-\/–]\s*(\d{4}|\d{2})(?![\d\/-])/g, m;
  while ((m = cursos.exec(linea)) !== null) {
    var texto = m[0].slice(m[0].indexOf(m[1]));
    var ini = m.index + m[0].indexOf(m[1]);
    ocupado.push([ini, ini + texto.length]);
    var seg = m[2].length === 2 ? +m[2] : +m[2] % 100;
    if (+m[1] !== anioInicio || seg !== (anioInicio + 1) % 100) {
      marca(texto, 'Curso que no es el ' + anioInicio + '-' + (anioInicio + 1) + ': “' + texto + '”.');
    }
  }
  var cortos = /(?:^|[^\d\/-])(\d{2})\s*[-–]\s*(\d{2})(?![\d\/-])/g;
  while ((m = cortos.exec(linea)) !== null) {
    var a = +m[1], b = +m[2];
    if (a < 20 || b !== (a + 1) % 100) continue;
    var t = m[0].slice(m[0].indexOf(m[1]));
    var i0 = m.index + m[0].indexOf(m[1]);
    if (dentro(ocupado, i0, i0 + t.length)) continue;
    ocupado.push([i0, i0 + t.length]);
    if (2000 + a !== anioInicio) marca(t, 'Curso que no es el ' + anioInicio + '-' + (anioInicio + 1) + ': “' + t + '”.');
  }

  var anios = /\b(19|20)\d{2}\b/g;
  while ((m = anios.exec(linea)) !== null) {
    if (dentro(ocupado, m.index, m.index + 4)) continue;
    if (+m[0] !== anioInicio && +m[0] !== anioInicio + 1) {
      marca(m[0], 'Año del curso pasado o de otro curso: “' + m[0] + '”.');
    }
  }
  return out;
}

// Fecha de la cabecera («Celebrada el día dd/mm/aaaa»), en «aaaa-mm-dd»; null si no hay.
function fechaDeCabecera(lineas) {
  var fechas = fechasDeActas(lineas.join('\n'));
  return fechas.length ? fechas[0] : null;
}

function posicion(lineas, patron, desde) {
  for (var i = desde || 0; i < lineas.length; i++) if (patron.test(lineas[i].trim())) return i;
  return -1;
}

// Regla 2: la fecha del cierre y la del «En …, a …» deben ser la de la cabecera.
function revisarCierre(lineas, cabecera) {
  var out = [];
  lineas.forEach(function (l, n) {
    var cierre = /se levanta la sesi[oó]n el /i.test(l) || /^\s*En [^,]+, a /.test(l);
    if (!cierre) return;
    fechasEnLinea(l).forEach(function (f) {
      if (f.iso && f.iso !== cabecera) {
        out.push({ linea: n, fragmento: f.texto, frase: 'La fecha del cierre (“' + f.texto +
          '”) no es la de la cabecera (' + fechaCorta(cabecera) + ').' });
      }
    });
  });
  return out;
}

// Regla 5: la fecha del acta anterior citada debe ser la de la cabecera del acta anterior.
function revisarActaAnterior(lineas, fechaAnterior) {
  var out = [];
  var ini = posicion(lineas, /^\d+\s*[.)-]\s*Lectura y aprobaci[oó]n del acta anterior/i,
    Math.max(0, posicion(lineas, /^ASUNTOS TRATADOS$/i)));
  if (ini < 0) return out;
  for (var i = ini + 1; i < lineas.length && !/^\d+\s*[.)-]\s/.test(lineas[i].trim()) &&
    !/^Sin más asuntos/i.test(lineas[i].trim()); i++) {
    fechasEnLinea(lineas[i]).forEach(function (f) {
      if (f.iso && f.iso !== fechaAnterior) {
        out.push({ linea: i, fragmento: f.texto, frase: 'El acta anterior que se cita es del ' +
          f.texto + ', pero la anterior de este documento es del ' + fechaCorta(fechaAnterior) + '.' });
      }
    });
  }
  return out;
}

// Regla 6: textos de relleno que se han quedado.
function revisarRelleno(lineas) {
  var out = [];
  lineas.forEach(function (l, n) {
    if (l.indexOf(TEXTO_PENDIENTE) >= 0) {
      out.push({ linea: n, fragmento: TEXTO_PENDIENTE, frase: 'Falta escribir lo tratado: queda “' +
        TEXTO_PENDIENTE + '”.' });
    }
  });
  return out;
}

function clavePunto(l) {
  return String(l).trim().replace(/\s+/g, ' ').toLowerCase().replace(/^(\d+)\s*[.)-]\s*/, '$1. ');
}

// Regla 7: los puntos del día y los asuntos tratados deben corresponderse.
function revisarPuntosYAsuntos(lineas) {
  var out = [];
  var p = posicion(lineas, /^PUNTOS DEL D[IÍ]A$/i);
  var a = posicion(lineas, /^ASUNTOS TRATADOS$/i);
  if (p < 0 || a < 0 || a < p) return out;
  var fin = posicion(lineas, /^Sin más asuntos/i, a);
  if (fin < 0) fin = lineas.length;
  var numerada = /^\d+\s*[.)-]\s*\S/;
  var puntos = [], asuntos = [];
  for (var i = p + 1; i < a; i++) if (numerada.test(lineas[i].trim())) puntos.push(i);
  for (var j = a + 1; j < fin; j++) if (numerada.test(lineas[j].trim())) asuntos.push(j);
  var clavesAsuntos = asuntos.map(function (j) { return clavePunto(lineas[j]); });
  var clavesPuntos = puntos.map(function (i) { return clavePunto(lineas[i]); });
  puntos.forEach(function (i, k) {
    if (clavesAsuntos.indexOf(clavesPuntos[k]) < 0) {
      out.push({ linea: i, fragmento: lineas[i].trim(), frase: 'Punto del día sin su asunto tratado ' +
        '(o con otro número u otro título): “' + lineas[i].trim() + '”.' });
    }
  });
  asuntos.forEach(function (j, k) {
    if (clavesPuntos.indexOf(clavesAsuntos[k]) < 0) {
      out.push({ linea: j, fragmento: lineas[j].trim(), frase: 'Asunto tratado sin su punto en el orden ' +
        'del día (o con otro número u otro título): “' + lineas[j].trim() + '”.' });
    }
  });
  return out;
}

// lineas: texto de cada párrafo del acta, en orden. opc: {anioInicio, fechaAnterior (iso|null)}.
function revisarLineasActa(lineas, opc) {
  var base = [];
  lineas.forEach(function (l, n) {
    base = base.concat(revisarFechasYAnios(l, n, opc.anioInicio));
  });
  var cabecera = fechaDeCabecera(lineas);
  var resto = [];
  if (cabecera) resto = resto.concat(revisarCierre(lineas, cabecera));
  if (opc.fechaAnterior) resto = resto.concat(revisarActaAnterior(lineas, opc.fechaAnterior));
  resto = resto.concat(revisarRelleno(lineas), revisarPuntosYAsuntos(lineas));
  // Si una fecha ya está marcada por ser vieja o fuera de curso, no se repite por otra regla.
  var marcados = {};
  base.forEach(function (h) { marcados[h.linea + '|' + h.fragmento] = true; });
  return base.concat(resto.filter(function (h) { return !marcados[h.linea + '|' + h.fragmento]; }));
}

function textoResultadoRevision(hallazgos) {
  if (!hallazgos.length) return 'Todo cuadra. No he marcado nada.';
  var n = hallazgos.length;
  return 'He marcado ' + n + (n === 1 ? ' cosa' : ' cosas') + ' en amarillo. No he cambiado ningún texto:\n\n' +
    hallazgos.map(function (h) { return h.frase; }).join('\n');
}
