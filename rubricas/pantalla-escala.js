/* Ajustes › «Escala de las rúbricas» (fila 110): lo que vale cada nivel al calificar. Es la escala del curso actual de Rúbricas (ACTAS/rubricas/config.json);
   los cursos pasados conservan la suya. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  async function tarjeta(est) {
    var cuerpo = [h('h2', { texto: 'Escala de las rúbricas' })];
    var marca = await g.RubPasar.leerMarca(est);
    if (!marca) {
      cuerpo.push(h('p', { class: 'suave', id: 'escalaSinRubricas', texto: 'Aquí podrás cambiar lo que vale cada nivel cuando abras la pestaña Rúbricas y pases tus rúbricas.' }));
      return h('section', { class: 'tarjeta ancha', id: 'tarjetaEscala' }, cuerpo);
    }
    var raiz = await est.raiz.sub(g.RubPasar.DESTINO);
    var config = (await raiz.leerJSON('config.json')) || { cursoActual: g.RubDatos.CURSO, niveles: g.RubDatos.NIVELES };
    var aviso = g.Dom.aviso(), hecho = h('span', { class: 'suave', id: 'escalaGuardada' });
    var campos = config.niveles.map(function (n, i) {
      var v = h('input', { type: 'number', id: 'valor' + i, min: '0', max: '10', step: '0.5', value: String(n.valor), 'aria-label': 'Valor de ' + n.nombre });
      v.onchange = async function () {
        try {
          g.Dom.decir(aviso, ''); hecho.textContent = '';
          var valores = config.niveles.map(function (x, k) { return document.getElementById('valor' + k).value; });
          await g.Trabajo.guardarNiveles(raiz, config, g.Rubrica.validarValores(valores));
          if (est.rub && est.rub.configReal) est.rub.configReal.niveles = config.niveles.map(function (x) { return { nombre: x.nombre, valor: x.valor }; });
          if (est.rub && est.rub.editable) est.rub.config = est.rub.configReal;
          hecho.textContent = 'Guardado.';
        } catch (e) { g.Dom.decir(aviso, e.message || String(e)); }
      };
      return h('label', { class: 'campo' }, [n.nombre, v]);
    });
    cuerpo.push(h('p', { class: 'suave', texto: 'Lo que vale cada nivel al calificar. Cambia las notas del curso actual; los cursos pasados conservan la suya.' }));
    cuerpo.push(h('div', { class: 'escala-niveles', id: 'camposEscala' }, campos), aviso, hecho);
    return h('section', { class: 'tarjeta ancha', id: 'tarjetaEscala' }, cuerpo);
  }

  g.PantallaEscala = { tarjeta: tarjeta };
})(window);
