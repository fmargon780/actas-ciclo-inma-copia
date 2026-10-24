/* La fila de botones de retoque junto a un texto redactado (fila 64): «Más escueto», «Desarrolla más», «Más técnico», «Más sencillo», «Otro cambio…» y «Deshacer».
   Cada pantalla la pone junto a cada texto y le dice cómo leer y cambiar ese texto. Lo difícil (Claude, nombres, versiones) está en retoque.js.
   o: { est, id (para reconocerla), almacen (el objeto que guarda `versiones`), clave, todos, limite?, ocupado (bool),
        leer(), escribir(texto, aviso), ocupar(si), alCambiar(), error(e) } */
(function (g) {
  'use strict';
  var h = g.Dom.h, T = g.Retoque;

  function barra(o) {
    var libre = h('input', { type: 'text', class: 'retoque-libre', 'data-retoque-libre': o.id, maxlength: String(T.MAX_LIBRE), placeholder: 'Otro cambio… (por ejemplo: quita la última frase)', 'aria-label': 'Otro cambio' });
    var botones = [];
    function boton(texto, accion, alPulsar, extra) {
      var b = h('button', { type: 'button', class: 'boton chico' + (extra || ''), 'data-retoque': accion, 'data-retoque-de': o.id, texto: texto, onclick: alPulsar });
      b.disabled = !!o.ocupado; botones.push(b); return b;
    }
    async function ejecutar(orden) {
      var texto = o.leer();
      o.ocupar(true);
      try {
        var clave = await g.Datos.leerClave(o.est.raiz), todos = o.todos ? await o.todos() : null;
        var r = await T.retocar(clave, texto, orden, { estilo: await g.Estilo.paraClaude(o.est.raiz, todos), todos: todos, limite: o.limite });
        T.cambiar(o.almacen, o.clave, texto, r.texto);
        o.escribir(r.texto, r.aviso);
        o.alCambiar();
      } catch (x) { o.error(x); }
      finally { o.ocupar(false); }
    }
    var envio = boton('Enviar', 'libre', function () { ejecutar({ libre: libre.value }); }, ' principal');
    libre.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!o.ocupado) envio.click(); } };
    libre.disabled = !!o.ocupado;
    var fila = h('div', { class: 'fila retoque', 'data-retoque-barra': o.id }, T.ORDENES.map(function (x) { return boton(x[1], x[0], function () { ejecutar({ id: x[0] }); }); }));
    var deshacer = boton('Deshacer', 'deshacer', function () {
      var antes = T.deshacer(o.almacen, o.clave, o.leer());
      if (antes == null) return;
      o.escribir(antes, '');
      o.alCambiar();
    });
    deshacer.disabled = !!o.ocupado || !T.hayVersiones(o.almacen, o.clave);
    fila.appendChild(deshacer);
    return h('div', { class: 'retoque-caja' }, [fila, h('div', { class: 'fila retoque-otro' }, [libre, envio])]);
  }

  g.PantallaRetoque = { barra: barra };
})(window);
