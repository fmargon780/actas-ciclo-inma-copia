// Ficha del curso: datos que se repiten en todas las actas. Sin nada de Google.

function fichaPorDefecto(hoyIso) {
  return {
    curso: cursoEscolar(hoyIso),
    ciclo: 'Segundo ciclo',
    localidad: 'Alhaurín el Grande',
    coordinadoraCargo: '',
    coordinadoraNombre: '',
    profesorado: ''
  };
}

// «Cargo: Nombre» por línea -> [{cargo, nombre}]. Sin «:» toda la línea es el nombre.
function parsearProfesorado(texto) {
  return String(texto || '').split(/\r?\n/).map(function (l) { return l.trim(); })
    .filter(function (l) { return l; })
    .map(function (l) {
      var i = l.indexOf(':');
      if (i < 0) return { cargo: '', nombre: l };
      return { cargo: l.slice(0, i).trim(), nombre: l.slice(i + 1).trim() };
    });
}

function lineaPersona(p) {
  return p.cargo ? p.cargo + ': ' + p.nombre : p.nombre;
}

// Devuelve un texto con el problema, o '' si la ficha vale.
function problemaDeFicha(f) {
  if (!f) return 'Falta rellenar los datos del curso.';
  if (anioInicioDeTextoCurso(f.curso) === null) return 'El curso debe escribirse así: 2026-2027.';
  if (!String(f.ciclo || '').trim()) return 'Falta el ciclo.';
  if (!String(f.localidad || '').trim()) return 'Falta la localidad.';
  if (!String(f.coordinadoraNombre || '').trim()) return 'Falta el nombre de la coordinadora.';
  if (!parsearProfesorado(f.profesorado).length) return 'Falta el profesorado (una persona por línea).';
  return '';
}

// ¿La ficha es de otro curso distinto al de la fecha del acta?
function fichaDeOtroCurso(f, fechaIso) {
  return anioInicioDeTextoCurso(f.curso) !== anioInicioCurso(fechaIso);
}
