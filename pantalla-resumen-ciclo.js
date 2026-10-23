/* «Pegar resumen de otra clase» (fila 61), en el punto de evaluación del acta de ciclo: se pega lo que mandó otra tutora, se reconoce su clase por
   la primera línea (o se elige de la lista de bloques) y el texto va al hueco «Resumen de la sesión de evaluación» de ese bloque. */
(function (g) {
  'use strict';
  var h = g.Dom.h, EC = g.EvaluacionCiclo;

  /* b: el borrador; p: el punto de evaluación; todos: alumnado del ciclo (o null); cambio(): guarda; repintar(): vuelve a pintar los puntos. */
  function pintar(b, p, i, todos, cambio, repintar) {
    var zona = h('div', { class: 'resumen-ciclo', 'data-resumen-ciclo': String(i) }), abierto = false;
    function cerrar() { abierto = false; dibujar(); }
    function dibujar() {
      zona.textContent = '';
      if (!abierto) {
        zona.appendChild(h('button', { type: 'button', class: 'boton chico', 'data-accion': 'pegar-resumen', texto: 'Pegar resumen de otra clase', onclick: function () { abierto = true; dibujar(); } }));
        return;
      }
      var clases = p.grupos.map(function (gr) { return gr.nombre; });
      var texto = h('textarea', { rows: '6', 'data-pegado': String(i), placeholder: 'Pega aquí (Ctrl+V) el resumen que te han mandado' });
      var lista = h('select', { 'data-clase-pegado': String(i), 'aria-label': 'Clase del resumen' }, [h('option', { value: '', texto: '— elige la clase —' })].concat(clases.map(function (n) { return h('option', { value: n, texto: n }); })));
      var aviso = h('div', { class: 'aviso', 'data-aviso-pegado': String(i), hidden: '' }), pregunta = h('div', { 'data-pregunta-pegado': String(i) });
      var leido = null;
      texto.oninput = function () {
        leido = EC.leerPegado(texto.value);
        var reconocida = leido.tieneLinea ? EC.claseReconocida(clases, leido.clase) : '';
        if (reconocida) lista.value = reconocida;
        var msg = '';
        if (!lleno(texto.value)) msg = '';
        else if (!leido.tieneLinea) msg = 'El texto no empieza por «' + EC.ENCABEZADO + ' · clase · sesión · fecha». Elige la clase de la lista.';
        else if (!reconocida) msg = 'No reconozco la clase «' + leido.clase + '» entre los bloques de este punto. Elígela de la lista.';
        else if (leido.evaluacion && leido.evaluacion !== b.evaluacion) msg = 'Ojo: este resumen es de la sesión ' + leido.sesion + ', de otra evaluación que la de esta acta.';
        g.Dom.decir(aviso, msg); pregunta.textContent = '';
      };
      function poner(sustituir) {
        var cuerpo = (leido || EC.leerPegado(texto.value)).cuerpo;
        if (!lista.value) { g.Dom.decir(aviso, 'Elige primero la clase.'); return; }
        var r = EC.ponerPegado(b, lista.value, cuerpo, todos, { sustituir: sustituir });
        if (r.estado === 'vacio') { g.Dom.decir(aviso, 'No hay texto que poner: pega el resumen.'); return; }
        if (r.estado === 'pregunta') {
          pregunta.textContent = '';
          pregunta.appendChild(h('div', { class: 'aviso pregunta', 'data-accion': 'sustituir-pregunta' }, [
            h('span', { texto: 'Ese bloque ya tiene un resumen. ¿Sustituir lo que hay? ' }),
            h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'si-sustituir-resumen', texto: 'Sí, sustituir', onclick: function () { poner(true); } }),
            h('button', { type: 'button', class: 'boton chico', 'data-accion': 'no-sustituir-resumen', texto: 'No', onclick: function () { pregunta.textContent = ''; } })
          ]));
          return;
        }
        cambio(); abierto = false; repintar();
      }
      zona.appendChild(h('div', { class: 'tarjeta-pegar' }, [
        h('strong', { texto: 'Pegar resumen de otra clase' }), texto,
        h('label', { class: 'campo' }, ['Clase', lista]), aviso, pregunta,
        h('div', { class: 'fila' }, [
          h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'poner-resumen', texto: 'Poner en su bloque', onclick: function () { poner(false); } }),
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'cerrar-pegar', texto: 'Cancelar', onclick: cerrar })
        ])
      ]));
    }
    function lleno(t) { return !!String(t || '').trim(); }
    dibujar();
    return zona;
  }

  g.PantallaResumenCiclo = { pintar: pintar };
})(window);
