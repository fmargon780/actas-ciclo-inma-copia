/* Los huecos de un punto en el formulario (fila 18): una caja corta por hueco, con su título encima, sin perder la caja de notas libres.
   El formulario le pasa `caja(id, texto, guardar, compacto)`, que arma la caja con dictado y «+ Alumno» como la de las notas. */
(function (g) {
  'use strict';
  var h = g.Dom.h, Hu = g.Huecos;

  /* Un bloque con la lista de huecos: cada uno con su título, su caja y «Quitar»; y debajo, añadir uno con el título que Inma quiera.
     lista: el array de huecos que se cambia; id: prefijo de los identificadores; repintar(): vuelve a pintar los puntos. */
  function bloque(lista, id, caja, cambio, repintar) {
    var nodos = lista.map(function (x, k) {
      var cabeza = h('div', { class: 'cabeza-hueco' }, [
        h('label', { class: 'titulo-hueco', texto: x.titulo }),
        h('button', { type: 'button', class: 'boton chico peligro', 'data-accion': 'quitar-hueco', title: 'Quitar este hueco', texto: '✕', onclick: function () { Hu.quitar(lista, k); cambio(); repintar(); } })
      ]);
      var partes = [cabeza];
      /* Fila 61: un resumen pegado con algo que parece un nombre sin reconocer no va a Claude hasta que se corrija o se confirme. */
      var aviso = h('div', { class: 'aviso', 'data-revisar-hueco': id + '-' + k, hidden: '' }, [
        h('span', { texto: (g.EvaluacionCiclo ? g.EvaluacionCiclo.AVISO_NOMBRE : 'Revisa este texto') + '. No va a Claude hasta que lo corrijas o lo confirmes. ' }),
        h('button', { type: 'button', class: 'boton chico', 'data-accion': 'confirmar-hueco', texto: 'Está bien así', onclick: function () { x.revisar = false; cambio(); repintar(); } })
      ]);
      aviso.hidden = !x.revisar;
      partes.push(aviso);
      partes.push(caja(id + '-' + k, x.notas, function (t) { x.notas = t; if (x.revisar) { x.revisar = false; aviso.hidden = true; } cambio(); }, true));
      return h('div', { class: 'hueco', 'data-hueco': id + '-' + k }, partes);
    });
    var nuevo = h('input', { type: 'text', class: 'nuevo-hueco', placeholder: 'Título de un hueco nuevo', 'aria-label': 'Título de un hueco nuevo' });
    var anadir = function () { if (Hu.anadir(lista, nuevo.value)) { cambio(); repintar(); } };
    nuevo.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); anadir(); } };
    nodos.push(h('div', { class: 'fila anadir-hueco' }, [nuevo, h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-hueco', texto: '+ Añadir hueco', onclick: anadir })]));
    return nodos;
  }

  /* Los huecos de un punto. Un punto de un borrador antiguo (sin huecos) solo enseña «+ Añadir hueco». */
  function pintar(p, i, caja, cambio, repintar) {
    var nodos = [];
    if (p.porGrupo && p.porGrupo.length && !Array.isArray(p.grupos)) {
      nodos.push(h('p', { class: 'suave', 'data-sin-grupos': String(i), texto: 'Para ver un bloque por cada grupo, abre la carpeta RÚBRICAS (arriba).' }));
    }
    (p.grupos || []).forEach(function (gr, j) {
      nodos.push(h('div', { class: 'grupo-huecos', 'data-grupo': i + '-' + j }, [h('h4', { class: 'titulo-grupo', texto: gr.nombre })].concat(bloque(gr.huecos, i + 'g' + j, caja, cambio, repintar))));
    });
    if (!p.huecos) p.huecos = [];
    nodos = nodos.concat(bloque(p.huecos, i + 'h', caja, cambio, repintar));
    return h('div', { class: 'huecos', 'data-huecos': String(i) }, nodos);
  }

  g.PantallaHuecos = { pintar: pintar };
})(window);
