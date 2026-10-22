/* Pantallas de ayuda (fila 44): la guía de «Primeros pasos» (ventana sobre la pantalla) y la página de ayuda del botón «?».
   Todo el texto sale de pagina/ayuda.json. Ctx: { est (o null si aún no hay carpeta), elegirCarpeta }. */
(function (g) {
  'use strict';
  var h = g.Dom.h, A = g.Ayuda;
  var FRASE_PRIMERO = 'Primero elige tu carpeta ACTAS.';

  function cerrarVentana() { var v = document.getElementById('guiaPrimerosPasos'); if (v) v.remove(); }

  /* Espera a que la pantalla nueva pinte el elemento y baja hasta él. */
  function bajarA(selector) {
    var n = 0, t = setInterval(function () {
      var e = document.querySelector(selector);
      if (e || ++n > 40) { clearInterval(t); if (e && e.scrollIntoView) e.scrollIntoView({ block: 'start' }); }
    }, 50);
  }

  /* Los pasos que necesitan la carpeta: sin ella, primero se elige. */
  function conCarpeta(ctx, hacer) {
    return function () {
      cerrarVentana();
      if (ctx.est) { hacer(ctx.est); return; }
      g.Pantalla.pedirCarpeta(FRASE_PRIMERO, ctx.elegirCarpeta);
      ctx.elegirCarpeta();
    };
  }

  async function abrirGuia(ctx) {
    var d = await A.cargar();
    if (!d || !d.guia) return;
    cerrarVentana();
    var lista = h('ol', { class: 'guia-pasos', id: 'guiaPasos' }), pie = h('div', { class: 'guia-pie' }), error = g.Dom.aviso();
    var ventana = h('div', { class: 'guia-fondo', id: 'guiaPrimerosPasos', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Primeros pasos' }, [
      h('div', { class: 'guia-caja' }, [h('h2', { texto: 'Primeros pasos' }), lista, error, pie])
    ]);

    function acciones(id) {
      var ir = function (txt, fn, ident) { return h('button', { type: 'button', class: 'boton chico principal', id: ident, texto: txt, onclick: fn }); };
      if (id === 'carpeta') return ctx.est ? [] : [ir('Ir', function () { cerrarVentana(); ctx.elegirCarpeta(); }, 'guiaIr-carpeta')];
      if (id === 'alumnado') return [
        h('a', { class: 'boton chico', href: 'https://rubricas-inma.vercel.app', target: '_blank', rel: 'noopener', texto: 'Abrir Rúbricas' }),
        ir('Abrir la carpeta RÚBRICAS', conCarpeta(ctx, async function (est) {
          /* la ventana ya se cerró: se vuelve a abrir con el resultado */
          var mal = await g.Rubricas.abrir(est);
          await abrirGuia(ctx);
          if (mal) { var e = document.getElementById('guiaPrimerosPasos'); if (e) g.Dom.decir(e.querySelector('.aviso.error'), mal); }
        }), 'guiaIr-alumnado')];
      if (id === 'datos-curso') return [ir('Ir', conCarpeta(ctx, async function (est) { await est.irAjustes(); bajarA('#tarjetaDatosCurso'); }), 'guiaIr-datos-curso')];
      if (id === 'clave') return [ir('Ir', conCarpeta(ctx, async function (est) { await est.irAjustes(); bajarA('#campoClave'); }), 'guiaIr-clave')];
      if (id === 'acta') return [
        ir('Nueva acta de ciclo', conCarpeta(ctx, function (est) { est.nuevoBorrador(); }), 'guiaIr-acta'),
        ir('Nueva convocatoria', conCarpeta(ctx, function (est) { est.abrirConvocatoria(); }), 'guiaIr-convocatoria')];
      return [];
    }

    async function pintar() {
      var hechos = await A.pasosHechos(ctx.est);
      lista.textContent = '';
      d.guia.forEach(function (p, i) {
        var texto = h('p', { class: 'guia-texto' }); A.nodosDeTexto(p.texto).forEach(function (n) { texto.appendChild(n); });
        lista.appendChild(h('li', { class: 'guia-paso' + (hechos[i] ? ' hecho' : ''), 'data-paso': p.id, 'data-hecho': hechos[i] ? '1' : '0' }, [
          h('span', { class: 'guia-marca', 'aria-label': hechos[i] ? 'Hecho' : 'Sin hacer', texto: hechos[i] ? '✓' : String(i + 1) }),
          h('div', { class: 'guia-cuerpo' }, [h('strong', { texto: p.titulo }), texto, h('div', { class: 'fila' }, acciones(p.id))])
        ]));
      });
      pie.textContent = '';
      if (hechos.every(Boolean)) pie.appendChild(h('p', { class: 'aviso ok', id: 'guiaTodoListo', texto: d.guiaTodoListo }));
      pie.appendChild(h('button', { type: 'button', class: 'boton', id: 'cerrarGuia', texto: 'Cerrar la guía', onclick: async function () { await A.cerrarGuia(ctx.est); cerrarVentana(); } }));
    }
    document.body.appendChild(ventana);
    await pintar();
  }

  /* Al abrir la app: sale sola mientras falte algún paso y no se haya cerrado. */
  async function guiaSiToca(ctx) {
    if (await A.guiaCerrada(ctx.est)) return;
    if ((await A.pasosHechos(ctx.est)).every(Boolean)) return;
    await abrirGuia(ctx);
  }

  /* Página de ayuda: índice a la izquierda, texto a la derecha. opciones: { seccion, alVolver, alGuia }. */
  async function pintarAyuda(op) {
    var d = await A.cargar();
    cerrarVentana();
    if (!d) { g.Dom.montar([h('div', { class: 'aviso error', id: 'sinAyuda', texto: 'No he podido cargar la ayuda.' }), h('button', { type: 'button', class: 'boton', id: 'volverAyuda', texto: '← Volver', onclick: op.alVolver })]); return; }
    var actual = A.seccionDe(op.seccion), texto = h('article', { class: 'ayuda-texto', id: 'ayudaTexto' }), indice = h('nav', { class: 'ayuda-indice', id: 'ayudaIndice', 'aria-label': 'Secciones de la ayuda' });
    function mostrar(id) {
      var s = d.pantallas.filter(function (x) { return x.id === id; })[0];
      Array.prototype.forEach.call(indice.children, function (b) { b.classList.toggle('activo', b.getAttribute('data-seccion') === id); });
      texto.setAttribute('data-seccion', id); texto.textContent = '';
      texto.appendChild(h('h2', { texto: s.titulo }));
      (s.texto || []).forEach(function (p) { texto.appendChild(h('p', { texto: p })); });
      (s.preguntas || []).forEach(function (q) {
        var r = h('p'); A.nodosDeTexto(q.r).forEach(function (n) { r.appendChild(n); });
        texto.appendChild(h('h3', { texto: q.p })); texto.appendChild(r);
      });
    }
    d.pantallas.forEach(function (s) {
      indice.appendChild(h('button', { type: 'button', class: 'ayuda-enlace', 'data-seccion': s.id, texto: s.titulo, onclick: function () { mostrar(s.id); } }));
    });
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverAyuda', texto: '← Volver', onclick: op.alVolver }),
        h('h2', { class: 'subtitulo', texto: 'Ayuda' }),
        h('button', { type: 'button', class: 'boton principal derecha', id: 'verGuia', texto: 'Ver la guía de primeros pasos', onclick: op.alGuia })
      ]),
      h('div', { class: 'ayuda-pagina' }, [indice, texto])
    ]);
    mostrar(actual);
  }

  g.PantallaAyuda = { abrirGuia: abrirGuia, guiaSiToca: guiaSiToca, pintarAyuda: pintarAyuda, FRASE_PRIMERO: FRASE_PRIMERO };
})(window);
