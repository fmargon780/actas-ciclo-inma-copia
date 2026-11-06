/* Retocar a mano cada ejercicio de la hoja: tipo, enunciado, lo escrito de ese tipo, la solución y la fila de la rúbrica.
   ctx: { filas, total, alEscribir() (repinta el papel al teclear), alTerminar() (guarda), alEstructura() (guarda y repinta todo), mover(i, delta), quitar(i) }. */
(function (g) {
  'use strict';
  var H = g.Hoja, Dm = g.RubDom, h = Dm.h;

  function actualizar(e, ctx) { var nuevo = H.normalizarEjercicio(e); Object.keys(nuevo).forEach(function (k) { e[k] = nuevo[k]; }); ctx.alEscribir(); }
  function cajaTexto(clase, valor, ayuda, aria, alEscribir, ctx) {
    var t = h('textarea', { class: clase, 'aria-label': aria, placeholder: ayuda || '' }); t.value = valor;
    t.oninput = function () { alEscribir(t.value); }; t.onchange = ctx.alTerminar;
    return t;
  }
  var campo = function (et, control) { return h('label', { class: 'campo' }, [et, control]); };

  /* Lo escrito de cada tipo. Devuelve los campos y, si cambian el tamaño de la solución, `refrescarSol` se llama para ponerla al día. */
  function camposDe(e, ctx, refrescarSol) {
    var c = e.contenido, lineasDe = function (v) { return v.split('\n').filter(function (x) { return x.trim(); }); };
    var lista = function (et, clave, ayuda) {
      return campo(et, cajaTexto('ed-' + clave, c[clave].join('\n'), ayuda, et, function (v) { c[clave] = lineasDe(v); actualizar(e, ctx); refrescarSol(); }, ctx));
    };
    var numero = function (et, valor, min, max, poner) {
      var n = h('input', { type: 'number', class: 'ed-numero', min: String(min), max: String(max), value: String(valor), 'aria-label': et });
      n.oninput = function () { poner(Number(n.value)); actualizar(e, ctx); }; n.onchange = ctx.alTerminar;
      return campo(et, n);
    };
    switch (e.tipo) {
      case 'elegir': return [lista('Opciones (una por línea, de 2 a 4)', 'opciones')];
      case 'vf': return [lista('Frases (una por línea)', 'frases')];
      case 'huecos': return [campo('Texto con huecos (escribe ____ donde va cada hueco)', cajaTexto('ed-texto', c.texto, '', 'Texto con huecos', function (v) { c.texto = v; actualizar(e, ctx); refrescarSol(); }, ctx))];
      case 'unir': return [lista('Columna de la izquierda (una por línea)', 'izq'), lista('Columna de la derecha (una por línea)', 'der')];
      case 'ordenar': case 'rodear': return [lista('Elementos (uno por línea)', 'elementos')];
      case 'corta': return [numero('Líneas para responder (1 a 3)', c.lineas, 1, 3, function (n) { c.lineas = n; })];
      case 'libre': return [numero('Líneas para responder (1 a 10)', c.lineas, 1, 10, function (n) { c.lineas = n; })];
      case 'dibujo':
        return [campo('Recta numérica: marcas separadas por comas (vacío = sin recta)', (function () {
          var t = h('input', { type: 'text', class: 'ed-marcas', value: c.recta ? c.recta.marcas.join(', ') : '', 'aria-label': 'Marcas de la recta' });
          t.oninput = function () { c.recta = { marcas: t.value.split(',') }; actualizar(e, ctx); }; t.onchange = ctx.alTerminar; return t;
        })()),
        numero('Tabla vacía: filas (0 = sin tabla)', c.tabla ? c.tabla.filas : 0, 0, 12, function (n) { c.tabla = n ? { filas: n, columnas: c.tabla ? c.tabla.columnas : 3 } : null; }),
        numero('Tabla vacía: columnas', c.tabla ? c.tabla.columnas : 0, 0, 8, function (n) { if (c.tabla && n) c.tabla.columnas = n; })];
      case 'musica': return [musica(e, ctx)];
      default: return [];
    }
  }

  /* Pentagrama o línea de ritmo: el modo y una fila de botones con las figuras, que se añaden al final; «Borrar la última» quita la última. */
  function musica(e, ctx) {
    var c = e.contenido, modo = h('select', { class: 'ed-modo', 'aria-label': 'Pentagrama o línea de ritmo' }, [h('option', { value: 'pentagrama', texto: 'Pentagrama' }), h('option', { value: 'ritmo', texto: 'Línea de ritmo' })]);
    modo.value = c.modo; modo.onchange = function () { c.modo = modo.value; ctx.alEstructura(); };
    var botones = H.FIGURAS.map(function (f) {
      return h('button', { type: 'button', class: 'mini figura', 'data-figura': f.id, texto: f.nombre, onclick: function () { c.figuras.push(f.id); actualizar(e, ctx); ctx.alEstructura(); } });
    });
    botones.push(h('button', { type: 'button', class: 'mini', 'data-borrar-figura': '1', texto: 'Borrar la última', onclick: function () { c.figuras.pop(); ctx.alEstructura(); } }));
    return h('div', { class: 'ed-musica' }, [campo('Dibujo', modo), h('div', { class: 'fila-figuras' }, botones), h('p', { class: 'suave', texto: c.figuras.length ? 'Figuras puestas: ' + c.figuras.length : 'Vacío: el niño lo escribe todo.' })]);
  }

  var AYUDA_SOL = {
    elegir: 'Número de la opción correcta', vf: 'V o F, una por línea (una por frase)', huecos: 'Lo que va en cada hueco, uno por línea',
    unir: 'Para cada elemento de la izquierda, el número de la derecha (uno por línea)', ordenar: 'Número de orden de cada elemento (uno por línea)',
    rodear: 'Números de los elementos que hay que rodear, separados por comas', problema: 'Tres líneas: datos, operación, solución'
  };

  function tarjeta(e, i, ctx) {
    var tipo = h('select', { class: 'ed-tipo', 'aria-label': 'Tipo de ejercicio ' + (i + 1) }, H.TIPOS.map(function (t) { return h('option', { value: t.id, texto: t.nombre }); }));
    tipo.value = e.tipo;
    tipo.onchange = function () { Object.assign(e, H.cambiarTipo(e, tipo.value)); ctx.alEstructura(); };
    var sol = cajaTexto('ed-solucion', H.solucionATexto(e), '', 'Solución del ejercicio ' + (i + 1), function (v) { e.solucion = H.textoASolucion(e, v); ctx.alEscribir(); }, ctx);
    var refrescarSol = function () { var v = H.solucionATexto(e); if (sol.value !== v) sol.value = v; };
    var enun = cajaTexto('ed-enunciado', e.enunciado, 'Lo que tiene que hacer el niño', 'Enunciado del ejercicio ' + (i + 1), function (v) { e.enunciado = v.trim(); ctx.alEscribir(); }, ctx);
    var fila = ctx.filas.length ? h('select', { class: 'ed-fila', 'aria-label': 'Fila de la rúbrica del ejercicio ' + (i + 1) }, [h('option', { value: '', texto: '(ninguna)' })].concat(ctx.filas.map(function (f) {
      return h('option', { value: f.id, texto: f.texto.length > 60 ? f.texto.slice(0, 60) + '…' : f.texto });
    }))) : null;
    if (fila) { fila.value = e.fila || ''; fila.onchange = function () { if (fila.value) e.fila = fila.value; else delete e.fila; ctx.alEstructura(); }; }
    var b = function (txt, titulo, fn) { return h('button', { type: 'button', class: 'mini', title: titulo, 'aria-label': titulo, texto: txt, onclick: fn }); };
    return h('div', { class: 'tarjeta ed-ejercicio', 'data-ejercicio': e.id }, [
      h('div', { class: 'barra' }, [h('b', { texto: 'Ejercicio ' + (i + 1) }), tipo,
        b('↑', 'Subir el ejercicio', function () { ctx.mover(i, -1); }), b('↓', 'Bajar el ejercicio', function () { ctx.mover(i, 1); }), b('✕', 'Quitar el ejercicio', function () { ctx.quitar(i); })]),
      campo('Enunciado', enun)
    ].concat(camposDe(e, ctx, refrescarSol)).concat([
      campo('Solución (' + (AYUDA_SOL[e.tipo] || 'respuesta orientativa; vacío = «Respuesta abierta»') + ')', sol),
      fila ? campo('Ayuda a calificar esta fila de la rúbrica', fila) : null
    ]));
  }

  g.HojaEditor = { tarjeta: tarjeta };
})(window);
