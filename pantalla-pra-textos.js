/* Lo que Claude redacta del PRA (fila 75): por cada área marcada, las cinco casillas de Séneca, cada una editable, con «Copiar» y con los botones de estilo
   de la fila 64; «Redactar con Claude» (solo las áreas que faltan) y «Rehacer esta área». Lo usa pantalla-pra.js. */
(function (g) {
  'use strict';
  var h = g.Dom.h, P = g.Pra;

  /* ctx: { cambio, todos }. Devuelve { nodo, repintar, notasCambiaron }. */
  function crear(est, p, ctx) {
    var cambio = ctx.cambio, ocupado = false, preguntando = false, avisoNombres = '';
    var avisoClaude = g.Dom.aviso(), estado = h('span', { class: 'suave', id: 'estadoRedaccion' });
    var avisoNotas = h('div', { class: 'aviso', id: 'avisoNotasCambiadas', hidden: '', texto: 'Las notas han cambiado desde que Claude redactó los textos.' });
    var zonaAcciones = h('div', { class: 'fila', id: 'accionesRedaccion' }), zonaPregunta = h('div', { id: 'preguntaRedaccion' }), zonaAreas = h('div', { id: 'textosPra' });

    function decirError(x) {
      g.Dom.decir(avisoClaude, x && x.message ? x.message : String(x));
      if (x && x.tipo === 'clave') avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    }

    async function redactar(nombres) {
      preguntando = false; ocupado = true; g.Dom.decir(avisoClaude, ''); estado.textContent = 'Claude está redactando…'; repintar();
      try {
        var clave = await g.Claude.claveDe(est.raiz);
        var res = await g.PraClaude.redactar(clave, p, ctx.todos, nombres, { estilo: await g.Estilo.paraClaude(est.raiz, ctx.todos) });
        res.areas.forEach(function (a) { P.ponerCasillas(p, a.nombre, a.casillas); });
        p.notasRedactadas = P.firmaNotas(p); avisoNombres = res.aviso || '';
        cambio();
      } catch (x) { decirError(x); }
      finally { ocupado = false; estado.textContent = ''; repintar(); }
    }
    /* «Redactar con Claude»: solo las áreas que faltan. Si las notas cambiaron desde la última vez, antes se pregunta si se rehacen todas. */
    function pedir() {
      var pr = P.problema(p);
      if (pr) { g.Dom.decir(avisoClaude, pr); return; }
      if (P.notasCambiaron(p)) { preguntando = true; repintar(); return; }
      var faltan = P.faltan(p).map(function (a) { return a.nombre; });
      if (!faltan.length) { g.Dom.decir(avisoClaude, 'Todas las áreas marcadas ya están redactadas. Para rehacer una, pulsa «Rehacer esta área».'); return; }
      redactar(faltan);
    }
    function notasCambiaron() {
      Array.prototype.forEach.call(zonaAcciones.querySelectorAll('button'), function (b) { b.disabled = ocupado; });
      avisoNotas.hidden = !P.notasCambiaron(p);
    }

    function barraRetoque(a, i) {
      return g.PantallaRetoque.barra({
        est: est, id: a.nombre + '-' + (i + 1), almacen: a, clave: String(i), ocupado: ocupado, limite: g.Retoque.LIMITE_SENECA, todos: function () { return ctx.todos; },
        leer: function () { return a.casillas[i] || ''; }, escribir: function (t, aviso) { a.casillas[i] = t; avisoNombres = aviso || ''; },
        ocupar: function (si) { ocupado = si; if (si) g.Dom.decir(avisoClaude, ''); estado.textContent = si ? 'Claude está cambiando el texto…' : ''; repintar(); },
        alCambiar: function () { cambio(); repintar(); }, error: decirError
      });
    }

    function pintarArea(a) {
      var rehacer = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'rehacer-area', 'data-area': a.nombre, texto: 'Rehacer esta área', onclick: function () { redactar([a.nombre]); } });
      rehacer.disabled = ocupado;
      var partes = [h('div', { class: 'cabeza-hueco' }, [h('h3', { texto: a.nombre }), rehacer])];
      if (!P.hayTextos(a)) { partes.push(h('p', { class: 'suave', texto: 'Aún sin redactar. Pulsa «Redactar con Claude».' })); return h('div', { class: 'texto-seneca', 'data-pra-area': a.nombre }, partes); }
      P.CASILLAS.forEach(function (titulo, i) {
        var area = h('textarea', { rows: '6', 'data-texto': a.nombre + '-' + (i + 1), placeholder: '(vacía)' });
        area.value = a.casillas[i] || ''; area.readOnly = ocupado;
        var dicho = h('span', { class: 'suave', 'data-copiado': a.nombre + '-' + (i + 1), 'aria-live': 'polite' });
        var copiar = h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'copiar', 'data-copiar': a.nombre + '-' + (i + 1), texto: 'Copiar', onclick: async function () {
          dicho.textContent = (await g.PantallaEntrevista.copiarTexto(area.value, true)) ? 'Copiado' : 'No he podido copiar';
        } });
        area.oninput = function () { a.casillas[i] = area.value; dicho.textContent = ''; cambio(); };
        var casilla = [h('div', { class: 'cabeza-hueco' }, [h('strong', { texto: (i + 1) + '. ' + titulo }), h('span', { class: 'fila' }, [dicho, copiar])]), area];
        if (String(a.casillas[i] || '').trim()) casilla.push(barraRetoque(a, i));
        partes.push(h('div', { class: 'texto-seneca', 'data-casilla': String(i + 1) }, casilla));
      });
      return h('div', { class: 'texto-seneca', 'data-pra-area': a.nombre }, partes);
    }

    function repintar() {
      zonaAcciones.textContent = ''; zonaPregunta.textContent = ''; zonaAreas.textContent = '';
      var principal = h('button', { type: 'button', class: 'boton principal', id: 'redactarPra', texto: 'Redactar con Claude', onclick: pedir });
      zonaAcciones.appendChild(principal);
      if (preguntando) {
        zonaPregunta.appendChild(h('div', { class: 'aviso pregunta', id: 'preguntaRehacer' }, [
          h('span', { texto: '¿Rehago todas las áreas? Se perderán los cambios que hayas hecho a mano. ' }),
          h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'si-rehacer', texto: 'Sí, rehacer', onclick: function () { redactar(P.marcadas(p).map(function (a) { return a.nombre; })); } }),
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'no-rehacer', texto: 'No', onclick: function () { preguntando = false; repintar(); } })
        ]));
      }
      if (avisoNombres && P.hayRedactadas(p)) zonaAreas.appendChild(h('div', { class: 'aviso', 'data-aviso-nombres': '1', texto: avisoNombres }));
      P.marcadas(p).forEach(function (a) { zonaAreas.appendChild(pintarArea(a)); });
      if (!P.marcadas(p).length) zonaAreas.appendChild(h('p', { class: 'suave', id: 'sinAreasPra', texto: 'Marca arriba las áreas del PRA y aquí saldrán sus cinco casillas.' }));
      notasCambiaron();
    }

    var nodo = h('section', { class: 'tarjeta ancha', id: 'redaccionPra' }, [
      h('h3', { texto: 'Las casillas de Séneca' }, [g.Ayuda.aviso('pra-claude')]), estado, zonaAcciones, zonaPregunta, avisoNotas, avisoClaude, zonaAreas
    ]);
    repintar();
    return { nodo: nodo, repintar: repintar, notasCambiaron: notasCambiaron };
  }

  g.PantallaPraTextos = { crear: crear };
})(window);
