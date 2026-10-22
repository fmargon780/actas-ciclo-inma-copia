/* Quita los nombres de persona de un texto antes de mandarlo a Claude: cada nombre pasa a iniciales entre corchetes («[M.S.P.]»).
   Tres capas, de más a menos segura: (1) los nombres completos de la lista de Rúbricas (los mismos que ya detecta alumnado-claude.js),
   (2) cualquier palabra suelta que sea nombre o apellido de esa lista, (3) cualquier secuencia de dos o más palabras con mayúscula que parezca
   nombre de persona (salvo palabras corrientes de un colegio: «Día de la Lectura», «Plan Lector», meses…). Siempre se prefiere tapar de más.
   Sin pantalla ni red: se prueba con node --test. Usa alumnado.js y alumnado-claude.js. */
(function (g) {
  'use strict';
  var A = g.Alumnado, AC = g.AlumnadoClaude;
  var CORRIENTES = ('dia dias internacional internacionales derechos nino nina ninos ninas violencia genero constitucion flamenco lectura navidad carnaval andalucia plan lector semana santa ' +
    'educacion fisica lengua castellana conocimiento medio matematicas ingles frances ciencias naturales sociales musica plastica artistica religion valores primaria infantil secundaria ciclo ciclos ' +
    'primer segundo tercer tutoria junta consejeria colegio equipo directivo docente claustro consejo escolar programa proyecto escuela espacio paz igualdad coeducacion evaluacion inicial final ' +
    'ordinaria extraordinaria sesion reunion acta actas curso trimestre navidades pascua halloween otono primavera verano invierno medioambiente ambiente biblioteca huerto ' +
    'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre lunes martes miercoles jueves viernes sabado domingo ' +
    'jorge guillen alhaurin grande malaga espana andaluz andaluza gobierno ministerio consejeria educacion deporte tic neae nee pt al orientacion orientador orientadora equipo atencion diversidad ' +
    'seguimiento calendario informacion revision propuestas actividades complementarias extraescolares ruegos preguntas ultimacion planificacion').split(' ');
  var PALABRA = '[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+';
  var SECUENCIA = new RegExp(PALABRA + '(?:\\s+(?:(?:de|del|la|las|los|y)\\s+)?' + PALABRA + ')+', 'g');
  var CAPITALIZADA = new RegExp(PALABRA, 'g');

  function marca(nombre) { var i = AC.iniciales(nombre); return '[' + (i || 'X.') + ']'; }

  /* Capa 3: una secuencia de palabras con mayúscula es nombre salvo que todas sus palabras sean corrientes. */
  function tapar3(texto, esTitulo) {
    return texto.replace(SECUENCIA, function (run, pos) {
      var palabras = run.match(CAPITALIZADA) || [];
      if (esTitulo && pos === 0) palabras = palabras.slice(1); /* la primera palabra de un título va con mayúscula sin ser nombre */
      if (palabras.length < 2) return run;
      var raras = palabras.filter(function (w) { return CORRIENTES.indexOf(A.normalizar(w)) < 0; });
      return raras.length ? marca(run) : run;
    });
  }

  function crear(todos) {
    var ind = todos && todos.length ? AC.indice(todos) : null, sueltas = {};
    (todos || []).forEach(function (a) {
      A.palabras(a.nombre).forEach(function (w) {
        var n = A.normalizar(w);
        if (n.length >= 3 && A.PARTICULAS.indexOf(n) < 0) sueltas[n] = true;
      });
    });
    /* Capa 1 y 2 a la vez: trozos con nombre completo de la lista -> iniciales; el resto, palabra a palabra. */
    function tapar12(texto) {
      var trozos = ind ? AC.detectar(texto, ind) : [{ texto: texto }];
      return trozos.map(function (x) {
        if (x.alumno) return marca(x.alumno.nombre);
        if (x.ambiguo) return marca(x.ambiguo.texto);
        return x.texto.replace(CAPITALIZADA, function (w) { return sueltas[A.normalizar(w)] ? '[' + w.charAt(0) + '.]' : w; });
      }).join('');
    }
    return { texto: function (t, esTitulo) { return tapar3(tapar12(String(t == null ? '' : t)), !!esTitulo); } };
  }

  g.Anonimizar = { crear: crear };
})(typeof window !== 'undefined' ? window : globalThis);
