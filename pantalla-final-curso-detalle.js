/* Informes de final de curso (fila 101): el detalle de un alumno. «Lo que la app ya sabe», «Tus notas» (con dictado), «Redactar con Claude», los textos de cada apartado
   (editables, con «Copiar» y los botones de estilo) y, debajo, la fecha y «Crear PDF y Word». Lo usa pantalla-final-curso.js. */
(function (g) {
  'use strict';
  var h = g.Dom.h, F = g.FinalCurso;

  /* ctx: { est, f (el informe, guardado o no), sabe ([{ linea, texto }]), todos (alumnado de Rúbricas o []), tut, cambio (guarda), alCambiar (avisa a la lista) }. Devuelve { nodo }. */
  function crear(ctx) {
    var est = ctx.est, f = ctx.f, t = F.tipo(f), cambio = ctx.cambio, ocupado = false, avisoNombres = '';
    var avisoClaude = g.Dom.aviso(), estado = h('span', { class: 'suave', id: 'estadoRedaccion' });
    var avisoNotas = h('div', { class: 'aviso', id: 'avisoNotasCambiadas', hidden: '', texto: 'Las notas han cambiado desde que Claude redactó. Pulsa «Rehacer con Claude» si quieres que las tenga en cuenta.' });
    var zonaTextos = h('div', { id: 'textosFinal' }), zonaPie = h('div', { id: 'pieFinal' });
    var boton = h('button', { type: 'button', class: 'boton principal', id: 'redactarFinal' });

    function decirError(x) {
      g.Dom.decir(avisoClaude, x && x.message ? x.message : String(x));
      if (x && x.tipo === 'clave') avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    }
    function alCambiar() { cambio(); ctx.alCambiar(); avisoNotas.hidden = !F.notasCambiaron(f); }

    /* --- notas --- */
    var ed = g.EditorNotas.crear('final', f.notas || '', function () { return est.alumnado; }, function (txt) { f.notas = txt; alCambiar(); });
    var mas = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-alumno', texto: '+ Alumno', onclick: function () { ed.abrirBuscador(); } });
    mas.disabled = !(est.alumnado && est.alumnado.estado === 'ok');
    var pie = [mas];
    if (g.Dictado.disponible()) {
      var mic = h('button', { type: 'button', class: 'boton chico mic', 'data-accion': 'dictar', title: 'Dictar', texto: '🎤 Dictar' });
      var d = g.Dictado.crear(ed.comoCaja, function (txt) { f.notas = txt; alCambiar(); }, function (activo) { mic.classList.toggle('grabando', activo); mic.textContent = activo ? '⏹ Parar' : '🎤 Dictar'; });
      mic.onclick = function () { d.alternar(); };
      pie.push(mic);
    }
    var sabe = ctx.sabe.length ? h('ul', { class: 'sabe-final', id: 'sabeFinal' }, ctx.sabe.map(function (s) { return h('li', { texto: s.linea }); }))
      : h('p', { class: 'suave', id: 'sinDatosFinal', texto: 'De este alumno no hay nada guardado este curso.' });

    /* --- redactar --- */
    async function redactar() {
      var pr = F.problema(f, ctx.sabe);
      if (pr) { g.Dom.decir(avisoClaude, pr); return; }
      ocupado = true; g.Dom.decir(avisoClaude, ''); estado.textContent = 'Claude está redactando…'; repintar();
      try {
        avisoNombres = await g.FinalCursoClaude.redactarInforme(est.raiz, f, ctx.sabe, ctx.todos);
        alCambiar();
      } catch (x) { decirError(x); }
      finally { ocupado = false; estado.textContent = ''; repintar(); }
    }
    boton.onclick = redactar;

    function barraRetoque(a) {
      return g.PantallaRetoque.barra({
        est: est, id: 'final-' + a.id, almacen: f, clave: a.id, ocupado: ocupado, todos: function () { return ctx.todos; },
        leer: function () { return F.texto(f, a.id); }, escribir: function (txt, aviso) { f.textos[a.id] = txt; avisoNombres = aviso || ''; },
        ocupar: function (si) { ocupado = si; if (si) g.Dom.decir(avisoClaude, ''); estado.textContent = si ? 'Claude está cambiando el texto…' : ''; repintar(); },
        alCambiar: function () { alCambiar(); repintar(); }, error: decirError
      });
    }

    /* --- fecha y ficheros --- */
    function pintarPie() {
      zonaPie.textContent = '';
      var fecha = h('input', { type: 'date', id: 'fechaInforme', value: f.fecha });
      fecha.onchange = function () { if (fecha.value) { f.fecha = fecha.value; alCambiar(); pintarPie(); } };
      var hecho = F.creado(f), dicho = g.Dom.aviso();
      var crearBoton = h('button', { type: 'button', class: 'boton principal', id: 'crearFinal', texto: hecho ? 'Volver a crear PDF y Word' : 'Crear PDF y Word', onclick: async function () {
        try { g.fechaCorta(f.fecha); } catch (x) { g.Dom.decir(dicho, 'La fecha del informe no es válida.'); return; }
        crearBoton.disabled = true; g.Dom.decir(dicho, '');
        try { await g.FinalCursoDocs.crear(est.raiz, f, est.ficha, ctx.tut, new Date()); ctx.alCambiar(); pintarPie(); }
        catch (x) { crearBoton.disabled = false; g.Dom.decir(dicho, 'No he podido crear los ficheros: ' + ((x && x.message) || x)); }
      } });
      crearBoton.disabled = ocupado;
      var acciones = [h('label', { class: 'campo' }, ['Fecha del informe', fecha]), crearBoton];
      if (hecho) {
        [['pdf', 'Abrir PDF'], ['docx', 'Abrir Word']].forEach(function (x) {
          acciones.push(h('button', { type: 'button', class: 'boton', 'data-accion': 'abrir-' + x[0], texto: x[1], onclick: async function () {
            if ((await g.Envios.abrir(est.raiz, f, x[0])) === 'falta') g.Dom.decir(dicho, 'No encuentro el fichero en la carpeta ACTAS.');
          } }));
        });
      }
      zonaPie.appendChild(h('div', { class: 'fila fin' }, acciones));
      zonaPie.appendChild(dicho);
      if (hecho) zonaPie.appendChild(h('div', { class: 'aviso ok', id: 'guardadoFinal', texto: 'Guardado en ' + g.Envios.carpetaTexto(f.documentos.pdf) + ': «' + f.documentos.base + '» (PDF y Word). También sale en Mis papeles.' }));
    }

    /* --- los textos --- */
    function repintar() {
      boton.textContent = F.hayTextos(f) ? 'Rehacer con Claude' : 'Redactar con Claude'; boton.disabled = ocupado;
      avisoNotas.hidden = !F.notasCambiaron(f);
      zonaTextos.textContent = '';
      if (!F.hayTextos(f)) { zonaPie.textContent = ''; return; }
      if (avisoNombres) zonaTextos.appendChild(h('div', { class: 'aviso', 'data-aviso-nombres': '1', texto: avisoNombres }));
      var cajas = t.apartados.map(function (a) {
        var area = h('textarea', { rows: '6', 'data-texto': a.id, placeholder: '(vacío)' });
        area.value = F.texto(f, a.id); area.readOnly = ocupado;
        var dicho = h('span', { class: 'suave', 'data-copiado': a.id, 'aria-live': 'polite' });
        var copiar = h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'copiar', 'data-copiar': a.id, texto: 'Copiar', onclick: async function () {
          dicho.textContent = (await g.PantallaEntrevista.copiarTexto(area.value, true)) ? 'Copiado' : 'No he podido copiar';
        } });
        area.oninput = function () { f.textos[a.id] = area.value; dicho.textContent = ''; alCambiar(); pintarPie(); };
        var partes = [h('div', { class: 'cabeza-hueco' }, [h('strong', { texto: a.titulo }), h('span', { class: 'fila' }, [dicho, copiar])]), area];
        if (F.texto(f, a.id).trim()) partes.push(barraRetoque(a));
        return h('div', { class: 'texto-seneca', 'data-apartado': a.id }, partes);
      });
      zonaTextos.appendChild(h('div', { class: 'tarjeta ancha', id: 'informeFinal' }, [h('h3', { texto: 'Texto del informe' }), h('div', { class: 'apartados-final' }, cajas)]));
      pintarPie();
    }

    var nodo = h('div', { class: 'detalle-final', id: 'detalleFinal', 'data-alumno': f.alumno.nombre }, [
      h('section', { class: 'tarjeta ancha' }, [
        h('div', { class: 'cabeza-hueco' }, [h('h3', { 'data-final': 'nombre', texto: f.alumno.nombre }), h('span', { class: 'suave', texto: t.nota })]),
        h('div', { class: 'dos-col' }, [
          h('div', {}, [h('strong', { texto: 'Lo que la app ya sabe' }), sabe]),
          h('div', { class: 'caja-ayudas', 'data-caja': 'final' }, [h('strong', { texto: 'Tus notas' }), h('span', { class: 'suave', texto: 'Unas líneas: qué destacarías de este alumno o alumna.' }), ed.elemento, h('div', { class: 'pie-punto' }, pie)])
        ]),
        avisoNotas, avisoClaude, estado,
        h('div', { class: 'fila' }, [boton, h('span', { class: 'suave', texto: 'A Claude solo van iniciales. El texto lo revisas tú.' })])
      ]),
      zonaTextos, zonaPie
    ]);
    repintar();
    return { nodo: nodo };
  }

  g.PantallaFinalCursoDetalle = { crear: crear };
})(window);
