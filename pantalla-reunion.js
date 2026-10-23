/* Reunión general con familias (fila 42): el acta con los 14 puntos ya escritos, lo que Inma añade a cada uno (Claude lo pule), los delegados, la asistencia
   del grupo y «Crear acta», que guarda el PDF y el Word en ACTAS › documentos (fila 57). La reunión se guarda sola en ACTAS/reuniones/. */
(function (g) {
  'use strict';
  var h = g.Dom.h, R = g.Reunion, T = g.Tutoria;

  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function fechaDe(iso) { try { return g.fechaLarga(iso); } catch (e) { return iso; } }
  function diaDe(marca) {
    var d = new Date(marca);
    return g.fechaCorta(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2));
  }

  /* --- la lista de reuniones del curso --- */
  async function pintarLista(est, alInicio, tut, reuniones) {
    var abrir = function (r) { est.reunionActual = r; est.reunionId = null; est.refrescar(); };
    var avisoLista = h('p', { class: 'suave', id: 'avisoLista' });
    var items = reuniones.map(function (r) {
      var confirmar = h('span', { class: 'confirmar', hidden: '' }), botones = h('span', { class: 'botones' });
      botones.appendChild(h('button', { type: 'button', class: 'boton principal', 'data-accion': 'abrir-reunion', texto: 'Abrir', onclick: function () { abrir(r); } }));
      if (r.estado === 'creada' && r.documentos) {
        ['pdf', 'docx'].forEach(function (t) {
          botones.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'abrir-' + t, texto: t === 'pdf' ? 'Abrir PDF' : 'Abrir Word', onclick: async function () {
            if ((await g.Envios.abrir(est.raiz, r, t)) === 'falta') avisoLista.textContent = 'No encuentro el fichero en la carpeta ACTAS.';
          } }));
        });
      }
      if (r.estado !== 'creada') {
        botones.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'borrar', texto: 'Borrar', onclick: function () { botones.hidden = true; confirmar.hidden = false; } }));
        confirmar.appendChild(h('span', { texto: '¿Borrar esta reunión? ' }));
        confirmar.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'si-borrar', texto: 'Sí, borrar', onclick: async function () { await R.borrar(est.raiz, r.id); est.refrescar(); } }));
        confirmar.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'no-borrar', texto: 'No', onclick: function () { confirmar.hidden = true; botones.hidden = false; } }));
      }
      return h('li', { class: 'borrador', 'data-id': r.id, 'data-estado': r.estado }, [
        h('div', { class: 'datos' }, [h('strong', { texto: 'Reunión del ' + fechaDe(r.fecha) }), h('span', { class: 'primero', texto: r.grupo }),
          h('span', { class: 'suave', texto: r.estado === 'creada' ? 'Creada el ' + diaDe(r.creada) : 'Sin crear' })]),
        botones, confirmar
      ]);
    });
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: alInicio }), h('h2', { class: 'subtitulo', texto: 'Reunión general con familias' })]),
      h('button', { type: 'button', class: 'boton principal grande', id: 'nuevaReunion', texto: 'Nueva reunión', onclick: async function () {
        await g.Rubricas.cargar(est);
        var l = est.alumnado && est.alumnado.lista;
        abrir(R.nueva(tut, est.ficha, l ? T.alumnadoDelGrupo(l, tut.grupo) : [], hoyIso(), new Date()));
      } }),
      h('button', { type: 'button', class: 'boton grande', id: 'libroReuniones', texto: 'Libro de reuniones con familias', onclick: function () { g.PantallaReunionLibro.pintar(est, tut, function () { est.refrescar(); }); } }),
      h('h2', { class: 'subtitulo', texto: 'Las de este curso' }),
      h('ul', { class: 'borradores', id: 'listaReuniones' }, items), avisoLista
    ]);
  }

  /* --- el editor --- */
  async function pintarEditor(est, alInicio, tut, r) {
    var rub = await g.Rubricas.cargar(est), lista = rub.lista, alumnos = lista ? T.alumnadoDelGrupo(lista, tut.grupo) : [];
    R.alinear(r, tut, est.ficha, alumnos);
    var cambio = g.Autoguardado.crear(est, r, R.guardar).cambio;
    var avisoClaude = g.Dom.aviso(), avisoCrear = g.Dom.aviso(), estado = h('span', { class: 'suave', id: 'estadoRedaccion' });
    var ocupado = false, avisosNombres = {}, preguntando = {}, zonaPregunta = h('div', { id: 'preguntaCrear' });
    var bloques = [], resumen = h('p', { class: 'suave', id: 'resumenAsistencia', 'aria-live': 'polite' });
    var botonRedactar = h('button', { type: 'button', class: 'boton principal', id: 'redactarReunion', texto: 'Redactar con Claude' });

    function decirError(x) {
      g.Dom.decir(avisoClaude, x && x.message ? x.message : String(x));
      if (x && x.tipo === 'clave') avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    }
    function pendientes() {
      return r.puntos.map(function (p, i) { return i; }).filter(function (i) { var p = r.puntos[i]; return R.hayAnadir(p) && (!String(p.redactado || '').trim() || R.notasCambiadas(p)); });
    }
    function conNotas() { return r.puntos.some(R.hayAnadir); }
    function pintarBotones() { botonRedactar.disabled = ocupado || !conNotas(); bloques.forEach(function (b) { b.pintarRedactado(); }); }

    /* Claude pule lo añadido en los puntos `indices`. */
    async function redactar(indices, otra) {
      ocupado = true; g.Dom.decir(avisoClaude, ''); estado.textContent = 'Claude está redactando…'; pintarBotones();
      try {
        var clave = await g.Datos.leerClave(est.raiz);
        var res = await g.ReunionClaude.redactar(clave, r, indices, lista ? lista.todos : [], { otraVersion: !!otra });
        Object.keys(res.parrafos).forEach(function (n) {
          var p = r.puntos[n - 1];
          p.redactado = res.parrafos[n]; p.notasRedactadas = R.firmaNotas(p); p.editado = false; avisosNombres[n] = res.avisos[n] || '';
        });
        cambio();
      } catch (x) { decirError(x); }
      finally { ocupado = false; estado.textContent = ''; pintarBotones(); }
    }
    botonRedactar.onclick = function () {
      var p = pendientes();
      if (!p.length) { g.Dom.decir(avisoClaude, 'Todo lo que has añadido ya está redactado. Si quieres otra redacción, usa «Otra versión» en el punto.'); return; }
      redactar(p, false);
    };

    /* Un punto: título, texto fijo (que se puede cambiar), lo que se añade y lo que Claude redactó */
    function bloque(i) {
      var def = R.PUNTOS[i], p = r.puntos[i], n = i + 1;
      var visto = h('div', { class: 'texto-enviado texto-fijo', 'data-fijo': String(n) });
      var edicion = h('textarea', { rows: '3', 'data-fijo-edit': String(n), hidden: '' }), volver = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'texto-original', texto: 'Volver al texto original', hidden: '' });
      var cambiar = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'cambiar-texto', texto: 'Cambiar el texto' });
      function pintarFijo() { visto.textContent = R.textoFijo(r, i); volver.hidden = !R.fijoCambiado(r, i); }
      cambiar.onclick = function () { edicion.hidden = !edicion.hidden; if (!edicion.hidden) { edicion.value = R.textoFijo(r, i); edicion.focus(); } };
      edicion.oninput = function () { p.fijo = edicion.value; pintarFijo(); cambio(); };
      volver.onclick = function () { p.fijo = null; edicion.value = def.texto; pintarFijo(); cambio(); };
      pintarFijo();

      var ed = g.EditorNotas.crear('r-' + n, p.anadir || '', function () { return est.alumnado; }, function (t) { p.anadir = t; cambio(); pintarBotones(); });
      var mas = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-alumno', texto: '+ Alumno', onclick: function () { ed.abrirBuscador(); } });
      mas.disabled = !(est.alumnado && est.alumnado.estado === 'ok');
      var pie = [h('span', { class: 'suave', texto: 'Nunca un nombre suelto sin elegirlo de la lista.' }), mas];
      if (g.Dictado.disponible()) {
        var mic = h('button', { type: 'button', class: 'boton chico mic', 'data-accion': 'dictar', title: 'Dictar', texto: '🎤 Dictar' });
        var d = g.Dictado.crear(ed.comoCaja, function (t) { p.anadir = t; cambio(); pintarBotones(); }, function (activo) { mic.classList.toggle('grabando', activo); mic.textContent = activo ? '⏹ Parar' : '🎤 Dictar'; });
        mic.onclick = function () { d.alternar(); };
        pie.push(mic);
      }
      var anadir = h('div', { class: 'caja-ayudas', 'data-caja': String(n) }, [
        h('strong', { texto: i === R.PUNTO_RUEGOS ? 'Añadir (sustituye a «' + def.texto + '»)' : 'Añadir' }), ed.elemento, h('div', { class: 'pie-punto' }, pie)]);

      var zonaRedactado = h('div', { class: 'redactado', 'data-redactado-de': String(n) });
      function pintarRedactado() {
        zonaRedactado.textContent = '';
        var hay = !!String(p.redactado || '').trim();
        if (!hay) return;
        var area = h('textarea', { rows: '4', 'data-redactado': String(n) }); area.value = p.redactado; area.readOnly = ocupado;
        area.oninput = function () { p.redactado = area.value; p.editado = true; cambio(); };
        zonaRedactado.appendChild(h('strong', { texto: 'Redactado por Claude (puedes corregirlo)' }));
        if (avisosNombres[n]) zonaRedactado.appendChild(h('div', { class: 'aviso', 'data-aviso-nombres': String(n), texto: avisosNombres[n] }));
        if (R.notasCambiadas(p)) zonaRedactado.appendChild(h('div', { class: 'aviso', 'data-notas-cambiadas': String(n), texto: 'Las notas han cambiado desde que Claude redactó este punto.' }));
        zonaRedactado.appendChild(area);
        var otra = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'otra-version', texto: 'Otra versión', onclick: function () { if (p.editado) { preguntando[n] = true; pintarRedactado(); } else redactar([i], true); } });
        var quitar = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'quitar-redaccion', texto: 'Quitar la redacción', onclick: function () { p.redactado = ''; p.notasRedactadas = ''; p.editado = false; cambio(); pintarBotones(); } });
        otra.disabled = ocupado;
        zonaRedactado.appendChild(h('div', { class: 'fila' }, [otra, quitar]));
        if (preguntando[n]) zonaRedactado.appendChild(h('div', { class: 'aviso pregunta', 'data-pregunta-sustituir': String(n) }, [
          h('span', { texto: 'Has corregido este texto a mano. ¿Sustituirlo por uno nuevo? ' }),
          h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'si-sustituir', texto: 'Sí, sustituir', onclick: function () { preguntando[n] = false; redactar([i], true); } }),
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'no-sustituir', texto: 'No', onclick: function () { preguntando[n] = false; pintarRedactado(); } })
        ]));
      }
      pintarRedactado();

      var nodos = [h('h3', { texto: n + '. ' + def.tituloAcuerdo }), visto, h('div', { class: 'fila' }, [cambiar, volver]), edicion];
      if (i === R.PUNTO_DELEGADOS) nodos.push(delegados());
      nodos.push(anadir, zonaRedactado);
      var b = h('section', { class: 'tarjeta ancha punto-reunion', 'data-punto': String(n) }, nodos);
      b.pintarRedactado = pintarRedactado;
      return b;
    }

    /* Punto 9: delegado/a y subdelegado/a */
    function delegados() {
      var vista = h('div', { class: 'texto-enviado', id: 'textoDelegados' });
      function pintarVista() { vista.textContent = R.lineasDelegados(r).join('\n'); }
      function fila(clave, titulo, id) {
        var d = r[clave];
        var sel = h('select', { id: id + 'Trato', 'aria-label': 'Tratamiento de ' + titulo }, [h('option', { value: '', texto: 'D. / Dª.' }), h('option', { value: 'D.', texto: 'D.' }), h('option', { value: 'Dª.', texto: 'Dª.' })]);
        sel.value = d.tratamiento || '';
        var nombre = h('input', { type: 'text', id: id + 'Nombre', placeholder: 'Nombre y apellidos', value: d.nombre || '' });
        sel.onchange = function () { d.tratamiento = sel.value; pintarVista(); cambio(); };
        nombre.oninput = function () { d.nombre = nombre.value; pintarVista(); cambio(); };
        return h('div', { class: 'fila delegado' }, [h('label', { class: 'campo' }, [titulo, h('span', { class: 'fila' }, [sel, nombre])])]);
      }
      pintarVista();
      return h('div', { class: 'delegados', id: 'delegados' }, [
        fila('delegado', 'Delegado/a de padres y madres', 'delegado'), fila('subdelegado', 'Subdelegado/a', 'subdelegado'),
        h('span', { class: 'suave', texto: 'Así saldrá en el acta (si no rellenas ninguno, queda «sin candidaturas»):' }), vista]);
    }

    /* Asistencia */
    function pintarResumen() {
      var c = R.contarAsistencia(r);
      resumen.textContent = c.total ? 'Asisten ' + c.si + ' familias de ' + c.total + (c.sinMarcar ? ' · ' + c.sinMarcar + ' sin marcar (saldrán como «no»)' : '') + '.' : '';
    }
    function asistencia() {
      var nodos = [h('h3', { texto: 'Asistencia de padres · ' + r.grupo })];
      if (!r.asistencia.length) nodos.push(h('div', { class: 'aviso', id: 'sinLista', texto: 'No tengo la lista del alumnado de ' + r.grupo + '. Abre la carpeta RÚBRICAS (en el inicio, «Fichas del alumnado») y vuelve a entrar. Sin ella, el anexo de asistencia saldrá vacío.' }));
      nodos.push(h('ul', { class: 'asistencia', id: 'listaAsistencia' }, r.asistencia.map(function (a, k) {
        function radio(valor, texto) {
          var x = h('input', { type: 'radio', name: 'asiste-' + k, value: valor, 'data-asiste': valor });
          x.checked = a.asiste === (valor === 'si');
          x.onchange = function () { a.asiste = valor === 'si'; pintarResumen(); cambio(); };
          return h('label', {}, [x, ' ' + texto]);
        }
        return h('li', { 'data-alumno': a.nombre }, [h('span', { class: 'nombre-asistente', texto: a.nombre }), h('span', { class: 'fila' }, [radio('si', 'sí'), radio('no', 'no')])]);
      })), resumen);
      pintarResumen();
      return h('section', { class: 'tarjeta ancha', id: 'asistencia' }, nodos);
    }

    /* Crear acta */
    var terminado = false;
    async function crear(sinAviso) {
      zonaPregunta.textContent = ''; g.Dom.decir(avisoCrear, '');
      var pr = R.problema(r);
      if (pr) { g.Dom.decir(avisoCrear, pr); return; }
      var previa = R.yaCreada(await R.listar(est.raiz), r);
      if (previa && !sinAviso) {
        zonaPregunta.appendChild(h('div', { class: 'aviso pregunta', id: 'reunionYaCreada' }, [
          h('span', { texto: 'Esta reunión ya se creó el ' + diaDe(previa.creada) + '. Si sigues, se guardarán otra vez sus ficheros. ' }),
          h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'seguir-crear', texto: 'Seguir', onclick: function () { crear(true); } }),
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'cancelar-crear', texto: 'Cancelar', onclick: function () { zonaPregunta.textContent = ''; } })
        ]));
        return;
      }
      try {
        await est.alSalir();
        var ahora = new Date();
        await g.ReunionDocs.crear(est.raiz, r, est.ficha, ahora);
      } catch (x) { g.Dom.decir(avisoCrear, 'No he podido crear el acta: ' + (x && x.message ? x.message : x)); return; }
      terminado = true; est.alSalir = null; est.estadoGuardado.textContent = '';
      var avisoAbrir = g.Dom.aviso();
      function abrirFichero(tipo) { return async function () { g.Dom.decir(avisoAbrir, (await g.Envios.abrir(est.raiz, r, tipo)) === 'falta' ? 'No encuentro el fichero en la carpeta ACTAS.' : ''); }; }
      g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [
        h('h2', { texto: 'Acta guardada en tu carpeta ACTAS' }),
        h('p', { id: 'reunionCreada', texto: 'La reunión del ' + fechaDe(r.fecha) + ' está en PDF y en Word, en la carpeta ACTAS › ' + r.documentos.curso + '.' }),
        h('div', { class: 'fila' }, [
          h('button', { type: 'button', class: 'boton principal', id: 'abrirPdf', texto: 'Abrir PDF', onclick: abrirFichero('pdf') }),
          h('button', { type: 'button', class: 'boton principal', id: 'abrirWord', texto: 'Abrir Word', onclick: abrirFichero('docx') }),
          h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: 'Volver al inicio', onclick: function () { est.reunionActual = null; alInicio(); } }),
          h('button', { type: 'button', class: 'boton', id: 'verReuniones', texto: 'Ver las reuniones', onclick: function () { est.reunionActual = null; est.refrescar(); } })
        ]), avisoAbrir
      ])]);
    }

    var fecha = h('input', { type: 'date', id: 'fechaReunion', value: r.fecha });
    fecha.onchange = function () { if (fecha.value) { r.fecha = fecha.value; cambio(); } };
    for (var i = 0; i < R.PUNTOS.length; i++) bloques.push(bloque(i));
    var nodos = [
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: async function () { await est.alSalir(); est.reunionActual = null; alInicio(); } }),
        h('h2', { class: 'subtitulo', 'data-reunion': 'titulo', texto: 'Reunión general con familias' }), estado]),
      h('section', { class: 'tarjeta ancha' }, [
        h('div', { class: 'cuatro' }, [h('label', { class: 'campo' }, ['Fecha de la reunión', fecha])]),
        h('p', { class: 'suave', id: 'datosReunion', texto: 'Grupo: ' + r.grupo + ' · Tutora: ' + (r.tutora || '(sin poner)') + ' · Localidad: ' + (r.localidad || '(sin poner)') + '. Se cambian en Ajustes y en los datos del curso.' }),
        h('p', { class: 'suave', texto: 'Los 14 puntos ya vienen escritos. Si algo cambia este año, usa «Cambiar el texto»; si quieres añadir algo, escríbelo en «Añadir».' })])
    ];
    var aviso = g.PantallaFichas.avisoRubricas(est, function () { est.refrescar(); });
    if (aviso) nodos.push(aviso);
    nodos = nodos.concat(bloques, [asistencia(), h('section', { class: 'tarjeta ancha' }, [h('div', { class: 'fila' }, [botonRedactar]), avisoClaude]), h('div', { class: 'zona-crear', id: 'zonaCrear' }, [
      h('button', { type: 'button', class: 'boton principal grande', id: 'crearReunion', texto: 'Crear acta', onclick: function () { crear(false); } }), avisoCrear, zonaPregunta])]);
    g.Dom.montar(nodos);
    pintarBotones();
  }

  async function pintarReunion(est, alInicio) {
    var salida = function () { est.reunionId = null; est.reunionActual = null; alInicio(); };
    var tut = await T.leerTutoria(est.raiz);
    if (!tut) {
      var repintar = function () { pintarReunion(est, alInicio); };
      g.Dom.montar([
        h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: salida }), h('h2', { class: 'subtitulo', texto: 'Reunión general con familias' })]),
        h('p', { id: 'pedirTutoria', texto: 'Antes de empezar, dime cuál es tu grupo de tutoría.' }), await g.PantallaTutoria.tarjeta(est, repintar, repintar)
      ]);
      return;
    }
    var r = est.reunionActual;
    if (!r && est.reunionId) r = await R.leer(est.raiz, est.reunionId);
    if (r) { est.reunionActual = r; await pintarEditor(est, salida, tut, r); return; }
    var delCurso = R.delCurso(await R.listar(est.raiz), (est.ficha && est.ficha.curso) || '');
    if (delCurso.length) { await pintarLista(est, salida, tut, delCurso); return; }
    await g.Rubricas.cargar(est);
    var l = est.alumnado && est.alumnado.lista;
    est.reunionActual = R.nueva(tut, est.ficha, l ? T.alumnadoDelGrupo(l, tut.grupo) : [], hoyIso(), new Date());
    await pintarEditor(est, salida, tut, est.reunionActual);
  }

  g.PantallaReunion = { pintarReunion: pintarReunion };
})(window);
