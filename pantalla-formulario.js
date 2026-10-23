/* Formulario del acta de ciclo: datos de la reunión, asistentes y puntos con sus notas. Todo cambio se guarda solo en el borrador. */
(function (g) {
  'use strict';
  var h = g.Dom.h, B = g.Borradores;

  function campo(etiqueta, control) { return h('label', { class: 'campo' }, [etiqueta, control]); }

  function pintarFormulario(est, b, volver, redactar) {
    var ficha = est.ficha;
    var manual = B.evaluacionEsManual(b);
    var auto = g.Autoguardado.crear(est, b), cambio = auto.cambio;

    /* Datos de la reunión */
    var fecha = h('input', { type: 'date', id: 'campoFecha', value: b.fecha });
    var inicio = h('input', { type: 'time', id: 'campoInicio', value: b.inicio });
    var fin = h('input', { type: 'time', id: 'campoFin', value: b.fin });
    var evalu = h('select', { id: 'campoEvaluacion' }, ['PRIMERA', 'SEGUNDA', 'TERCERA'].map(function (e) {
      var o = h('option', { value: e, texto: e.charAt(0) + e.slice(1).toLowerCase() }); if (e === b.evaluacion) o.selected = true; return o;
    }));
    fecha.onchange = function () { if (fecha.value) { B.ponerFecha(b, fecha.value, manual); evalu.value = b.evaluacion; cambio(); } };
    inicio.onchange = function () { b.inicio = inicio.value; cambio(); };
    fin.onchange = function () { b.fin = fin.value; cambio(); };
    evalu.onchange = function () { b.evaluacion = evalu.value; manual = B.evaluacionEsManual(b); cambio(); };

    /* Asistentes */
    var asistentes;
    if (ficha && ficha.profesorado && ficha.profesorado.length) {
      asistentes = h('div', { class: 'asistentes', id: 'asistentes' }, ficha.profesorado.map(function (linea) {
        var c = h('input', { type: 'checkbox' }); c.checked = b.asistentes.indexOf(linea) >= 0;
        c.onchange = function () { B.marcarAsistente(b, linea, c.checked); B.ordenarAsistentes(b, ficha); cambio(); };
        return h('label', { class: 'asistente' }, [c, linea]);
      }));
    } else {
      var area = h('textarea', { id: 'asistentesTexto', rows: '4', placeholder: 'Un nombre por línea: cargo: nombre' }); area.value = b.asistentes.join('\n');
      area.oninput = function () { b.asistentes = area.value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean); cambio(); };
      asistentes = h('div', {}, [
        h('div', { class: 'aviso', id: 'avisoSinFicha', texto: 'Rellena «Datos del curso» en Ajustes una vez (o abre el documento de actas y entra en Actas › Datos del curso).' }), area]);
    }

    /* Puntos */
    var contenedor = h('div', { class: 'puntos', id: 'puntos' });
    var alumnadoVisto = [], avisoAlumnado = h('div', { class: 'aviso', id: 'avisoAlumnado', hidden: '' }), avisoResumenes = h('div', { class: 'aviso ok', id: 'avisoResumenes', hidden: '' });
    /* Lo que depende de la lista de alumnado (se carga aparte): el aviso de arriba, el recordatorio y el botón «+ Alumno» de cada punto. */
    function pintarAlumnado() {
      /* Con la lista de grupos de Rúbricas, las sesiones de evaluación sacan un bloque por grupo (una sola vez en cada punto). */
      if (est.alumnado && est.alumnado.lista && g.Huecos.completarGrupos(b, est.alumnado.lista.grupos)) { cambio(); pintarPuntos(); traerResumenes(); return; }
      var a = est.alumnado, ok = !!(a && a.estado === 'ok'), cargando = !a;
      alumnadoVisto.forEach(function (x) {
        x.recordatorio.textContent = ok || cargando ? 'Alumnado: escríbelo y elígelo de la lista, o usa + Alumno' : 'Sin lista de alumnado: abre la carpeta RÚBRICAS';
        x.masAlumno.disabled = !ok;
      });
      avisoAlumnado.textContent = '';
      var texto = '', boton = 'Abrir la carpeta RÚBRICAS', permiso = false;
      if (!a) { avisoAlumnado.hidden = true; return; }
      if (a.estado === 'sinCarpeta') texto = a.texto || 'Para elegir alumnado de la lista, abre una vez la carpeta RÚBRICAS (Mi unidad › RÚBRICAS). Solo la leo: no escribo nada en ella.';
      else if (a.estado === 'sinPermiso') { texto = 'Chrome pide confirmar el permiso sobre la carpeta RÚBRICAS.'; boton = 'Dar permiso'; permiso = true; }
      else if (a.estado === 'vacia') texto = 'En la carpeta RÚBRICAS no hay alumnado de este ciclo todavía.';
      else if (a.estado === 'error') texto = a.texto;
      avisoAlumnado.hidden = !texto;
      if (!texto) return;
      avisoAlumnado.appendChild(h('span', { id: 'textoAvisoAlumnado', texto: texto + ' ' }));
      var infoRub = g.Ayuda.aviso('carpeta-rubricas');
      avisoAlumnado.appendChild(h('button', { type: 'button', class: 'boton chico principal', id: 'abrirRubricas', texto: boton, onclick: async function () {
        var mal = permiso ? (await g.Rubricas.darPermiso(est), '') : await g.Rubricas.abrir(est);
        pintarAlumnado();
        if (mal) { avisoAlumnado.hidden = false; avisoAlumnado.appendChild(h('div', { class: 'aviso error', id: 'errorRubricas', texto: mal })); }
      } }));
      if (infoRub) avisoAlumnado.appendChild(infoRub);
    }
    function pintarPuntos() {
      contenedor.textContent = ''; alumnadoVisto = [];
      b.puntos.forEach(function (p, i) { contenedor.appendChild(tarjetaPunto(p, i)); });
      pintarAlumnado();
    }
    function tarjetaPunto(p, i) {
      var fijo = B.esPuntoAnterior(p.titulo);
      var titulo = h('input', { type: 'text', class: 'titulo-punto', 'data-punto': String(i), placeholder: 'Título del punto', value: p.titulo });
      if (fijo) titulo.readOnly = true;
      titulo.oninput = function () { p.titulo = titulo.value; cambio(); };
      var botones = h('span', { class: 'botones' }, [
        h('button', { type: 'button', class: 'boton chico', 'data-accion': 'subir', title: 'Subir', texto: '↑', onclick: function () { B.moverPunto(b, i, -1); cambio(); pintarPuntos(); } }),
        h('button', { type: 'button', class: 'boton chico', 'data-accion': 'bajar', title: 'Bajar', texto: '↓', onclick: function () { B.moverPunto(b, i, 1); cambio(); pintarPuntos(); } }),
        h('button', { type: 'button', class: 'boton chico peligro', 'data-accion': 'quitar', title: 'Quitar este punto', texto: '✕', onclick: function () { B.quitarPunto(b, i); cambio(); pintarPuntos(); } })
      ]);
      var cabeza = h('div', { class: 'cabeza-punto' }, [h('span', { class: 'numero', texto: (i + 1) + '.' }), titulo, botones]);
      if (fijo) return h('div', { class: 'punto fijo', 'data-punto': String(i) }, [cabeza, h('p', { class: 'suave', texto: 'Este punto no lleva notas: su texto es fijo y se escribe solo al crear el acta.' })]);
      var notas = caja(i, p.notas, function (t) { p.notas = t; cambio(); }, false);
      var partes = [cabeza];
      if (g.Huecos.tiene(p)) partes.push(g.PantallaHuecos.pintar(p, i, caja, cambio, pintarPuntos), h('div', { class: 'suave etiqueta-libres', texto: 'Notas libres (lo que no encaje en ningún hueco)' }));
      else partes.push(g.PantallaHuecos.pintar(p, i, caja, cambio, pintarPuntos));
      if (g.EvaluacionCiclo && Array.isArray(p.grupos) && p.grupos.length) partes.push(g.PantallaResumenCiclo.pintar(b, p, i, est.alumnado && est.alumnado.lista ? est.alumnado.lista.delCiclo : null, cambio, pintarPuntos));
      partes.push(notas);
      return h('div', { class: 'punto', 'data-punto': String(i) }, partes);
    }
    /* Una caja de texto con dictado y «+ Alumno»: la de las notas libres y la de cada hueco. */
    function caja(id, texto, guardar, compacto) {
      var ed = g.EditorNotas.crear(id, texto, function () { return est.alumnado; }, guardar);
      var recordatorio = h('span', { class: 'iniciales' });
      var masAlumno = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-alumno', texto: '+ Alumno', onclick: function () { ed.abrirBuscador(); } });
      alumnadoVisto.push({ recordatorio: recordatorio, masAlumno: masAlumno });
      var pie = [recordatorio];
      if (!compacto) pie.push(h('span', { class: 'suave', texto: 'Nunca un nombre suelto sin elegirlo de la lista.' }));
      pie.push(masAlumno, g.Ayuda.aviso('alumnado-iniciales'));
      if (g.Dictado.disponible()) {
        var mic = h('button', { type: 'button', class: 'boton chico mic', 'data-accion': 'dictar', title: 'Dictar', texto: '🎤 Dictar' });
        var d = g.Dictado.crear(ed.comoCaja, guardar, function (activo) { mic.classList.toggle('grabando', activo); mic.textContent = activo ? '⏹ Parar' : '🎤 Dictar'; });
        mic.onclick = function () { d.alternar(); };
        pie.push(mic);
      }
      return h('div', { class: 'caja-ayudas' }, [ed.elemento, h('div', { class: 'pie-punto' }, pie)]);
    }
    /* Fila 61: la propia clase entra sola. Se hace una vez, cuando ya están los bloques por grupo (hace falta la lista de Rúbricas). */
    async function traerResumenes() {
      try {
        if (!est.raiz || !g.EvaluacionCiclo || !g.EvaluacionCiclo.puntosDeEvaluacion(b).length) return;
        var r = g.EvaluacionCiclo.traerPropia(b, await g.Evaluacion.listar(est.raiz));
        avisoResumenes.textContent = ''; avisoResumenes.hidden = !r.avisos.length;
        r.avisos.forEach(function (t) { avisoResumenes.appendChild(h('div', { texto: t })); });
        if (r.cambiado) { cambio(); pintarPuntos(); }
      } catch (x) { /* sin acta de evaluación legible: el borrador sigue como estaba */ }
    }
    pintarPuntos();
    g.Rubricas.cargar(est).then(pintarAlumnado).then(traerResumenes);

    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: async function () { await est.alSalir(); volver(); } }),
        h('h2', { class: 'subtitulo', texto: 'Acta del equipo de ciclo' }),
        h('span', { class: 'derecha' }, [g.Ayuda.aviso('redactar-claude')]),
        h('button', { type: 'button', class: 'boton principal', id: 'redactarConClaude', texto: b.puntos.some(function (p) { return p.parrafo; }) ? 'Ir a la revisión' : 'Redactar con Claude', onclick: async function () { await est.alSalir(); redactar(); } })
      ]),
      h('section', { class: 'tarjeta ancha' }, [
        h('div', { class: 'cuatro' }, [campo('Fecha de la reunión', fecha), campo('Hora de inicio', inicio), campo('Hora de fin', fin), campo('Evaluación', evalu)])
      ]),
      h('section', { class: 'tarjeta ancha' }, [h('h3', { texto: 'Profesorado asistente' }), asistentes]),
      h('section', { class: 'tarjeta ancha' }, [
        h('h3', { texto: 'Puntos del orden del día' }), avisoAlumnado, avisoResumenes, contenedor,
        h('button', { type: 'button', class: 'boton', id: 'anadirPunto', texto: '+ Añadir punto', onclick: function () { B.anadirPunto(b); cambio(); pintarPuntos(); var t = contenedor.querySelector('.punto:last-child .titulo-punto'); if (t) t.focus(); } })
      ])
    ]);
  }

  g.PantallaFormulario = { pintarFormulario: pintarFormulario };
})(window);
