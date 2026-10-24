/* Programa de refuerzo del aprendizaje, PRA (fila 75): la lista de PRA del curso, «Nuevo PRA» (se elige al alumno de todo el alumnado de Rúbricas)
   y el formulario: género, áreas, «Qué le pasa al alumno» (editor de notas con dictado) y, debajo, lo que Claude redacta (pantalla-pra-textos.js).
   Se guarda solo en ACTAS/pra/. Sin PDF ni Word: el PRA oficial lo genera Séneca. */
(function (g) {
  'use strict';
  var h = g.Dom.h, P = g.Pra, A = g.Alumnado;

  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function fechaDe(iso) { try { return g.fechaLarga(iso); } catch (e) { return iso; } }

  /* --- la lista y «Nuevo PRA» --- */
  async function pintarLista(est, alVolver, tut) {
    var rub = await g.Rubricas.cargar(est), lista = rub.lista;
    var curso = g.cursoEscolar(hoyIso());
    var todos = P.delCurso(await P.listar(est.raiz), curso);
    var abrir = function (p) { est.praActual = p; est.refrescar(); };
    /* Todo el alumnado de Rúbricas; primero los de la clase de tutoría, si existe. */
    var primero = tut ? A.normalizar(tut.grupo).trim() : null;
    var orden = lista ? lista.todos.filter(function (a) { return A.normalizar(a.grupo).trim() === primero; }).concat(lista.todos.filter(function (a) { return A.normalizar(a.grupo).trim() !== primero; })) : [];
    var buscador = g.BuscadorAlumno.crear('', function () { return { estado: 'ok', lista: { delCiclo: orden, grupos: lista ? lista.grupos : [] } }; }, async function (alumno) {
      var previo = P.existente(await P.listar(est.raiz), alumno, curso);
      abrir(previo || P.nueva(alumno, hoyIso(), new Date()));
    }, function () { /* no hay nada que cancelar */ }, { sinLibre: true });
    var avisoLista = h('p', { class: 'suave', id: 'avisoLista' });
    var items = todos.map(function (p) {
      var confirmar = h('span', { class: 'confirmar', hidden: '' }), botones = h('span', { class: 'botones' });
      botones.appendChild(h('button', { type: 'button', class: 'boton principal', 'data-accion': 'abrir-pra', texto: 'Abrir', onclick: function () { abrir(p); } }));
      botones.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'borrar', texto: 'Borrar', onclick: function () { botones.hidden = true; confirmar.hidden = false; } }));
      confirmar.appendChild(h('span', { texto: '¿Borrar este PRA? ' }));
      confirmar.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'si-borrar', texto: 'Sí, borrar', onclick: async function () { await P.borrar(est.raiz, p.id); est.refrescar(); } }));
      confirmar.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'no-borrar', texto: 'No', onclick: function () { confirmar.hidden = true; botones.hidden = false; } }));
      var areas = P.resumenAreas(p);
      return h('li', { class: 'borrador', 'data-id': p.id }, [
        h('div', { class: 'datos' }, [h('strong', { texto: A.etiqueta(p.alumno) }), h('span', { class: 'primero', texto: areas.length ? areas.join(', ') : 'Sin áreas marcadas' }),
          h('span', { class: 'suave', texto: fechaDe((p.fecha || '').slice(0, 10)) })]), botones, confirmar
      ]);
    });
    var nodos = [
      h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverDiversidad', texto: '← Atención a la diversidad', onclick: alVolver }), h('h2', { class: 'subtitulo', texto: 'Programa de refuerzo (PRA)' }),
        h('span', { class: 'derecha' }, [g.Ayuda.aviso('pra')])]),
      h('section', { class: 'tarjeta ancha' }, [h('h3', { texto: 'Nuevo PRA' }), h('p', { texto: '¿De qué alumno es el PRA? Si ya tiene uno este curso, se abre ese.' })])
    ];
    var aviso = g.PantallaFichas.avisoRubricas(est, function () { est.refrescar(); });
    if (aviso) nodos.push(aviso);
    nodos.push(buscador.elemento);
    nodos.push(h('h2', { class: 'subtitulo', texto: 'Los de este curso' }));
    nodos.push(todos.length ? h('ul', { class: 'borradores', id: 'listaPra' }, items) : h('p', { class: 'suave', id: 'sinPra', texto: 'Todavía no has empezado ningún PRA este curso.' }));
    nodos.push(avisoLista);
    g.Dom.montar(nodos);
  }

  /* --- el formulario --- */
  async function pintarEditor(est, alVolver, p) {
    var rub = await g.Rubricas.cargar(est), todosAlumnos = rub.lista ? rub.lista.todos : [];
    var cambio = g.Autoguardado.crear(est, p, P.guardar).cambio, textos = null, lugarAreas = h('div', { class: 'fila', id: 'areasPra' });
    function alCambiar() { cambio(); if (textos) textos.notasCambiaron(); }

    var genero = h('select', { id: 'generoAlumno' }, [h('option', { value: 'o', texto: 'El alumno' }), h('option', { value: 'a', texto: 'La alumna' })]);
    genero.value = p.alumno.genero === 'a' ? 'a' : 'o';
    genero.onchange = function () { p.alumno.genero = genero.value; alCambiar(); };

    function pintarAreas() {
      lugarAreas.textContent = '';
      P.AREAS.forEach(function (nombre) {
        var c = h('input', { type: 'checkbox', 'data-area': nombre }); c.checked = P.estaMarcada(p, nombre);
        c.onchange = function () { P.marcar(p, nombre, c.checked); alCambiar(); if (textos) textos.repintar(); };
        lugarAreas.appendChild(h('label', { class: 'campo-casilla' }, [c, ' ', nombre]));
      });
    }

    var ed = g.EditorNotas.crear('pra', p.notas || '', function () { return est.alumnado; }, function (t) { p.notas = t; alCambiar(); });
    var mas = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-alumno', texto: '+ Alumno', onclick: function () { ed.abrirBuscador(); } });
    mas.disabled = !(est.alumnado && est.alumnado.estado === 'ok');
    var pie = [h('span', { class: 'suave', texto: 'Nunca un nombre suelto sin elegirlo de la lista.' }), mas];
    if (g.Dictado.disponible()) {
      var mic = h('button', { type: 'button', class: 'boton chico mic', 'data-accion': 'dictar', title: 'Dictar', texto: '🎤 Dictar' });
      var d = g.Dictado.crear(ed.comoCaja, function (t) { p.notas = t; alCambiar(); }, function (activo) { mic.classList.toggle('grabando', activo); mic.textContent = activo ? '⏹ Parar' : '🎤 Dictar'; });
      mic.onclick = function () { d.alternar(); };
      pie.push(mic);
    }
    var caja = h('div', { class: 'caja-ayudas', 'data-caja': 'pra' }, [
      h('strong', { texto: 'Qué le pasa al alumno' }), h('span', { class: 'suave', id: 'ayudaNotasPra', texto: 'Cuenta en dos o tres líneas qué le cuesta, qué le ayuda y qué has probado.' }), ed.elemento, h('div', { class: 'pie-punto' }, pie)
    ]);

    textos = g.PantallaPraTextos.crear(est, p, { cambio: cambio, todos: todosAlumnos });
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverLista', texto: '← Mis PRA', onclick: async function () { await est.alSalir(); est.praActual = null; est.refrescar(); } }),
        h('h2', { class: 'subtitulo', 'data-pra': 'titulo', texto: 'PRA de ' + A.etiqueta(p.alumno) })
      ]),
      h('section', { class: 'tarjeta ancha' }, [
        h('div', { class: 'cuatro' }, [h('label', { class: 'campo' }, ['En los textos se le llamará', genero])]),
        h('strong', { texto: 'Áreas del PRA' }), lugarAreas, caja
      ]),
      textos.nodo
    ]);
    pintarAreas(); textos.repintar();
  }

  async function pintarPra(est, alVolver) {
    var p = est.praActual;
    if (p) { await pintarEditor(est, alVolver, p); return; }
    await pintarLista(est, alVolver, await g.Tutoria.leerTutoria(est.raiz));
  }

  g.PantallaPra = { pintarPra: pintarPra };
})(window);
