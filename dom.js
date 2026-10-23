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
  /* Abre un fichero guardado (File) en una pestaña nueva si el navegador sabe enseñarlo (PDF); si no, lo descarga. Devuelve 'abierto' o 'descargado'. */
  function abrirFichero(fichero, nombre, tipo) {
    var url = URL.createObjectURL(new Blob([fichero], { type: tipo })), pestana = tipo === 'application/pdf' ? window.open(url, '_blank') : null;
    if (!pestana) {
      var a = h('a', { href: url, download: nombre }); document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    return pestana ? 'abierto' : 'descargado';
  }
  g.Dom = { h: h, montar: montar, aviso: aviso, decir: decir, abrirFichero: abrirFichero };
})(window);
