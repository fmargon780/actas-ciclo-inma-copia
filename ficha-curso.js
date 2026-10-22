/* Datos del curso (fila 43): la ficha de ACTAS/ficha.json que se escribe en Ajustes. Sin pantalla: la carpeta entra por parámetro.
   Mismo formato que escribe el documento (profesorado = líneas «Cargo: Nombre») más `cambiadaEnPagina` (ISO) para que el documento la recoja. */
(function (g) {
  'use strict';

  function texto(x) { return String(x == null ? '' : x).trim(); }

  /* Líneas «Cargo: Nombre» -> filas {cargo, nombre}. Sin «:» toda la línea es el nombre (igual que parsearProfesorado del documento). */
  function filasDeLineas(lineas) {
    return (lineas || []).map(function (l) {
      var t = texto(l), i = t.indexOf(':');
      return i < 0 ? { cargo: '', nombre: t } : { cargo: texto(t.slice(0, i)), nombre: texto(t.slice(i + 1)) };
    }).filter(function (f) { return f.nombre || f.cargo; });
  }
  function lineaDeFila(f) { return f.cargo ? f.cargo + ': ' + f.nombre : f.nombre; }

  /* Las filas totalmente vacías se ignoran. */
  function limpiarFilas(filas) {
    return (filas || []).map(function (f) { return { cargo: texto(f.cargo), nombre: texto(f.nombre) }; })
      .filter(function (f) { return f.cargo || f.nombre; });
  }

  /* Lo que se enseña en el formulario: la ficha leída (o null) -> datos con filas. Sin ficha, el curso se propone por la fecha de hoy. */
  function datosIniciales(ficha, hoyIso) {
    var f = ficha || {};
    return {
      curso: texto(f.curso) || g.cursoEscolar(hoyIso), ciclo: texto(f.ciclo) || 'Segundo ciclo', localidad: texto(f.localidad) || 'Alhaurín el Grande',
      coordinadoraCargo: texto(f.coordinadoraCargo), coordinadoraNombre: texto(f.coordinadoraNombre),
      filas: filasDeLineas(f.profesorado)
    };
  }

  /* Las mismas reglas y frases que problemaDeFicha (src/ficha.js). '' si vale. */
  function problema(d) {
    if (!d) return 'Falta rellenar los datos del curso.';
    if (g.anioInicioDeTextoCurso(d.curso) === null) return 'El curso debe escribirse así: 2026-2027.';
    if (!texto(d.ciclo)) return 'Falta el ciclo.';
    if (!texto(d.localidad)) return 'Falta la localidad.';
    if (!texto(d.coordinadoraNombre)) return 'Falta el nombre de la coordinadora.';
    if (!limpiarFilas(d.filas).length) return 'Falta el profesorado (una persona por línea).';
    return '';
  }

  /* Un docente sin nombre no vale en un acta: se avisa antes de guardar. */
  function problemaDeFilas(d) {
    var vacia = limpiarFilas(d.filas).filter(function (f) { return !f.nombre; })[0];
    return vacia ? 'Al docente «' + vacia.cargo + '» le falta el nombre.' : '';
  }

  /* El objeto que va a ficha.json: conserva lo que ya traía (`ultimaActa`...) y pone `cambiadaEnPagina`. */
  function paraGuardar(d, anterior, ahora) {
    var ant = anterior || {};
    return {
      formato: 1, curso: texto(d.curso), ciclo: texto(d.ciclo), localidad: texto(d.localidad),
      coordinadoraCargo: texto(d.coordinadoraCargo), coordinadoraNombre: texto(d.coordinadoraNombre),
      profesorado: limpiarFilas(d.filas).map(lineaDeFila),
      ultimaActa: ant.ultimaActa || null,
      cambiadaEnPagina: (ahora || new Date()).toISOString()
    };
  }

  /* Valida y guarda. Devuelve la ficha escrita, o lanza un Error con la frase en español. */
  async function guardar(raiz, d, ahora) {
    var p = problema(d) || problemaDeFilas(d);
    if (p) { var e = new Error(p); e.enEspanol = true; throw e; }
    var anterior = await g.Datos.leerFicha(raiz);
    var ficha = paraGuardar(d, anterior, ahora);
    await raiz.escribirJSON('ficha.json', ficha);
    return ficha;
  }

  /* Los cargos que sugiere la caja: tutores de los grupos de Rúbricas (si hay) y los de siempre. */
  function sugerencias(grupos) {
    var lista = [];
    (grupos || []).forEach(function (n) { lista.push('Tutora de ' + n, 'Tutor de ' + n); });
    return lista.concat(['Especialista de Inglés', 'Especialista de Música', 'Especialista de Educación Física', 'Especialista de Religión',
      'Maestra de Pedagogía Terapéutica', 'Maestra de Audición y Lenguaje', 'Coordinadora de ciclo']);
  }

  /* Sube (-1) o baja (+1) una fila; devuelve la lista nueva. */
  function mover(filas, i, paso) {
    var j = i + paso, c = filas.slice();
    if (j < 0 || j >= c.length) return c;
    var t = c[i]; c[i] = c[j]; c[j] = t;
    return c;
  }

  g.FichaCurso = { filasDeLineas: filasDeLineas, limpiarFilas: limpiarFilas, datosIniciales: datosIniciales, problema: problema, problemaDeFilas: problemaDeFilas,
    paraGuardar: paraGuardar, guardar: guardar, sugerencias: sugerencias, mover: mover };
})(typeof window !== 'undefined' ? window : globalThis);
