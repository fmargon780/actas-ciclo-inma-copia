/* Entrevista con la familia (fila 40): Inma elige a un alumno de su tutoría, toma notas cortas en tres cajas, Claude redacta los tres textos de Séneca
   y cada uno se copia con «Copiar». La entrevista se guarda sola en ACTAS/entrevistas/ y, terminada, queda en la ficha del alumno. */
(function (g) {
  'use strict';
  var h = g.Dom.h, T = g.Tutoria, E = g.Entrevista, F = g.Fichas, A = g.Alumnado;
  var NOMBRE_QUIEN = { tutora: 'tutora', familia: 'familia' };

  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function fechaDe(iso) { try { return g.fechaLarga(iso); } catch (e) { return iso; } }

  /* Copia el texto tal como Séneca lo entiende (texto plano, párrafos separados); con `tal`, tal cual está (el resumen para el ciclo, fila 61). */
  async function copiarTexto(texto, tal) {
    var plano = tal ? String(texto) : E.textoParaSeneca(texto);
    try { await g.navigator.clipboard.writeText(plano); return true; } catch (e) { /* se prueba el modo antiguo */ }
    try {
      var t = document.createElement('textarea'); t.value = plano; document.body.appendChild(t); t.select();
      var ok = document.execCommand('copy'); t.remove(); return !!ok;
    } catch (e) { return false; }
  }

  /* --- paso 1: elegir al alumno --- */
  async function pintarEleccion(est, alInicio, tut) {
    var repintar = function () { pintarEntrevista(est, alInicio); };
    await g.Rubricas.cargar(est);
    var lista = est.alumnado && est.alumnado.lista;
    var delGrupo = { estado: 'ok', lista: { delCiclo: lista ? T.alumnadoDelGrupo(lista, tut.grupo) : [], grupos: [] } };
    var buscador = g.BuscadorAlumno.crear('', function () { return delGrupo; }, function (alumno) { elegido(alumno); }, alInicio, { sinLibre: true });
    var zona = h('div', { id: 'zonaEleccion' });
    async function elegido(alumno) {
      var todas = await T.listarEntrevistas(est.raiz), previa = T.sinTerminar(todas, alumno);
      if (!previa) { empezar(T.nueva(alumno, hoyIso(), new Date())); return; }
      zona.textContent = '';
      zona.appendChild(h('div', { class: 'aviso pregunta', id: 'entrevistaSinTerminar' }, [
        h('span', { texto: 'Hay una entrevista sin terminar de ' + A.etiqueta(alumno) + ' (' + fechaDe(previa.fecha) + '). ' }),
        h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'seguir-entrevista', texto: 'Seguir con la entrevista sin terminar', onclick: function () { empezar(previa); } }),
        h('button', { type: 'button', class: 'boton chico peligro', 'data-accion': 'descartar-entrevista', texto: 'Descartarla y empezar otra', onclick: async function () {
          await T.borrarEntrevista(est.raiz, previa.id); empezar(T.nueva(alumno, hoyIso(), new Date()));
        } })
      ]));
    }
    function empezar(e) { est.entrevistaId = null; est.entrevistaActual = e; pintarEntrevista(est, alInicio); }
    var nodos = [
      h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: alInicio }), h('h2', { class: 'subtitulo', texto: 'Entrevista con la familia' })]),
      h('p', { class: 'suave', texto: 'Tu tutoría: ' + tut.grupo + (tut.tutora ? ' · ' + tut.tutora : '') + '. Se cambia en Ajustes.' }),
      h('p', { texto: '¿De qué alumno es la entrevista?' })
    ];
    var aviso = g.PantallaFichas.avisoRubricas(est, repintar);
    if (aviso) nodos.push(aviso);
    if (lista && !delGrupo.lista.delCiclo.length) nodos.push(h('div', { class: 'aviso', id: 'grupoVacio', texto: 'No hay alumnado de ' + tut.grupo + ' en la lista de Rúbricas. Revisa tu grupo en Ajustes.' }));
    nodos.push(buscador.elemento, zona);
    g.Dom.montar(nodos);
    buscador.enfocar();
  }

  /* --- paso 2: la entrevista --- */
  async function pintarEditor(est, alInicio, tut, e) {
    var todas = await T.listarEntrevistas(est.raiz);
    var actas = await F.leerActas(est.raiz, est.ficha), curso = (est.ficha && est.ficha.curso) || '';
    var rub = await g.Rubricas.cargar(est);
    var cambio = g.Autoguardado.crear(est, e, T.guardarEntrevista).cambio;
    var ocupado = false, avisoNombres = '', preguntando = null;
    var avisoClaude = g.Dom.aviso(), estado = h('span', { class: 'suave', id: 'estadoRedaccion' });
    var zonaTextos = h('div', { id: 'textosEntrevista' }), zonaCompromisos = h('div', { id: 'compromisosEntrevista' });
    var zonaAcciones = h('div', { class: 'fila', id: 'accionesRedaccion' }), zonaPregunta = h('div', { id: 'preguntaRedaccion' });
    var zonaFin = h('div', { class: 'zona-crear', id: 'zonaFin' });

    function decirError(x) {
      g.Dom.decir(avisoClaude, x && x.message ? x.message : String(x));
      if (x && x.tipo === 'clave') avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    }

    /* Una caja de notas con dictado y «+ Alumno» (el alumnado elegido de la lista viaja a Claude solo con iniciales). */
    function caja(clave, titulo, ayuda) {
      var ed = g.EditorNotas.crear('e-' + clave, e.notas[clave] || '', function () { return est.alumnado; }, function (t) { e.notas[clave] = t; cambio(); pintarAvisoNotas(); });
      var mas = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-alumno', texto: '+ Alumno', onclick: function () { ed.abrirBuscador(); } });
      mas.disabled = !(est.alumnado && est.alumnado.estado === 'ok');
      var pie = [h('span', { class: 'suave', texto: 'Nunca un nombre suelto sin elegirlo de la lista.' }), mas];
      if (g.Dictado.disponible()) {
        var mic = h('button', { type: 'button', class: 'boton chico mic', 'data-accion': 'dictar', title: 'Dictar', texto: '🎤 Dictar' });
        var d = g.Dictado.crear(ed.comoCaja, function (t) { e.notas[clave] = t; cambio(); pintarAvisoNotas(); }, function (activo) { mic.classList.toggle('grabando', activo); mic.textContent = activo ? '⏹ Parar' : '🎤 Dictar'; });
        mic.onclick = function () { d.alternar(); };
        pie.push(mic);
      }
      return h('div', { class: 'caja-ayudas', 'data-caja': clave }, [h('strong', { texto: titulo }), ayuda ? h('span', { class: 'suave', texto: ayuda }) : null, ed.elemento, h('div', { class: 'pie-punto' }, pie)]);
    }
    var avisoNotas = h('div', { class: 'aviso', id: 'avisoNotasCambiadas', hidden: '' });
    function pintarAvisoNotas() { botonesRedaccion(); avisoNotas.hidden = !(E.hayTextos(e.textos) && E.firmaNotas(e.notas) !== e.notasRedactadas); avisoNotas.textContent = 'Las notas han cambiado desde que Claude redactó los textos.'; }

    /* Redactar con Claude */
    async function redactar(otra) {
      preguntando = null; ocupado = true; g.Dom.decir(avisoClaude, ''); estado.textContent = 'Claude está redactando…'; pintarRedaccion();
      try {
        var clave = await g.Claude.claveDe(est.raiz);
        var res = await g.EntrevistaClaude.redactar(clave, e, rub.lista ? rub.lista.todos : [], { otraVersion: !!otra, estilo: await g.Estilo.paraClaude(est.raiz, rub.lista ? rub.lista.todos : []) });
        var antes = {};
        F.CAJAS_ENTREVISTA.forEach(function (c) { antes[c[0]] = e.textos[c[0]]; });
        E.ponerTextos(e, res.textos); e.editado = false;
        F.CAJAS_ENTREVISTA.forEach(function (c) { g.Retoque.cambiar(e, c[0], antes[c[0]], e.textos[c[0]]); }); /* «Deshacer» de cada caja recoge también este cambio */ e.notasRedactadas = E.firmaNotas(e.notas); avisoNombres = res.aviso || '';
        cambio();
      } catch (x) { decirError(x); }
      finally { ocupado = false; estado.textContent = ''; pintarRedaccion(); pintarAvisoNotas(); }
    }
    function pedir(otra) {
      if (e.editado && E.hayTextos(e.textos)) { preguntando = otra ? 'otra' : 'nueva'; pintarRedaccion(); return; }
      redactar(otra);
    }
    /* Los botones de Claude se activan en cuanto hay alguna nota escrita. */
    function botonesRedaccion() {
      Array.prototype.forEach.call(zonaAcciones.querySelectorAll('button'), function (b) { b.disabled = ocupado || !E.hayNotas(e.notas); });
    }
    function pintarRedaccion() {
      zonaAcciones.textContent = ''; zonaPregunta.textContent = '';
      var hay = E.hayTextos(e.textos);
      var principal = h('button', { type: 'button', class: 'boton principal', id: 'redactarEntrevista', texto: hay ? 'Redactar de nuevo' : 'Redactar con Claude', onclick: function () { pedir(false); } });
      principal.disabled = ocupado || !E.hayNotas(e.notas);
      zonaAcciones.appendChild(principal);
      if (hay) {
        var otra = h('button', { type: 'button', class: 'boton', 'data-accion': 'otra-version', texto: 'Otra versión', onclick: function () { pedir(true); } });
        otra.disabled = ocupado || !E.hayNotas(e.notas); zonaAcciones.appendChild(otra);
      }
      if (preguntando) {
        var otraV = preguntando === 'otra';
        zonaPregunta.appendChild(h('div', { class: 'aviso pregunta', id: 'preguntaSustituir' }, [
          h('span', { texto: 'Has cambiado algún texto a mano. ¿Sustituirlo por uno nuevo? ' }),
          h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'si-sustituir', texto: 'Sí, sustituir', onclick: function () { redactar(otraV); } }),
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'no-sustituir', texto: 'No', onclick: function () { preguntando = null; pintarRedaccion(); } })
        ]));
      }
      pintarTextos(); pintarCompromisos(); pintarFin();
    }

    /* «Más escueto», «Desarrolla más»… junto a cada texto (fila 64): Claude parte del texto tal como está, con las correcciones a mano. */
    function barraRetoque(clave) {
      return g.PantallaRetoque.barra({
        est: est, id: 'seneca-' + clave, almacen: e, clave: clave, ocupado: ocupado, limite: g.Retoque.LIMITE_SENECA, todos: function () { return rub.lista ? rub.lista.todos : []; },
        leer: function () { return e.textos[clave] || ''; },
        escribir: function (t, aviso) { E.editarTexto(e, clave, t); avisoNombres = aviso || ''; },
        ocupar: function (si) { ocupado = si; if (si) g.Dom.decir(avisoClaude, ''); estado.textContent = si ? 'Claude está cambiando el texto…' : ''; pintarRedaccion(); pintarAvisoNotas(); },
        alCambiar: function () { cambio(); pintarRedaccion(); pintarAvisoNotas(); }, error: decirError
      });
    }

    /* Los tres textos finales, cada uno con «Copiar» */
    function pintarTextos() {
      zonaTextos.textContent = '';
      if (!E.hayTextos(e.textos)) return;
      if (avisoNombres) zonaTextos.appendChild(h('div', { class: 'aviso', 'data-aviso-nombres': '1', texto: avisoNombres }));
      F.CAJAS_ENTREVISTA.forEach(function (c) {
        var clave = c[0], area = h('textarea', { rows: '8', 'data-texto': clave, placeholder: '(vacía)' });
        area.value = e.textos[clave] || ''; area.readOnly = ocupado;
        var dicho = h('span', { class: 'suave', 'data-copiado': clave, 'aria-live': 'polite' });
        var copiar = h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'copiar', 'data-copiar': clave, texto: 'Copiar', onclick: async function () {
          dicho.textContent = (await copiarTexto(area.value)) ? 'Copiado' : 'No he podido copiar';
        } });
        area.oninput = function () { E.editarTexto(e, clave, area.value); e.editado = true; dicho.textContent = ''; cambio(); pintarCompromisos(); pintarFin(); pintarAvisoNotas(); };
        var partes = [h('div', { class: 'cabeza-hueco' }, [h('strong', { texto: c[1] }), h('span', { class: 'fila' }, [dicho, copiar])]), area];
        if (String(e.textos[clave] || '').trim()) partes.push(barraRetoque(clave));
        zonaTextos.appendChild(h('div', { class: 'texto-seneca', 'data-seneca': clave }, partes));
      });
    }

    /* Los compromisos de esta entrevista, con su casilla */
    function pintarCompromisos() {
      zonaCompromisos.textContent = '';
      if (!e.compromisos.length) return;
      zonaCompromisos.appendChild(h('h3', { texto: 'Compromisos de esta entrevista' }));
      zonaCompromisos.appendChild(h('ul', { class: 'compromisos' }, e.compromisos.map(function (c, i) {
        var casilla = h('input', { type: 'checkbox', 'data-compromiso': String(i) }); casilla.checked = !!c.hecho;
        casilla.onchange = function () { c.hecho = casilla.checked; cambio(); };
        return h('li', {}, [h('label', {}, [casilla, ' ', h('strong', { texto: NOMBRE_QUIEN[c.quien] + ': ' }), c.texto])]);
      })));
    }

    /* Terminar */
    var terminada = false;
    function pintarFin() {
      zonaFin.textContent = '';
      if (terminada) return;
      var cierra = h('button', { type: 'button', class: 'boton principal grande', id: 'terminarEntrevista', texto: e.estado === 'terminada' ? 'Guardar y volver al inicio' : 'Entrevista terminada', onclick: async function () {
        if (!E.hayTextos(e.textos)) { g.Dom.decir(avisoClaude, 'Redacta antes los textos con Claude, o escríbelos tú, y luego termina la entrevista.'); return; }
        e.estado = 'terminada'; terminada = true;
        await est.alSalir(); await T.guardarEntrevista(est.raiz, e, new Date()); est.alSalir = null; est.estadoGuardado.textContent = '';
        g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [
          h('h2', { texto: 'Entrevista terminada' }),
          h('p', { id: 'entrevistaTerminada', texto: 'Queda guardada y ya sale en la ficha de ' + A.etiqueta(e.alumno) + '. Sus compromisos aparecerán como pendientes en la próxima entrevista.' }),
          h('div', { class: 'fila' }, [
            h('button', { type: 'button', class: 'boton principal', id: 'volverInicio', texto: 'Volver al inicio', onclick: alInicio }),
            h('button', { type: 'button', class: 'boton', id: 'verFicha', texto: 'Ver su ficha', onclick: function () { est.abrirFichas(); } })
          ])
        ])]);
      } });
      zonaFin.appendChild(cierra);
    }

    /* Cabecera: fecha y género */
    var fecha = h('input', { type: 'date', id: 'fechaEntrevista', value: e.fecha });
    fecha.onchange = function () { if (fecha.value) { e.fecha = fecha.value; cambio(); } };
    var genero = h('select', { id: 'generoAlumno' }, [h('option', { value: 'o', texto: 'El alumno' }), h('option', { value: 'a', texto: 'La alumna' })]);
    genero.value = e.alumno.genero === 'a' ? 'a' : 'o';
    genero.onchange = function () { e.alumno.genero = genero.value; cambio(); };

    /* Para preparar la entrevista: la ficha y los pendientes de antes */
    var entrevistasAlumno = T.terminadas(T.deAlumno(todas, e.alumno));
    var ficha = F.ficha(actas, e.alumno, curso, entrevistasAlumno.filter(function (x) { return x.id !== e.id; }));
    var pend = T.pendientes(todas, e.alumno, e.id);
    var listaPend = h('ul', { class: 'compromisos', id: 'listaPendientes' }, pend.map(function (p) {
      var casilla = h('input', { type: 'checkbox', 'data-pendiente': p.entrevistaId + ':' + p.indice });
      casilla.onchange = async function () {
        var otra = await T.leerEntrevista(est.raiz, p.entrevistaId);
        if (otra && otra.compromisos && otra.compromisos[p.indice]) { otra.compromisos[p.indice].hecho = casilla.checked; await T.guardarEntrevista(est.raiz, otra, new Date()); }
      };
      return h('li', {}, [h('label', {}, [casilla, ' ', h('span', { class: 'suave', texto: fechaDe(p.fecha) + ' · ' }), h('strong', { texto: NOMBRE_QUIEN[p.quien] + ': ' }), p.texto])]);
    }));
    var previa = [
      h('details', { class: 'mes-habitual', id: 'fichaPrevia' }, [h('summary', { texto: 'Lo dicho de ' + A.etiqueta(e.alumno) + ' en las actas y entrevistas' }), h('div', { class: 'texto-enviado', id: 'fichaTexto', texto: F.aTexto(ficha) })]),
      h('details', { class: 'mes-habitual', id: 'pendientes' }, [h('summary', { texto: 'Compromisos pendientes de entrevistas anteriores (' + pend.length + ')' }),
        pend.length ? listaPend : h('p', { class: 'suave', texto: 'No hay compromisos pendientes.' })])
    ];
    if (pend.length) previa[1].setAttribute('open', '');

    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: async function () { await est.alSalir(); alInicio(); } }),
        h('h2', { class: 'subtitulo', 'data-entrevista': 'titulo', texto: 'Entrevista con la familia de ' + A.etiqueta(e.alumno) }), estado
      ]),
      h('section', { class: 'tarjeta ancha' }, [h('div', { class: 'cuatro' }, [h('label', { class: 'campo' }, ['Fecha de la entrevista', fecha]), h('label', { class: 'campo' }, ['En los textos se le llamará', genero])])]
        .concat(previa)),
      h('section', { class: 'tarjeta ancha' }, [
        h('h3', { texto: 'Tus notas' }), h('p', { class: 'suave', texto: 'Notas cortas. Lo demás (quién la pidió, asistentes, hora) lo pones en Séneca.' }),
        caja('temas', 'Temas tratados', 'Información académica, actitud, trabajo, relaciones…'),
        h('strong', { texto: 'Decisiones y acuerdos alcanzados' }),
        caja('tutora', 'Compromisos de la tutora'), caja('familia', 'Compromisos de la familia'),
        caja('otros', 'Otros datos de interés', 'Información que aporta la familia.')
      ]),
      avisoNotas, avisoClaude,
      h('section', { class: 'tarjeta ancha' }, [h('h3', { texto: 'Los tres textos para Séneca' }), zonaAcciones, zonaPregunta, zonaTextos, zonaCompromisos]),
      zonaFin
    ]);
    pintarRedaccion(); pintarAvisoNotas();
  }

  async function pintarEntrevista(est, alInicio) {
    var salida = function () { est.entrevistaId = null; est.entrevistaActual = null; alInicio(); };
    var tut = await T.leerTutoria(est.raiz);
    if (!tut) {
      var repintar = function () { pintarEntrevista(est, alInicio); };
      g.Dom.montar([
        h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: salida }), h('h2', { class: 'subtitulo', texto: 'Entrevista con la familia' })]),
        h('p', { id: 'pedirTutoria', texto: 'Antes de empezar, dime cuál es tu grupo de tutoría.' }), await g.PantallaTutoria.tarjeta(est, repintar, repintar)
      ]);
      return;
    }
    var e = est.entrevistaActual;
    if (!e && est.entrevistaId) e = await T.leerEntrevista(est.raiz, est.entrevistaId);
    if (e) { est.entrevistaActual = e; await pintarEditor(est, salida, tut, e); return; }
    await pintarEleccion(est, salida, tut);
  }

  g.PantallaEntrevista = { pintarEntrevista: pintarEntrevista, copiarTexto: copiarTexto };
})(window);
