/* El resumen del acta de evaluación llega al acta del equipo de ciclo (fila 61). Sin pantalla ni carpeta: se prueba con node --test.
   - La propia clase entra sola: el bloque de esa clase del punto de evaluación recibe el `resumenCiclo` del acta de evaluación de la misma
     evaluación (hueco «Resumen de la sesión de evaluación»), sin pisar nada escrito.
   - «Enviar resumen al ciclo»: texto con una primera línea «RESUMEN DE EVALUACIÓN · clase · sesión · dd/mm/aaaa».
   - «Pegar resumen de otra clase»: se lee esa línea, se busca el bloque de la clase, y los nombres reconocidos pasan a marcas de alumnado.
   Un hueco con `revisar: true` (puede haber un nombre que no está en la lista) no va a Claude hasta que se corrija o se confirme (huecos.js). */
(function (g) {
  'use strict';
  var A = g.Alumnado, AC = g.AlumnadoClaude, E = g.Evaluacion;
  var TITULO = 'Resumen de la sesión de evaluación';
  var ENCABEZADO = 'RESUMEN DE EVALUACIÓN';
  var AVISO_NOMBRE = 'Revisa: puede haber un nombre que no está en tu lista';
  /* Palabras con mayúscula que no son nombres de alumnado (áreas, meses, días, sesiones). */
  var NO_NOMBRES = ['lengua', 'matematicas', 'ingles', 'ciencias', 'naturales', 'sociales', 'artistica', 'educacion', 'fisica', 'religion', 'atencion', 'educativa',
    'valores', 'sociales', 'civicos', 'musica', 'plastica', 'frances', 'castellana', 'literatura', 'primaria', 'infantil', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'primera', 'segunda',
    'tercera', 'inicial', 'final', 'seneca', 'rubricas', 'suficiente', 'insuficiente', 'bien', 'notable', 'sobresaliente', 'jorge', 'guillen'];

  /* «4.º B» = «4º B» = «4ºb»; «Primera» = «PRIMERA»: sin tildes, puntos, «º», espacios ni mayúsculas. */
  function clave(t) { return A.normalizar(t).replace(/[^a-z0-9ñ]/g, ''); }
  function lleno(t) { return !!String(t == null ? '' : t).trim(); }

  /* El acta de evaluación que corresponde a una clase: mismo curso, misma evaluación que el acta de ciclo, fecha no posterior y con resumen.
     Si hay varias, la más reciente. Si no hay, null (nunca la de otra evaluación). */
  function elegirActa(evaluaciones, clase, evaluacion, fechaCiclo) {
    var curso = g.cursoEscolar(fechaCiclo);
    var buenas = (evaluaciones || []).filter(function (e) {
      return e && clave(e.clase) === clave(clase) && g.cursoEscolar(e.fecha) === curso && E.evaluacionDeSesion(e.sesion) === evaluacion &&
        e.fecha <= fechaCiclo && lleno(e.resumenCiclo);
    });
    buenas.sort(function (a, b) { return a.fecha === b.fecha ? (a.cambiado < b.cambiado ? 1 : -1) : (a.fecha < b.fecha ? 1 : -1); });
    return buenas[0] || null;
  }

  /* Los puntos de evaluación (los que tienen un bloque por grupo) y, en ellos, el bloque de una clase. */
  function puntosDeEvaluacion(b) { return b.puntos.filter(function (p) { return Array.isArray(p.grupos) && p.grupos.length; }); }
  function bloqueDe(p, clase) { return (p.grupos || []).filter(function (gr) { return clave(gr.nombre) === clave(clase); })[0] || null; }
  function huecoResumen(gr, crear) {
    var x = (gr.huecos || []).filter(function (k) { return clave(k.titulo) === clave(TITULO); })[0];
    if (!x && crear) { x = { titulo: TITULO, notas: '' }; (gr.huecos = gr.huecos || []).push(x); }
    return x || null;
  }
  function tieneAlgo(hueco) { return lleno(hueco.notas); }

  /* Al abrir el borrador: la propia clase entra sola. No pisa lo escrito. Devuelve { cambiado, avisos }. */
  function traerPropia(b, evaluaciones) {
    var res = { cambiado: false, avisos: [] };
    puntosDeEvaluacion(b).forEach(function (p) {
      p.grupos.forEach(function (gr) {
        var e = elegirActa(evaluaciones, gr.nombre, b.evaluacion, b.fecha);
        if (!e) return;
        var x = huecoResumen(gr, false);
        if (x && tieneAlgo(x)) return;
        x = huecoResumen(gr, true);
        x.notas = String(e.resumenCiclo); delete x.revisar;
        res.cambiado = true;
        res.avisos.push('Resumen traído del acta de evaluación ' + (E.sesion(e.sesion) ? E.sesion(e.sesion).nombre : e.sesion) + ' de ' + e.clase);
      });
    });
    return res;
  }

  /* --- Enviar --- */
  /* El texto que se copia: primera línea que lo identifica y, debajo, el resumen con los nombres completos en texto plano. */
  function textoParaEnviar(e) {
    var s = E.sesion(e.sesion);
    return ENCABEZADO + ' · ' + e.clase + ' · ' + (s ? s.nombre : e.sesion) + ' · ' + g.fechaCorta(e.fecha) + '\n' + A.aVisible(e.resumenCiclo).trim();
  }

  /* --- Pegar --- */
  /* El texto pegado -> { tieneLinea, clase, sesion, fecha, evaluacion, cuerpo }. Si no empieza por la línea, cuerpo es todo el texto. */
  function leerPegado(texto) {
    var t = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n').trim(), i = t.indexOf('\n');
    var primera = i < 0 ? t : t.slice(0, i), partes = primera.split('·').map(function (x) { return x.trim(); });
    if (partes.length < 4 || clave(partes[0]) !== clave(ENCABEZADO)) return { tieneLinea: false, clase: '', sesion: '', fecha: '', evaluacion: '', cuerpo: t };
    var ses = E.SESIONES.filter(function (s) { return clave(s.nombre) === clave(partes[2]); })[0];
    return { tieneLinea: true, clase: partes[1], sesion: partes[2], fecha: partes[3], evaluacion: ses ? ses.evaluacion : '', cuerpo: i < 0 ? '' : t.slice(i + 1).trim() };
  }

  /* El nombre del bloque (de entre las clases del punto) que es la clase dicha, o ''. */
  function claseReconocida(clases, dicha) {
    return (clases || []).filter(function (n) { return lleno(dicha) && clave(n) === clave(dicha); })[0] || '';
  }

  /* Nombres propios sueltos en trozos de texto normal (no en marcas): palabras con mayúscula que no empiezan frase ni son áreas, meses o días. */
  function nombresSueltos(trozos) {
    var hallados = [];
    trozos.forEach(function (x, k) {
      if (x.texto == null) return;
      var re = /[A-ZÁÉÍÓÚÑ][a-záéíóúüñ]+/g, m;
      while ((m = re.exec(x.texto))) {
        var antes = x.texto.slice(0, m.index).replace(/[ \t]+$/, '');
        var inicio = antes === '' ? k === 0 : /[.:;!?¿¡\n•\-–—«"“*]$/.test(antes);
        if (inicio || NO_NOMBRES.indexOf(clave(m[0])) >= 0) continue;
        hallados.push(m[0]);
      }
    });
    return hallados;
  }

  /* Un texto normal con nombres completos -> { texto (con marcas ⟦…⟧), revisar }. Los nombres de la lista pasan a marca; si el nombre va seguido de
     «(grupo)», ese paréntesis se quita (la marca ya lleva el grupo). Si queda algo que parece un nombre propio sin reconocer, o un nombre dudoso, revisar. */
  function conMarcas(cuerpo, todos) {
    var ind = todos && todos.length ? AC.indice(todos) : null, trozos = ind ? AC.detectar(cuerpo, ind) : [{ texto: String(cuerpo) }], salida = [], dudoso = false;
    trozos.forEach(function (x, k) {
      if (x.alumno) { salida.push(x); return; }
      if (x.ambiguo) { dudoso = true; salida.push({ texto: x.ambiguo.texto }); return; }
      var previo = salida[salida.length - 1], t = x.texto;
      if (previo && previo.alumno && previo.alumno.grupo) {
        var m = /^\s*\(([^)]*)\)/.exec(t);
        if (m && clave(m[1]) === clave(previo.alumno.grupo)) t = t.slice(m[0].length);
      }
      salida.push({ texto: t });
    });
    var nombres = nombresSueltos(salida);
    return {
      texto: salida.map(function (x) { return x.alumno ? A.marca(x.alumno) : x.texto; }).join(''),
      revisar: dudoso || nombres.length > 0, nombres: nombres
    };
  }

  /* Pone el texto pegado en el hueco del bloque. opciones.sustituir: ya se preguntó. Devuelve { estado: 'puesto'|'pregunta'|'sin-bloque'|'vacio', revisar }. */
  function ponerPegado(b, clase, cuerpo, todos, opciones) {
    if (!lleno(cuerpo)) return { estado: 'vacio', revisar: false };
    var hecho = null;
    puntosDeEvaluacion(b).forEach(function (p) {
      var gr = hecho ? null : bloqueDe(p, clase);
      if (!gr) return;
      var x = huecoResumen(gr, false);
      if (x && tieneAlgo(x) && !(opciones && opciones.sustituir)) { hecho = { estado: 'pregunta', revisar: false }; return; }
      x = huecoResumen(gr, true);
      var r = conMarcas(cuerpo, todos);
      x.notas = r.texto;
      if (r.revisar) x.revisar = true; else delete x.revisar;
      hecho = { estado: 'puesto', revisar: r.revisar, hueco: x };
    });
    return hecho || { estado: 'sin-bloque', revisar: false };
  }

  g.EvaluacionCiclo = {
    TITULO: TITULO, ENCABEZADO: ENCABEZADO, AVISO_NOMBRE: AVISO_NOMBRE, clave: clave, elegirActa: elegirActa, puntosDeEvaluacion: puntosDeEvaluacion,
    bloqueDe: bloqueDe, huecoResumen: huecoResumen, traerPropia: traerPropia, textoParaEnviar: textoParaEnviar, leerPegado: leerPegado,
    claseReconocida: claseReconocida, nombresSueltos: nombresSueltos, conMarcas: conMarcas, ponerPegado: ponerPegado
  };
})(typeof window !== 'undefined' ? window : globalThis);
