/* Petición a orientación (fila 76): la lista de peticiones del curso con su estado, «Nueva petición» (se elige al alumno de todo el alumnado de Rúbricas) y el paso 1,
   el acta de la reunión del equipo docente. El paso 2, la solicitud, está en pantalla-peticion-solicitud.js. Se guarda solo en ACTAS/peticiones/ y los PDF y Word en ACTAS/documentos/. */
(function (g) {
  'use strict';
  var h = g.Dom.h, P = g.Peticion, A = g.Alumnado, TX = g.PantallaPeticionTexto;

  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function fechaDe(iso) { try { return g.fechaCorta(iso); } catch (e) { return iso; } }

  /* --- la lista y «Nueva petición» --- */
  async function pintarLista(est, alVolver, tut) {
    var rub = await g.Rubricas.cargar(est), lista = rub.lista, hoy = hoyIso();
    var todas = P.visibles(await P.listar(est.raiz), g.cursoEscolar(hoy));
    var abrir = function (p) { est.peticionActual = p; est.refrescar(); };
    var primero = tut ? A.normalizar(tut.grupo).trim() : null;
    var orden = lista ? lista.todos.filter(function (a) { return A.normalizar(a.grupo).trim() === primero; }).concat(lista.todos.filter(function (a) { return A.normalizar(a.grupo).trim() !== primero; })) : [];
    var buscador = g.BuscadorAlumno.crear('', function () { return { estado: 'ok', lista: { delCiclo: orden, grupos: lista ? lista.grupos : [] } }; }, function (alumno) {
      abrir(P.nueva(alumno, hoy, new Date()));
    }, function () { /* no hay nada que cancelar */ }, { sinLibre: true });
    var items = todas.map(function (p) {
      var confirmar = h('span', { class: 'confirmar', hidden: '' }), botones = h('span', { class: 'botones' }), listo = P.llegoLaRevision(p, hoy);
      botones.appendChild(h('button', { type: 'button', class: 'boton principal', 'data-accion': 'abrir-peticion', texto: 'Abrir', onclick: function () { abrir(p); } }));
      botones.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'borrar', texto: 'Borrar', onclick: function () { botones.hidden = true; confirmar.hidden = false; } }));
      confirmar.appendChild(h('span', { texto: '¿Borrar esta petición? ' }));
      confirmar.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'si-borrar', texto: 'Sí, borrar', onclick: async function () { await P.borrar(est.raiz, p.id); est.refrescar(); } }));
      confirmar.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'no-borrar', texto: 'No', onclick: function () { confirmar.hidden = true; botones.hidden = false; } }));
      return h('li', { class: 'borrador', 'data-id': p.id }, [
        h('div', { class: 'datos' }, [h('strong', { texto: A.etiqueta(p.alumno) }), h('span', { class: 'primero', texto: 'Reunión del ' + fechaDe(p.reunion.fecha) }),
          h('span', { class: listo ? 'etiqueta cambiadas' : 'suave', 'data-estado': p.estado + (listo ? '-lista' : ''), texto: P.estadoTexto(p, hoy) })]), botones, confirmar
      ]);
    });
    var nodos = [
      h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverDiversidad', texto: '← Atención a la diversidad', onclick: alVolver }), h('h2', { class: 'subtitulo', texto: 'Petición a orientación' }),
        h('span', { class: 'derecha' }, [g.Ayuda.aviso('peticion')])]),
      h('section', { class: 'tarjeta ancha' }, [h('h3', { texto: 'Nueva petición' }), h('p', { texto: '¿De qué alumno es la petición? Se hace el acta de la reunión del equipo docente y, a los tres meses, la solicitud.' })])
    ];
    var aviso = g.PantallaFichas.avisoRubricas(est, function () { est.refrescar(); });
    if (aviso) nodos.push(aviso);
    nodos.push(buscador.elemento);
    nodos.push(h('h2', { class: 'subtitulo', texto: 'Las de este curso' }));
    nodos.push(todas.length ? h('ul', { class: 'borradores', id: 'listaPeticiones' }, items) : h('p', { class: 'suave', id: 'sinPeticiones', texto: 'Todavía no has empezado ninguna petición este curso.' }));
    g.Dom.montar(nodos);
  }

  /* --- el paso 1: el acta de la reunión --- */
  async function pintarEditor(est, alVolver, p, tut) {
    var rub = await g.Rubricas.cargar(est), todos = rub.lista ? rub.lista.todos : [], hoy = hoyIso(), r = p.reunion;
    var cambio = g.Autoguardado.crear(est, p, P.guardar).cambio, texto = null;
    function alCambiar() { cambio(); if (texto) texto.notasCambiaron(); }

    var genero = h('select', { id: 'generoAlumno' }, [h('option', { value: 'o', texto: 'El alumno' }), h('option', { value: 'a', texto: 'La alumna' })]);
    genero.value = p.alumno.genero === 'a' ? 'a' : 'o';
    genero.onchange = function () { p.alumno.genero = genero.value; alCambiar(); };
    var revision = h('input', { type: 'date', id: 'fechaRevision', value: p.revision });
    var fecha = h('input', { type: 'date', id: 'fechaReunion', value: r.fecha });
    fecha.onchange = function () { if (fecha.value) { P.ponerFechaReunion(p, fecha.value); revision.value = p.revision; alCambiar(); } };
    revision.onchange = function () { if (revision.value) { P.ponerRevision(p, revision.value); alCambiar(); } };

    var asistentes = h('textarea', { rows: '4', id: 'asistentes', placeholder: 'Uno por línea' });
    asistentes.value = r.asistentes || '';
    asistentes.oninput = function () { r.asistentes = asistentes.value; alCambiar(); };
    var sugeridos = (est.ficha && Array.isArray(est.ficha.profesorado) ? est.ficha.profesorado : String((est.ficha && est.ficha.profesorado) || '').split(/\r?\n/)).map(function (x) { return String(x).trim(); }).filter(Boolean);
    var chips = h('div', { class: 'fila', id: 'sugeridosAsistentes' }, sugeridos.map(function (n) {
      return h('button', { type: 'button', class: 'boton chico', 'data-asistente': n, texto: '+ ' + n, onclick: function () { if (P.anadirAsistente(p, n)) { asistentes.value = r.asistentes; alCambiar(); } } });
    }));

    var lugarAmbitos = h('div', { class: 'fila', id: 'ambitosPeticion' });
    P.AMBITOS.forEach(function (nombre) {
      var c = h('input', { type: 'checkbox', 'data-ambito': nombre }); c.checked = r.ambitos.indexOf(nombre) >= 0;
      c.onchange = function () { P.marcarAmbito(p, nombre, c.checked); alCambiar(); };
      lugarAmbitos.appendChild(h('label', { class: 'campo-casilla' }, [c, ' ', nombre]));
    });

    texto = TX.crear(est, {
      id: 'acta', titulo: 'El acta de la reunión', almacen: r, campo: 'textoActa', todos: todos, cambio: cambio, etiquetaCrear: r.documentos ? 'Crear el acta otra vez' : 'Crear acta',
      firma: function () { return P.firmaActa(p); }, problemaRedactar: function () { return P.problemaActa(p); }, problemaCrear: function () { return P.problemaActa(p) || (String(r.textoActa || '').trim() ? '' : 'Redacta primero el acta con Claude.'); },
      redactar: function (clave, op) { return g.PeticionClaude.redactarActa(clave, p, todos, op); },
      crear: function () { return g.PeticionDocs.crearActa(est.raiz, p, est.ficha, tut, new Date()); },
      alCrear: function () { est.refrescar(); },
      textoCreado: function (d) { return 'El acta está en PDF y en Word, en la carpeta ACTAS › documentos › ' + d.curso + '. '; }
    });
    var hecha = p.estado !== 'borrador';
    var despues = hecha ? h('section', { class: 'tarjeta ancha', id: 'despuesDelActa' }, [h('h3', { texto: 'Después de la reunión' }),
      h('p', { id: 'estadoPeticion', 'data-estado': p.estado, texto: P.estadoTexto(p, hoy) + (P.llegoLaRevision(p, hoy) ? '' : (p.estado === 'medidas' ? '. Las medidas se aplican al menos tres meses.' : '')) }),
      g.PantallaPeticionSolicitud.acciones(est, p, hoy, cambio)]) : null;
    var sol = p.solicitud && p.estado !== 'cerrada' ? g.PantallaPeticionSolicitud.solicitud(est, p, { cambio: cambio, tut: tut, todos: todos, hoy: hoy }) : null;

    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverLista', texto: '← Mis peticiones', onclick: async function () { await est.alSalir(); est.peticionActual = null; est.refrescar(); } }),
        h('h2', { class: 'subtitulo', 'data-peticion': 'titulo', texto: 'Petición de ' + A.etiqueta(p.alumno) })
      ]),
      h('section', { class: 'tarjeta ancha' }, [h('h3', { texto: 'Acta de la reunión del equipo docente' }),
        h('div', { class: 'cuatro' }, [h('label', { class: 'campo' }, ['En los textos se le llamará', genero]), h('label', { class: 'campo' }, ['Fecha de la reunión', fecha]), h('label', { class: 'campo' }, ['Fecha de revisión', revision])]),
        h('label', { class: 'campo' }, ['Asistentes', asistentes]), chips,
        TX.cajaNotas(est, 'observado', 'Qué se ha observado', 'Cuenta qué se ha visto en clase y marca abajo los ámbitos que tocan.', r.observado, function (t) { r.observado = t; alCambiar(); }),
        h('strong', { texto: 'Ámbitos con indicios' }), lugarAmbitos,
        TX.cajaNotas(est, 'medidas', 'Medidas que se van a aplicar', 'Qué se va a hacer, quién y cómo.', r.medidas, function (t) { r.medidas = t; alCambiar(); })]),
      texto.nodo, despues, sol
    ].filter(Boolean));
  }

  async function pintarPeticion(est, alVolver) {
    var p = est.peticionActual, tut = await g.Tutoria.leerTutoria(est.raiz);
    if (p) { await pintarEditor(est, alVolver, p, tut); return; }
    await pintarLista(est, alVolver, tut);
  }

  g.PantallaPeticion = { pintarPeticion: pintarPeticion };
})(window);
