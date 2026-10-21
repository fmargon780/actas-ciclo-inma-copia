// Funciones de fechas y curso escolar. Sin nada de Google: se prueban con node --test.
// Las fechas son texto «aaaa-mm-dd» (lo que da un campo de fecha de un formulario).

var DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

function partesFecha(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) throw new Error('Fecha no válida: ' + iso);
  var a = +m[1], mes = +m[2], d = +m[3];
  var f = new Date(Date.UTC(a, mes - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) {
    throw new Error('Fecha no válida: ' + iso);
  }
  return { a: a, m: mes, d: d };
}

function dosCifras(n) { return (n < 10 ? '0' : '') + n; }

// «2026-09-02» -> «02/09/2026»
function fechaCorta(iso) {
  var p = partesFecha(iso);
  return dosCifras(p.d) + '/' + dosCifras(p.m) + '/' + p.a;
}

// «02/09/2026» -> «2026-09-02»
function fechaDesdeCorta(txt) {
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(txt || '').trim());
  if (!m) throw new Error('Fecha no válida: ' + txt);
  var iso = m[3] + '-' + m[2] + '-' + m[1];
  partesFecha(iso);
  return iso;
}

function diaSemana(iso) {
  var p = partesFecha(iso);
  return DIAS_SEMANA[new Date(Date.UTC(p.a, p.m - 1, p.d)).getUTCDay()];
}

// «2026-09-02» -> «2 de septiembre de 2026»
function fechaLarga(iso) {
  var p = partesFecha(iso);
  return p.d + ' de ' + MESES[p.m - 1] + ' de ' + p.a;
}

// «2026-09-02» -> «miércoles 2 de septiembre de 2026»
function fechaEnLetra(iso) {
  return diaSemana(iso) + ' ' + fechaLarga(iso);
}

// Año en que empieza el curso: de septiembre a agosto.
function anioInicioCurso(iso) {
  var p = partesFecha(iso);
  return p.m >= 9 ? p.a : p.a - 1;
}

// «2026-09-02» -> «2026-2027»
function cursoEscolar(iso) {
  var a = anioInicioCurso(iso);
  return a + '-' + (a + 1);
}

// Año de inicio de un texto de curso («2026-2027», «2026-27», «2026/2027»); null si no se entiende.
function anioInicioDeTextoCurso(txt) {
  var m = /^\s*(\d{4})\s*[-\/–]\s*(\d{2}|\d{4})\s*$/.exec(String(txt || ''));
  return m ? +m[1] : null;
}

// septiembre-diciembre PRIMERA; enero-marzo SEGUNDA; abril-agosto TERCERA.
function evaluacion(iso) {
  var m = partesFecha(iso).m;
  if (m >= 9) return 'PRIMERA';
  if (m <= 3) return 'SEGUNDA';
  return 'TERCERA';
}

// Valida «hh:mm» (campo de hora de un formulario).
function horaValida(txt) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(txt || '').trim());
  return !!m && +m[1] < 24 && +m[2] < 60;
}

function horaNormal(txt) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(txt || '').trim());
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error('Hora no válida: ' + txt);
  return dosCifras(+m[1]) + ':' + m[2];
}
