/* La caja de notas de un punto: texto normal con los alumnos elegidos de la lista como marcas (ver alumnado.js).
   Es un div editable de solo texto; cada alumno es una pieza que se borra de una vez. `leer()` da el texto con marcas (lo que se guarda). */
(function (g) {
  'use strict';
  var h = g.Dom.h, A = g.Alumnado;
  var MAXIMO_SUGERENCIAS = 6;

  /* texto: las notas con marcas; lista(): el estado de est.alumnado; cambio(texto): se llama con cada cambio. */
  function crear(indice, texto, lista, cambio) {
    var caja = h('div', { class: 'notas', contenteditable: 'plaintext-only', role: 'textbox', 'aria-multiline': 'true', 'data-notas': String(indice), 'data-placeholder': 'Notas cortas de lo tratado' });
    var sugs = h('div', { class: 'sugerencias', role: 'listbox', 'data-sugerencias': String(indice), hidden: '' });
    var menu = h('div', { class: 'menu-alumno', hidden: '' });
    var zonaBuscador = h('div', { class: 'zona-buscador' });
    var envoltorio = h('div', { class: 'envoltorio-notas' }, [caja, sugs, menu, zonaBuscador]);
    var abiertas = [], marcada = -1, ultimoRango = null;

    function nodoAlumno(a) {
      var n = h('span', { class: 'alumno' + (a.enLista === false ? ' fuera' : ''), contenteditable: 'false', 'data-nombre': a.nombre, 'data-grupo': a.grupo || '', 'data-enlista': a.enLista === false ? '0' : '1', texto: A.etiqueta(a) });
      if (a.enLista === false) n.appendChild(h('small', { class: 'aviso-fuera', texto: ' No está en la lista de Rúbricas' }));
      n.onclick = function (ev) { ev.preventDefault(); abrirMenu(n); };
      return n;
    }
    function escribir(t) {
      caja.textContent = '';
      A.trozos(t).forEach(function (x) { caja.appendChild(x.alumno ? nodoAlumno(x.alumno) : document.createTextNode(x.texto)); });
    }
    function leer() {
      var s = '';
      Array.prototype.forEach.call(caja.childNodes, function (n) {
        if (n.nodeType === 3) s += n.data.replace(/ /g, ' ');
        else if (n.classList && n.classList.contains('alumno')) s += A.marca({ nombre: n.getAttribute('data-nombre'), grupo: n.getAttribute('data-grupo'), enLista: n.getAttribute('data-enlista') !== '0' });
        else if (n.nodeName === 'BR') s += '\n';
        else s += n.textContent;
      });
      return s;
    }
    function avisar() { cambio(leer()); }

    /* --- sugerencias al escribir --- */
    function palabraActual() {
      var sel = g.getSelection();
      if (!sel || !sel.rangeCount || !sel.isCollapsed || !caja.contains(sel.anchorNode) || sel.anchorNode.nodeType !== 3) return null;
      var m = /(\p{L}{3,})$/u.exec(sel.anchorNode.data.slice(0, sel.anchorOffset));
      return m ? { nodo: sel.anchorNode, fin: sel.anchorOffset, palabra: m[1] } : null;
    }
    function cerrarSugerencias() { abiertas = []; marcada = -1; sugs.hidden = true; sugs.textContent = ''; }
    function pintarSugerencias() {
      sugs.textContent = '';
      abiertas.forEach(function (a, i) {
        var b = h('button', { type: 'button', class: 'sugerencia' + (i === marcada ? ' marcada' : ''), role: 'option', 'data-alumno': a.nombre, texto: A.etiqueta(a) });
        b.onmousedown = function (ev) { ev.preventDefault(); elegirSugerencia(i); };
        sugs.appendChild(b);
      });
      sugs.hidden = !abiertas.length;
    }
    function buscarSugerencias() {
      var est = lista(), w = palabraActual();
      if (!est || !est.lista || !w) { cerrarSugerencias(); return; }
      abiertas = A.sugerir(est.lista.delCiclo, w.palabra, MAXIMO_SUGERENCIAS); marcada = -1; pintarSugerencias();
    }
    function insertarEn(rango, alumno) {
      rango.deleteContents();
      var n = nodoAlumno(alumno), espacio = document.createTextNode(' ');
      rango.insertNode(espacio); rango.insertNode(n);
      var r = document.createRange(); r.setStart(espacio, 1); r.collapse(true);
      var sel = g.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      ultimoRango = r.cloneRange();
    }
    function elegirSugerencia(i) {
      var w = palabraActual(), a = abiertas[i];
      if (!w || !a) { cerrarSugerencias(); return; }
      var r = document.createRange(); r.setStart(w.nodo, w.fin - w.palabra.length); r.setEnd(w.nodo, w.fin);
      insertarEn(r, { nombre: a.nombre, grupo: a.grupo, enLista: true });
      cerrarSugerencias(); avisar();
    }
    caja.addEventListener('input', function () { avisar(); buscarSugerencias(); });
    caja.addEventListener('keydown', function (ev) {
      if (!abiertas.length) return;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        marcada = ev.key === 'ArrowDown' ? (marcada + 1) % abiertas.length : (marcada <= 0 ? abiertas.length - 1 : marcada - 1);
        pintarSugerencias();
      } else if (ev.key === 'Enter') {
        if (marcada >= 0) { ev.preventDefault(); elegirSugerencia(marcada); } else cerrarSugerencias(); /* Enter normal: salto de línea */
      } else if (ev.key === 'Escape') { ev.preventDefault(); cerrarSugerencias(); }
    });
    caja.addEventListener('blur', function () { setTimeout(cerrarSugerencias, 150); });
    caja.addEventListener('paste', function (ev) {
      ev.preventDefault();
      var t = (ev.clipboardData || g.clipboardData).getData('text');
      document.execCommand('insertText', false, t);
    });
    document.addEventListener('selectionchange', function () {
      var sel = g.getSelection();
      if (sel && sel.rangeCount && caja.contains(sel.anchorNode)) ultimoRango = sel.getRangeAt(0).cloneRange();
    });

    /* --- menú de un alumno marcado --- */
    function cerrarMenu() { menu.hidden = true; menu.textContent = ''; }
    function abrirMenu(n) {
      menu.textContent = '';
      menu.appendChild(h('button', { type: 'button', class: 'boton chico', 'data-accion': 'cambiar-alumno', texto: 'Cambiar alumno', onclick: function () { cerrarMenu(); abrirBuscador(n); } }));
      menu.appendChild(h('button', { type: 'button', class: 'boton chico peligro', 'data-accion': 'quitar-alumno', texto: 'Quitar', onclick: function () { cerrarMenu(); n.remove(); avisar(); } }));
      var e = envoltorio.getBoundingClientRect(), c = n.getBoundingClientRect();
      menu.style.left = Math.max(0, c.left - e.left) + 'px'; menu.style.top = (c.bottom - e.top + 2) + 'px';
      menu.hidden = false;
    }
    document.addEventListener('mousedown', function (ev) { if (!menu.hidden && !menu.contains(ev.target)) cerrarMenu(); });

    /* --- «+ Alumno» y «Cambiar alumno» --- */
    function cerrarBuscador() { zonaBuscador.textContent = ''; }
    function abrirBuscador(reemplazar) {
      cerrarBuscador(); cerrarSugerencias();
      var rango = ultimoRango && caja.contains(ultimoRango.startContainer) ? ultimoRango.cloneRange() : null;
      var inicial = reemplazar ? reemplazar.getAttribute('data-nombre') : '';
      var b = g.BuscadorAlumno.crear(inicial, lista, function (alumno) {
        if (reemplazar) reemplazar.replaceWith(nodoAlumno(alumno));
        else {
          if (!rango) { rango = document.createRange(); rango.selectNodeContents(caja); rango.collapse(false); }
          insertarEn(rango, alumno);
        }
        cerrarBuscador(); avisar();
      }, cerrarBuscador);
      zonaBuscador.appendChild(b.elemento); b.enfocar();
    }

    escribir(texto);
    /* El dictado escribe en `caja.value` como en un textarea. */
    var comoCaja = { get value() { return leer(); }, set value(t) { escribir(t); } };
    return { elemento: envoltorio, caja: caja, leer: leer, escribir: escribir, abrirBuscador: function () { abrirBuscador(null); }, comoCaja: comoCaja };
  }

  g.EditorNotas = { crear: crear };
})(window);
