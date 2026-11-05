/* Memoria final de tutoría (fila 108): la pantalla. Se abre desde la tarjeta de «Final de curso». Arriba, «Lo que la app ya sabe del grupo» (las cifras y la tabla las calcula la app,
   no Claude), «Tus notas» (con dictado), «Redactar con Claude» y, redactada, los cinco apartados (editables, con «Copiar» y los botones de estilo) y la fecha con «Crear PDF y Word».
   Lo usa pantalla-final-curso.js. ctx: { est, tut, curso, hoy, alumnos, fuentes, todos, informes (función -> { hechos, total }), volver }. */
(function (g) {
  'use strict';
  var h = g.Dom.h, M = g.Memoria;

  function calcular(ctx) { return M.datos(ctx.fuentes, ctx.alumnos, ctx.curso, ctx.tut.grupo, ctx.informes()); }
  function claseEstado(m, d) { return { nada: 'nada', notas: 'notas', redactado: 'redactado', hecho: 'hecho' }[M.estado(m, d)]; }

  /* Las cifras como lista de «etiqueta – valor». */
  function pintarCifras(d) {
    return h('dl', { class: 'cifras-memoria', id: 'cifras' }, d.cifras.map(function (c) {
      return h('div', {}, [h('dt', { texto: c.etiqueta }), h('dd', { 'data-cifra': c.id, texto: c.valor })]);
    }));
  }
  /* La tabla «% con dificultades» de cada área en cada sesión; si el acta no existe, la casilla dice «falta». */
  function pintarTabla(d) {
    if (!d.tabla) return null;
    var cab = h('tr', {}, [h('th', { texto: '% con dificultades' })].concat(d.sesiones.map(function (s) { return h('th', { texto: s.nombre }); })));
    var filas = d.tabla.areas.map(function (a) {
      return h('tr', { 'data-area': a.nombre }, [h('td', { texto: a.nombre })].concat(a.valores.map(function (v, i) {
        return h('td', { class: v === 'falta' ? 'falta' : '', 'data-sesion': d.sesiones[i].id, texto: M.casilla(v) });
      })));
    });
    return h('div', { class: 'tabla-memoria' }, [h('table', { id: 'tablaMemoria' }, [h('thead', {}, [cab]), h('tbody', {}, filas)])]);
  }

  async function pintarMemoria(ctx) {
    var est = ctx.est, tut = ctx.tut, d = calcular(ctx);
    var m = (await M.existente(est.raiz, tut.grupo, ctx.curso)) || M.nueva(tut.grupo, ctx.curso, ctx.hoy, new Date());
    var auto = g.Autoguardado.crear(est, m, M.guardar), cambio = auto.cambio;
    var ocupado = false, avisoNombres = '', preguntando = false;
    var etiquetaEstado = h('span', { class: 'etiqueta', id: 'estadoMemoria' });
    var avisoClaude = g.Dom.aviso(), estadoRedaccion = h('span', { class: 'suave', id: 'estadoRedaccion' });
    var avisoNotas = h('div', { class: 'aviso', id: 'avisoNotas', hidden: '', texto: 'Las notas han cambiado desde que Claude redactó. Pulsa «Rehacer con Claude» si quieres que las tenga en cuenta.' });
    var avisoDatos = h('div', { class: 'aviso', id: 'avisoDatos', hidden: '', texto: 'Los datos del curso han cambiado desde que Claude redactó. Las tablas del papel ya están al día. Pulsa «Rehacer con Claude» para que el texto también lo esté.' });
    var zonaPregunta = h('div', { id: 'zonaPregunta' }), zonaTextos = h('div', { id: 'textosMemoria' }), zonaPie = h('div', { id: 'pieMemoria' });
    var boton = h('button', { type: 'button', class: 'boton principal', id: 'redactarMemoria' });

    function pintarEstado() { etiquetaEstado.textContent = M.etiqueta(m, d); etiquetaEstado.className = 'etiqueta ' + claseEstado(m, d); etiquetaEstado.setAttribute('data-estado', M.estado(m, d)); }
    function pintarAvisos() { avisoNotas.hidden = !M.notasCambiaron(m); avisoDatos.hidden = !M.datosCambiaron(m, d); }
    function alCambiar() { cambio(); pintarEstado(); pintarAvisos(); }
    function decirError(x) {
      g.Dom.decir(avisoClaude, x && x.message ? x.message : String(x));
      if (x && x.tipo === 'clave') avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    }

    /* --- lo que la app sabe --- */
    var sabe = d.hayDatos ? [pintarCifras(d), pintarTabla(d)] : [h('p', { class: 'suave', id: 'sinDatos', texto: 'De este grupo no hay nada guardado este curso.' })];
    var faltan = M.avisoFaltan(d);
    if (faltan) sabe.push(h('div', { class: 'aviso', id: 'avisoFalta', texto: faltan }));

    /* --- notas --- */
    var notas = h('textarea', { id: 'notasMemoria', rows: '7', placeholder: 'Lo que los datos no dicen: cómo ha sido el grupo, qué destacarías, qué propones para el año que viene.' });
    notas.value = m.notas || '';
    notas.oninput = function () { m.notas = notas.value; alCambiar(); };
    var accionesNotas = [];
    if (g.Dictado.disponible()) {
      var mic = h('button', { type: 'button', class: 'boton chico mic', 'data-accion': 'dictar', title: 'Dictar', texto: '🎤 Dictar' });
      var dic = g.Dictado.crear(notas, function (txt) { m.notas = txt; alCambiar(); }, function (activo) { mic.classList.toggle('grabando', activo); mic.textContent = activo ? '⏹ Parar' : '🎤 Dictar'; });
      mic.onclick = function () { dic.alternar(); };
      accionesNotas.push(mic);
    }

    /* --- redactar --- */
    async function redactar() {
      preguntando = false; pintarPregunta();
      ocupado = true; g.Dom.decir(avisoClaude, ''); estadoRedaccion.textContent = 'Claude está redactando…'; repintar();
      try {
        avisoNombres = await g.MemoriaClaude.redactarMemoria(est.raiz, m, d, ctx.todos);
        alCambiar();
      } catch (x) { decirError(x); }
      finally { ocupado = false; estadoRedaccion.textContent = ''; repintar(); }
    }
    function pintarPregunta() {
      zonaPregunta.textContent = '';
      if (!preguntando) return;
      zonaPregunta.appendChild(h('div', { class: 'aviso', id: 'pregunta' }, [
        'Has cambiado textos a mano. ¿Sustituirlos? ',
        h('button', { type: 'button', class: 'boton chico principal', id: 'sustituir', texto: 'Sustituir', onclick: redactar }), ' ',
        h('button', { type: 'button', class: 'boton chico', id: 'dejar', texto: 'Dejar lo que hay', onclick: function () { preguntando = false; pintarPregunta(); } })
      ]));
    }
    boton.onclick = function () {
      var pr = M.problema(m, d);
      if (pr) { g.Dom.decir(avisoClaude, pr); return; }
      if (M.hayTextos(m) && m.editado) { preguntando = true; pintarPregunta(); return; }
      redactar();
    };

    function barraRetoque(a) {
      return g.PantallaRetoque.barra({
        est: est, id: 'memoria-' + a.id, almacen: m, clave: a.id, ocupado: ocupado, todos: function () { return ctx.todos; },
        leer: function () { return M.texto(m, a.id); }, escribir: function (txt, aviso) { m.textos[a.id] = txt; avisoNombres = aviso || ''; },
        ocupar: function (si) { ocupado = si; if (si) g.Dom.decir(avisoClaude, ''); estadoRedaccion.textContent = si ? 'Claude está cambiando el texto…' : ''; repintar(); },
        alCambiar: function () { alCambiar(); repintar(); }, error: decirError
      });
    }

    /* --- fecha y ficheros --- */
    function pintarPie() {
      zonaPie.textContent = '';
      var fecha = h('input', { type: 'date', id: 'fechaMemoria', value: m.fecha });
      fecha.onchange = function () { if (fecha.value) { m.fecha = fecha.value; alCambiar(); pintarPie(); } };
      var hecho = M.creado(m, d), dicho = g.Dom.aviso();
      var crearBoton = h('button', { type: 'button', class: 'boton principal', id: 'crearMemoria', texto: hecho ? 'Volver a crear PDF y Word' : 'Crear PDF y Word', onclick: async function () {
        try { g.fechaCorta(m.fecha); } catch (x) { g.Dom.decir(dicho, 'La fecha de la memoria no es válida.'); return; }
        crearBoton.disabled = true; g.Dom.decir(dicho, '');
        try {
          if (await g.PantallaColegio.avisoSiFalta(est, dicho)) { crearBoton.disabled = false; return; }
          await g.MemoriaDocs.crear(est.raiz, m, d, est.ficha, tut, new Date()); pintarEstado(); pintarPie();
        } catch (x) { crearBoton.disabled = false; g.Dom.decir(dicho, 'No he podido crear los ficheros: ' + ((x && x.message) || x)); }
      } });
      crearBoton.disabled = ocupado;
      var acciones = [h('label', { class: 'campo' }, ['Fecha de la memoria', fecha]), crearBoton];
      if (hecho) {
        [['pdf', 'Abrir PDF'], ['docx', 'Abrir Word']].forEach(function (x) {
          acciones.push(h('button', { type: 'button', class: 'boton', 'data-accion': 'abrir-' + x[0], texto: x[1], onclick: async function () {
            if ((await g.Envios.abrir(est.raiz, m, x[0])) === 'falta') g.Dom.decir(dicho, 'No encuentro el fichero en la carpeta ACTAS.');
          } }));
        });
      }
      zonaPie.appendChild(h('div', { class: 'fila fin' }, acciones));
      zonaPie.appendChild(dicho);
      if (hecho) zonaPie.appendChild(h('div', { class: 'aviso ok', id: 'guardadoMemoria', texto: 'Guardado en ' + g.Envios.carpetaTexto(m.documentos.pdf) + ': «' + m.documentos.base + '» (PDF y Word). También sale en Mis papeles.' }));
    }

    /* --- los textos --- */
    function repintar() {
      boton.textContent = M.hayTextos(m) ? 'Rehacer con Claude' : 'Redactar con Claude'; boton.disabled = ocupado;
      pintarAvisos(); pintarEstado();
      zonaTextos.textContent = '';
      if (!M.hayTextos(m)) { zonaPie.textContent = ''; return; }
      if (avisoNombres) zonaTextos.appendChild(h('div', { class: 'aviso', 'data-aviso-nombres': '1', texto: avisoNombres }));
      var cajas = M.APARTADOS.map(function (a) {
        var area = h('textarea', { rows: '6', 'data-texto': a.id, placeholder: '(vacío)' });
        area.value = M.texto(m, a.id); area.readOnly = ocupado;
        var dicho = h('span', { class: 'suave', 'data-copiado': a.id, 'aria-live': 'polite' });
        var copiar = h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'copiar', 'data-copiar': a.id, texto: 'Copiar', onclick: async function () {
          dicho.textContent = (await g.PantallaEntrevista.copiarTexto(area.value, true)) ? 'Copiado' : 'No he podido copiar';
        } });
        area.oninput = function () { m.textos[a.id] = area.value; m.editado = true; dicho.textContent = ''; alCambiar(); pintarPie(); };
        var partes = [h('div', { class: 'cabeza-hueco' }, [h('strong', { texto: a.titulo }), h('span', { class: 'fila' }, [dicho, copiar])]), area];
        if (M.texto(m, a.id).trim()) partes.push(barraRetoque(a));
        return h('div', { class: 'texto-seneca', 'data-apartado': a.id }, partes);
      });
      zonaTextos.appendChild(h('div', { class: 'tarjeta ancha', id: 'textoMemoria' }, [h('h3', { texto: 'Texto de la memoria' }), h('div', { class: 'apartados-final' }, cajas)]));
      pintarPie();
    }

    var cabecera = h('div', { class: 'barra-form' }, [
      h('button', { type: 'button', class: 'boton', id: 'volverFinal', texto: '← Volver a Final de curso', onclick: async function () { if (est.alSalir) await est.alSalir(); ctx.volver(); } }),
      h('h2', { class: 'subtitulo', texto: M.NOMBRE }), h('span', { class: 'suave', id: 'grupoMemoria', texto: tut.grupo + ' · curso ' + ctx.curso }), etiquetaEstado
    ]);
    g.Dom.montar([
      cabecera,
      h('div', { class: 'mesa-memoria' }, [
        h('section', { class: 'tarjeta' }, [h('h3', { texto: 'Lo que la app ya sabe del grupo' })].concat(sabe.filter(Boolean))),
        h('section', { class: 'tarjeta', 'data-caja': 'memoria' }, [h('label', { for: 'notasMemoria', style: 'font-weight:600', texto: 'Tus notas' }), notas, h('span', { class: 'suave', id: 'avisoNombresNotas', texto: 'No escribas nombres de personas: a Claude solo le tapo los de tu alumnado.' }), h('div', { class: 'fila' }, accionesNotas)])
      ]),
      h('section', { class: 'tarjeta' }, [
        avisoNotas, avisoDatos, zonaPregunta, avisoClaude, estadoRedaccion,
        h('div', { class: 'fila' }, [boton, h('span', { class: 'suave', texto: 'Gasta una redacción. A Claude no le llega ningún nombre, y el texto habla del grupo, no de cada alumno.' })])
      ]),
      zonaTextos, zonaPie
    ]);
    repintar();
  }

  g.PantallaMemoria = { pintarMemoria: pintarMemoria, calcular: calcular };
})(window);
