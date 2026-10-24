/* El bloque de redacción de la petición a orientación (fila 76), igual para los dos papeles (acta y solicitud): «Redactar con Claude», el texto editable con los
   botones de estilo de la fila 64, el botón de crear los ficheros y, una vez creados, «Abrir PDF» y «Abrir Word». Lo usan pantalla-peticion.js y
   pantalla-peticion-solicitud.js.
   c: { id ('acta'|'solicitud'), titulo, almacen (el objeto que guarda el texto y las versiones), campo (dónde está el texto), firma() (las notas ahora), vieja() (las notas
        cuando se redactó), marcarRedactado(), todos, cambio(), redactar(clave, opciones) -> { texto, aviso }, problemaCrear(), crear() (async), etiquetaCrear, textoCreado(documentos) }.
   Devuelve { nodo, notasCambiaron }. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  function crear(est, c) {
    var ocupado = false, avisoNombres = '', creado = c.almacen.documentos || null;
    var avisoClaude = g.Dom.aviso(), avisoCrear = g.Dom.aviso(), estado = h('span', { class: 'suave', id: 'estadoRedaccion-' + c.id });
    var avisoNotas = h('div', { class: 'aviso', id: 'avisoNotasCambiadas-' + c.id, hidden: '', texto: 'Las notas han cambiado desde que Claude redactó el texto.' });
    var zonaAcciones = h('div', { class: 'fila' }), zonaTexto = h('div', { id: 'texto-' + c.id }), zonaFin = h('div', { class: 'zona-crear', id: 'zonaFin-' + c.id });

    function decirError(x) {
      g.Dom.decir(avisoClaude, x && x.message ? x.message : String(x));
      if (x && x.tipo === 'clave') avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    }
    function hayTexto() { return !!String(c.almacen[c.campo] || '').trim(); }
    function notasCambiaron() {
      Array.prototype.forEach.call(zonaAcciones.querySelectorAll('button'), function (b) { b.disabled = ocupado; });
      avisoNotas.hidden = !(hayTexto() && c.firma() !== (c.almacen.notasRedactadas || ''));
    }

    async function redactar() {
      ocupado = true; g.Dom.decir(avisoClaude, ''); estado.textContent = 'Claude está redactando…'; repintar();
      try {
        var clave = await g.Claude.claveDe(est.raiz);
        var res = await c.redactar(clave, { estilo: await g.Estilo.paraClaude(est.raiz, c.todos) });
        g.Retoque.cambiar(c.almacen, 'texto', c.almacen[c.campo] || '', res.texto);
        c.almacen[c.campo] = res.texto; c.almacen.notasRedactadas = c.firma(); avisoNombres = res.aviso || ''; creado = null;
        c.cambio();
      } catch (x) { decirError(x); }
      finally { ocupado = false; estado.textContent = ''; repintar(); }
    }
    function pedir() {
      var pr = c.problemaRedactar();
      if (pr) { g.Dom.decir(avisoClaude, pr); return; }
      redactar();
    }

    function repintar() {
      zonaAcciones.textContent = ''; zonaTexto.textContent = '';
      zonaAcciones.appendChild(h('button', { type: 'button', class: 'boton principal', id: 'redactar-' + c.id, texto: hayTexto() ? 'Redactar de nuevo' : 'Redactar con Claude', onclick: pedir }));
      if (hayTexto()) {
        if (avisoNombres) zonaTexto.appendChild(h('div', { class: 'aviso', 'data-aviso-nombres': '1', texto: avisoNombres }));
        var area = h('textarea', { rows: '14', 'data-texto': c.id, placeholder: '(vacío)' });
        area.value = c.almacen[c.campo] || ''; area.readOnly = ocupado;
        area.oninput = function () { c.almacen[c.campo] = area.value; creado = null; c.cambio(); pintarFin(); notasCambiaron(); };
        zonaTexto.appendChild(h('div', { class: 'texto-seneca' }, [h('strong', { texto: c.titulo }), area, g.PantallaRetoque.barra({
          est: est, id: c.id, almacen: c.almacen, clave: 'texto', ocupado: ocupado, todos: function () { return c.todos; },
          leer: function () { return c.almacen[c.campo] || ''; }, escribir: function (t, aviso) { c.almacen[c.campo] = t; avisoNombres = aviso || ''; },
          ocupar: function (si) { ocupado = si; if (si) g.Dom.decir(avisoClaude, ''); estado.textContent = si ? 'Claude está cambiando el texto…' : ''; repintar(); },
          alCambiar: function () { creado = null; c.cambio(); repintar(); }, error: decirError
        })]));
      }
      pintarFin(); notasCambiaron();
    }

    function pintarFin() {
      zonaFin.textContent = '';
      if (!hayTexto()) return;
      if (creado) {
        var aviso = g.Dom.aviso();
        zonaFin.appendChild(h('div', { class: 'aviso ok', id: 'creado-' + c.id }, [h('span', { texto: c.textoCreado(creado) })]));
        zonaFin.appendChild(h('div', { class: 'fila' }, ['pdf', 'docx'].map(function (t) {
          return h('button', { type: 'button', class: 'boton principal', 'data-accion': 'abrir-' + t, 'data-de': c.id, texto: t === 'pdf' ? 'Abrir PDF' : 'Abrir Word', onclick: async function () {
            g.Dom.decir(aviso, (await g.Envios.abrir(est.raiz, c.almacen, t)) === 'falta' ? 'No encuentro el fichero en la carpeta ACTAS.' : '');
          } });
        })));
        zonaFin.appendChild(aviso);
        return;
      }
      zonaFin.appendChild(h('button', { type: 'button', class: 'boton principal grande', id: 'crear-' + c.id, texto: c.etiquetaCrear, onclick: crearFicheros }));
      zonaFin.appendChild(avisoCrear);
    }
    async function crearFicheros() {
      g.Dom.decir(avisoCrear, '');
      var pr = c.problemaCrear();
      if (pr) { g.Dom.decir(avisoCrear, pr); return; }
      if (await g.PantallaColegio.avisoSiFalta(est, avisoCrear)) return;
      try { await est.alSalir(); await c.crear(); } catch (x) { g.Dom.decir(avisoCrear, 'No he podido crear los ficheros: ' + (x && x.message ? x.message : x)); return; }
      creado = c.almacen.documentos; if (c.alCrear) c.alCrear(); pintarFin();
    }

    var nodo = h('section', { class: 'tarjeta ancha', id: 'redaccion-' + c.id }, [h('h3', { texto: c.titulo }), estado, zonaAcciones, avisoNotas, avisoClaude, zonaTexto, zonaFin]);
    repintar();
    return { nodo: nodo, notasCambiaron: notasCambiaron };
  }

  /* Una caja de notas con dictado y «+ Alumno» (el alumnado elegido de la lista viaja a Claude solo con iniciales). `alCambiar(texto)` recibe el texto nuevo. */
  function cajaNotas(est, id, titulo, ayuda, valor, alCambiar) {
    var ed = g.EditorNotas.crear('pet-' + id, valor || '', function () { return est.alumnado; }, alCambiar);
    var mas = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-alumno', texto: '+ Alumno', onclick: function () { ed.abrirBuscador(); } });
    mas.disabled = !(est.alumnado && est.alumnado.estado === 'ok');
    var pie = [h('span', { class: 'suave', texto: 'Nunca un nombre suelto sin elegirlo de la lista.' }), mas];
    if (g.Dictado.disponible()) {
      var mic = h('button', { type: 'button', class: 'boton chico mic', 'data-accion': 'dictar', title: 'Dictar', texto: '🎤 Dictar' });
      var d = g.Dictado.crear(ed.comoCaja, alCambiar, function (activo) { mic.classList.toggle('grabando', activo); mic.textContent = activo ? '⏹ Parar' : '🎤 Dictar'; });
      mic.onclick = function () { d.alternar(); };
      pie.push(mic);
    }
    return h('div', { class: 'caja-ayudas', 'data-caja': id }, [h('strong', { texto: titulo }), ayuda ? h('span', { class: 'suave', texto: ayuda }) : null, ed.elemento, h('div', { class: 'pie-punto' }, pie)]);
  }

  g.PantallaPeticionTexto = { crear: crear, cajaNotas: cajaNotas };
})(window);
