/* Acta de evaluación (fila 59): la lista de actas del curso, el formulario de notas (por área, por alumno y las cajas de orientación, observaciones y conclusiones)
   y, debajo, lo que Claude redacta (pantalla-evaluacion-textos.js). La tutora lo apunta todo; el acta se guarda sola en ACTAS/evaluaciones/. */
(function (g) {
  'use strict';
  var h = g.Dom.h, E = g.Evaluacion, T = g.Tutoria, A = g.Alumnado;

  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function fechaDe(iso) { try { return g.fechaLarga(iso); } catch (e) { return iso; } }
  function nombreSesion(id) { return (E.sesion(id) || { nombre: id }).nombre; }

  /* --- la lista y «Nueva acta de evaluación» --- */
  async function pintarLista(est, alInicio, tut) {
    var rub = await g.Rubricas.cargar(est), lista = rub.lista;
    var todas = E.delCurso(await E.listar(est.raiz), (est.ficha && est.ficha.curso) || '');
    var abrir = function (e) { est.evaluacionActual = e; est.evaluacionId = null; est.refrescar(); };
    var grupos = lista ? lista.grupos.slice() : [];
    if (tut && grupos.indexOf(tut.grupo) < 0) grupos.unshift(tut.grupo);
    var clase = grupos.length ? h('select', { id: 'claseEvaluacion' }, grupos.map(function (n) { return h('option', { value: n, texto: n }); })) : h('input', { type: 'text', id: 'claseEvaluacion', placeholder: 'Por ejemplo: 4º A' });
    /* Lo elegido sobrevive a repintar la pantalla (por ejemplo, tras abrir la carpeta RÚBRICAS). */
    var previo = est.nuevaEvaluacion || {};
    if (previo.clase && grupos.length && grupos.indexOf(previo.clase) < 0) previo.clase = '';
    clase.value = previo.clase || (tut ? tut.grupo : '');
    var fecha = h('input', { type: 'date', id: 'fechaNuevaEvaluacion', value: previo.fecha || hoyIso() });
    var sesion = h('select', { id: 'sesionEvaluacion' }, E.SESIONES.map(function (s) { return h('option', { value: s.id, texto: s.nombre }); }));
    sesion.value = previo.sesion || E.sesionPorFecha(fecha.value);
    function recordar() { est.nuevaEvaluacion = { clase: clase.value, fecha: fecha.value, sesion: sesion.value }; }
    fecha.onchange = function () { if (fecha.value) sesion.value = E.sesionPorFecha(fecha.value); recordar(); };
    sesion.onchange = recordar; clase.onchange = recordar;
    var aviso = g.Dom.aviso(), avisoLista = h('p', { class: 'suave', id: 'avisoLista' });
    var items = todas.map(function (e) {
      var confirmar = h('span', { class: 'confirmar', hidden: '' }), botones = h('span', { class: 'botones' });
      botones.appendChild(h('button', { type: 'button', class: 'boton principal', 'data-accion': 'abrir-evaluacion', texto: 'Abrir', onclick: function () { abrir(e); } }));
      if (e.estado === 'creada' && e.documentos) {
        ['pdf', 'docx'].forEach(function (t) {
          botones.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'abrir-' + t, texto: t === 'pdf' ? 'Abrir PDF' : 'Abrir Word', onclick: async function () {
            if ((await g.Envios.abrir(est.raiz, e, t)) === 'falta') avisoLista.textContent = 'No encuentro el fichero en la carpeta ACTAS.';
          } }));
        });
      }
      if (e.estado !== 'creada') {
        botones.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'borrar', texto: 'Borrar', onclick: function () { botones.hidden = true; confirmar.hidden = false; } }));
        confirmar.appendChild(h('span', { texto: '¿Borrar esta acta? ' }));
        confirmar.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'si-borrar', texto: 'Sí, borrar', onclick: async function () { await E.borrar(est.raiz, e.id); est.refrescar(); } }));
        confirmar.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'no-borrar', texto: 'No', onclick: function () { confirmar.hidden = true; botones.hidden = false; } }));
      }
      return h('li', { class: 'borrador', 'data-id': e.id, 'data-estado': e.estado }, [
        h('div', { class: 'datos' }, [h('strong', { texto: e.clase + ' · Evaluación ' + nombreSesion(e.sesion).toLowerCase() }), h('span', { class: 'primero', texto: fechaDe(e.fecha) }),
          h('span', { class: 'suave', texto: e.estado === 'creada' ? 'Anexo creado' : 'Borrador' })]), botones, confirmar
      ]);
    });
    var empezar = h('button', { type: 'button', class: 'boton principal grande', id: 'nuevaEvaluacion', texto: 'Nueva acta de evaluación', onclick: async function () {
      g.Dom.decir(aviso, '');
      var c = String(clase.value || '').trim();
      if (!c) { g.Dom.decir(aviso, 'Elige la clase.'); return; }
      if (!fecha.value) { g.Dom.decir(aviso, 'Elige la fecha de la sesión.'); return; }
      var previa = E.existente(await E.listar(est.raiz), c, sesion.value, fecha.value);
      est.nuevaEvaluacion = null;
      abrir(previa || E.nueva(c, sesion.value, fecha.value, new Date()));
    } });
    var aviso2 = g.PantallaFichas.avisoRubricas(est, function () { est.refrescar(); });
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: alInicio }), h('h2', { class: 'subtitulo', texto: 'Acta de evaluación' }),
        h('span', { class: 'derecha' }, [g.Ayuda.aviso('acta-evaluacion')])]),
      h('section', { class: 'tarjeta ancha' }, [h('div', { class: 'cuatro' }, [
        h('label', { class: 'campo' }, ['Clase', clase]), h('label', { class: 'campo' }, ['Sesión', sesion]), h('label', { class: 'campo' }, ['Fecha de la sesión', fecha])]), empezar, aviso, aviso2]),
      h('h2', { class: 'subtitulo', texto: 'Las de este curso' }),
      todas.length ? h('ul', { class: 'borradores', id: 'listaEvaluaciones' }, items) : h('p', { class: 'suave', id: 'sinEvaluaciones', texto: 'Todavía no has empezado ninguna acta de evaluación este curso.' }), avisoLista
    ].filter(Boolean));
  }

  /* --- el formulario de notas --- */
  async function pintarEditor(est, alInicio, tut, e) {
    var rub = await g.Rubricas.cargar(est), lista = rub.lista;
    var alumnado = lista ? T.alumnadoDelGrupo(lista, e.clase) : [];
    var cambio = g.Autoguardado.crear(est, e, E.guardar).cambio, textos = null, lugarAreas = h('div', { class: 'dos-col', id: 'areasEvaluacion' });
    var hayRubricas = false, cifrasCambiadas = false;
    /* Fila 60: el % con dificultades sale de las notas de Rúbricas (solo se lee su carpeta). Una acta ya creada no se toca. */
    if (lista && est.alumnado.handle && e.estado !== 'creada') {
      try {
        var res = await g.EvaluacionRubricas.leer(g.Carpeta.adaptador(est.alumnado.handle), e);
        hayRubricas = res.estado === 'ok';
        var antes = JSON.stringify(e.areas), ap = g.EvaluacionRubricas.aplicar(e, res);
        cifrasCambiadas = ap.cambiaron;
        if (JSON.stringify(e.areas) !== antes) cambio();
      } catch (x) { hayRubricas = false; }
    }
    function alCambiar() { cambio(); if (textos) textos.notasCambiaron(); }

    /* Una caja de notas con dictado y «+ Alumno». */
    function caja(indice, titulo, valor, guardar, ayuda) {
      var ed = g.EditorNotas.crear(indice, valor || '', function () { return est.alumnado; }, function (t) { guardar(t); alCambiar(); });
      var mas = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-alumno', texto: '+ Alumno', onclick: function () { ed.abrirBuscador(); } });
      mas.disabled = !(est.alumnado && est.alumnado.estado === 'ok');
      var pie = [mas];
      if (g.Dictado.disponible()) {
        var mic = h('button', { type: 'button', class: 'boton chico mic', 'data-accion': 'dictar', title: 'Dictar', texto: '🎤 Dictar' });
        var d = g.Dictado.crear(ed.comoCaja, function (t) { guardar(t); alCambiar(); }, function (activo) { mic.classList.toggle('grabando', activo); mic.textContent = activo ? '⏹ Parar' : '🎤 Dictar'; });
        mic.onclick = function () { d.alternar(); };
        pie.push(mic);
      }
      return h('div', { class: 'caja-ayudas', 'data-caja': indice }, [titulo ? h('strong', { texto: titulo }) : null, ayuda ? h('span', { class: 'suave', texto: ayuda }) : null, ed.elemento, h('div', { class: 'pie-punto' }, pie)]);
    }

    /* Por área */
    function pintarAreas() {
      lugarAreas.textContent = '';
      e.areas.forEach(function (a, i) {
        var pct = h('input', { type: 'number', min: '0', max: '100', step: '1', 'data-porcentaje': String(i), value: E.tienePorcentaje(a) ? String(a.porcentaje) : '', title: 'Porcentaje del grupo con dificultades' });
        pct.oninput = function () { E.ponerPorcentaje(a, pct.value); alCambiar(); pintarNota(); };
        var nota = h('span', { class: 'suave nota-rubricas', 'data-nota-rubricas': String(i) });
        function pintarNota() {
          nota.textContent = '';
          var hay = a.porcentajeDeRubricas != null && a.porcentajeDeRubricas !== '';
          if (hay && !a.porcentajeAMano) nota.textContent = a.fraseRubricas || '';
          else if (hay) {
            nota.appendChild(document.createTextNode(a.porcentajeDeRubricas + ' en Rúbricas '));
            nota.appendChild(h('button', { type: 'button', class: 'boton chico', 'data-accion': 'usar-rubricas', texto: 'Usar el de Rúbricas', onclick: function () {
              g.EvaluacionRubricas.usarElDeRubricas(a); pct.value = String(a.porcentaje); alCambiar(); pintarNota();
            } }));
          } else if (hayRubricas && !a.porcentajeAMano && !E.tienePorcentaje(a)) nota.textContent = 'Sin notas en Rúbricas: escríbela tú';
        }
        pintarNota();
        var quitar = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'quitar-area', texto: 'Quitar', onclick: function () { E.quitarArea(e, i); alCambiar(); pintarAreas(); } });
        lugarAreas.appendChild(h('div', { class: 'tarjeta area-evaluacion', 'data-area': a.nombre }, [
          h('div', { class: 'cabeza-hueco' }, [h('strong', { texto: a.nombre }), h('span', { class: 'fila' }, [h('label', { class: 'campo-corto' }, ['% con dificultades ', pct]), quitar])]), nota,
          caja('ev-area-' + i, '', a.notas, function (t) { a.notas = t; })
        ]));
      });
      var otra = h('input', { type: 'text', id: 'areaNueva', placeholder: 'Otra área', list: 'areasQuitadas' });
      var sug = h('datalist', { id: 'areasQuitadas' }, e.areasQuitadas.map(function (n) { return h('option', { value: n }); }));
      lugarAreas.appendChild(h('div', { class: 'fila', id: 'anadirArea' }, [otra, sug, h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-area', texto: '+ Añadir área', onclick: function () {
        if (E.anadirArea(e, otra.value)) { alCambiar(); pintarAreas(); }
      } })]));
    }

    /* Por alumno: cada uno plegado; quien no tiene nada apuntado no sale en el acta. */
    function alumnos() {
      var nodos = alumnado.map(function (a, i) {
        var notas = E.notasDe(e, a), det = h('details', { class: 'mes-habitual alumno-evaluacion', 'data-alumno': a.nombre }, [h('summary', { texto: a.nombre + (E.notasDe(e, a) ? ' ✎' : '') })]);
        var hecho = false;
        function abrirCaja() {
          if (hecho) return; hecho = true;
          det.appendChild(caja('ev-alumno-' + i, '', notas, function (t) { E.ponerNotasAlumno(e, a, t); det.firstChild.textContent = a.nombre + (E.notasDe(e, a) ? ' ✎' : ''); }));
        }
        det.addEventListener('toggle', function () { if (det.open) abrirCaja(); });
        if (notas) { det.setAttribute('open', ''); abrirCaja(); }
        return det;
      });
      if (!alumnado.length) nodos = [h('p', { class: 'suave', id: 'sinAlumnado', texto: lista ? 'No hay alumnado de ' + e.clase + ' en la lista de Rúbricas.' : 'Abre la carpeta RÚBRICAS para ver aquí el alumnado.' })];
      return h('section', { class: 'tarjeta ancha', id: 'alumnadoEvaluacion' }, [h('h3', { texto: 'Por alumno' }),
        h('p', { class: 'suave', texto: 'Solo saldrán en el acta los alumnos con algo apuntado.' }), h('div', { class: 'dos-col' }, nodos)]);
    }

    var fecha = h('input', { type: 'date', id: 'fechaEvaluacion', value: e.fecha });
    fecha.onchange = function () { if (fecha.value) { e.fecha = fecha.value; if (e.estado !== 'creada') e.curso = g.cursoEscolar(e.fecha); cambio(); } };
    var chicas = h('input', { type: 'number', min: '0', id: 'alumnasGrupo', value: String((e.composicion && e.composicion.chicas) || '') }), chicos = h('input', { type: 'number', min: '0', id: 'alumnosGrupo', value: String((e.composicion && e.composicion.chicos) || '') });
    chicas.oninput = function () { e.composicion.chicas = chicas.value; alCambiar(); }; chicos.oninput = function () { e.composicion.chicos = chicos.value; alCambiar(); };
    var estado = h('span', { class: 'suave', id: 'estadoRedaccion' });

    var cajas = [caja('ev-orientacion', 'Orientación', e.orientacion, function (t) { e.orientacion = t; }, 'Lo que aporta el departamento de orientación.'),
      caja('ev-observaciones', 'Observaciones', e.observaciones, function (t) { e.observaciones = t; }, 'Las medidas para el trimestre.'),
      caja('ev-conclusiones', 'Conclusiones', e.conclusiones, function (t) { e.conclusiones = t; })];
    if (e.sesion === 'inicial') cajas.unshift(caja('ev-informes', 'Informes del curso anterior', e.informesAnteriores, function (t) { e.informesAnteriores = t; }, 'Clima de aula, casos del curso pasado, nuevas incorporaciones.'));

    textos = g.PantallaEvaluacionTextos.crear(est, e, { cambio: cambio, tut: tut, todos: rub.lista ? rub.lista.todos : [], alInicio: alInicio });
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver', onclick: async function () { await est.alSalir(); est.evaluacionActual = null; est.refrescar(); } }),
        h('h2', { class: 'subtitulo', 'data-evaluacion': 'titulo', texto: 'Acta de evaluación ' + nombreSesion(e.sesion).toLowerCase() + ' · ' + e.clase }), estado
      ]),
      h('section', { class: 'tarjeta ancha' }, [h('div', { class: 'cuatro' }, [h('label', { class: 'campo' }, ['Fecha de la sesión', fecha]),
        h('label', { class: 'campo' }, ['Alumnas', chicas]), h('label', { class: 'campo' }, ['Alumnos', chicos])]),
        h('p', { class: 'suave', texto: 'La composición del grupo la pones tú: Rúbricas no sabe si cada alumno es chico o chica.' })]),
      h('section', { class: 'tarjeta ancha' }, [h('h3', { texto: 'Por área' }), h('p', { class: 'suave', texto: 'Notas de lo hablado en cada área y el porcentaje del grupo con dificultades. Si el área tiene notas en Rúbricas, el porcentaje sale de ahí y puedes cambiarlo.' }),
        cifrasCambiadas ? h('div', { class: 'aviso', id: 'avisoCifrasRubricas', texto: 'Las cifras de Rúbricas han cambiado desde que se redactó: vuelve a pulsar «Redactar con Claude» si quieres ponerlas al día.' }) : null, lugarAreas].filter(Boolean)),
      alumnos(),
      h('section', { class: 'tarjeta ancha' }, cajas),
      textos.nodo
    ]);
    pintarAreas();
  }

  async function pintarEvaluacion(est, alInicio) {
    var salida = function () { est.evaluacionId = null; est.evaluacionActual = null; alInicio(); };
    var tut = await T.leerTutoria(est.raiz);
    var e = est.evaluacionActual;
    if (!e && est.evaluacionId) e = await E.leer(est.raiz, est.evaluacionId);
    if (e) { est.evaluacionActual = e; await pintarEditor(est, salida, tut, e); return; }
    await pintarLista(est, salida, tut);
  }

  g.PantallaEvaluacion = { pintarEvaluacion: pintarEvaluacion };
})(window);
