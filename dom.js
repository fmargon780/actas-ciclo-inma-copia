/* Ayudas para pintar: crear elementos y montar la pantalla. Todo texto entra con textContent, nunca como HTML. */
(function (g) {
  'use strict';
  function h(etiqueta, atributos, hijos) {
    var e = document.createElement(etiqueta);
    Object.keys(atributos || {}).forEach(function (k) {
      if (k === 'texto') e.textContent = atributos[k];
      else if (k.indexOf('on') === 0) e[k] = atributos[k];
      else e.setAttribute(k, atributos[k]);
    });
    (hijos || []).forEach(function (x) { if (x) e.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
    return e;
  }
  function montar(nodos) { var p = document.getElementById('principal'); p.textContent = ''; nodos.forEach(function (n) { p.appendChild(n); }); }
  /* Avisos de error junto a la pantalla; `intentar` envuelve una acción para que un fallo se vea y no se pierda. */
  function aviso() { return h('div', { class: 'aviso error', hidden: '' }); }
  function decir(caja, texto) { caja.textContent = texto || ''; caja.hidden = !texto; }
  g.Dom = { h: h, montar: montar, aviso: aviso, decir: decir };
})(window);
