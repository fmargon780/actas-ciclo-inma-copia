/* La pestaña «Rúbricas» de Mis actas (fila 110): la puerta de «Pasar tus rúbricas aquí», el marco (curso, grupo elegido y los cinco pasos) y el paso que toque.
   Los datos viven en ACTAS/rubricas (ver pasar.js). Aquí se guarda lo que la docente tenía abierto (est.rub) para que, al volver de Inicio o de Ajustes, siga donde estaba. */
(function (g) {
  'use strict';
  var h = g.Dom.h;
  var $ = function (id) { return document.getElementById(id); };
  var PASOS = [['situacion', '1 · Situación'], ['criterio', '2 · Criterio'], ['actividad', '3 · Actividad'], ['rubrica', '4 · Rúbrica'], ['calificar', '5 · Calificar'], ['grupos', 'Mis grupos']];
  var TEXTO_PASAR = 'Tienes tus rúbricas en la carpeta RÚBRICAS. Voy a copiarlas a tu carpeta ACTAS, con tus grupos, actividades y notas de todos los cursos. Solo se hace una vez.';
  var FRASE_NO_ES = 'Esta no es tu carpeta de Rúbricas: está en Mi unidad › RÚBRICAS.';

  /* La sección de ayuda del paso que está abierto. */
  function seccionAyuda(est) { return 'rub-' + ((est.rub && est.rub.paso) || 'grupos'); }

  function montar(nodos) { var p = $('principal'); p.textContent = ''; nodos.forEach(function (n) { if (n) p.appendChild(n); }); }
  function puerta(titulo, parrafos, botones, extra) {
    montar([h('div', { class: 'vacio', id: 'puertaRubricas' }, [h('h2', { texto: titulo })].concat(parrafos, extra || [], botones.length ? [h('div', { class: 'fila' }, botones)] : []))]);
  }
  var parrafo = function (t, suave) { return h('p', { class: suave ? 'suave' : '', texto: t }); };
  var boton = function (texto, id, alPulsar, clase) { return h('button', { type: 'button', class: 'boton ' + (clase || 'principal'), id: id, texto: texto, onclick: alPulsar }); };

  /* La puerta para quien ya tenía la carpeta RÚBRICAS (o la ha vuelto a elegir). */
  function pintarPuerta(est, handle, fallo, solo) {
    var aviso = h('div', { class: 'aviso error', id: 'falloRubricas', hidden: '' });
    var pasar = async function () {
      var marca = null;
      puerta('Pasando tus rúbricas…', [parrafo('No cierres la app hasta que termine.')], []);
      try {
        if ((await g.Carpeta.permisoLectura(handle)) !== 'granted' && !(await g.Carpeta.pedirPermisoLectura(handle))) {
          pintarPuerta(est, handle, 'Sin permiso no puedo leer la carpeta RÚBRICAS. Pulsa el botón otra vez y, en la ventana de Chrome, elige «Permitir».'); return;
        }
        var origen = g.Carpeta.adaptador(handle);
        if ((await origen.leerTexto('rubricas.json')) == null) { pintarPuerta(est, handle, FRASE_NO_ES); return; }
        marca = await g.RubPasar.pasar(est, origen);
      } catch (e) { pintarFallo(est, handle); return; }
      try { await abrir(est, marca.cifras ? g.RubPasar.frase(marca.cifras) : ''); }
      catch (e) { montar([h('div', { class: 'vacio' }, [h('div', { class: 'aviso error', id: 'errorRubricas', texto: 'Tus rúbricas ya están en ACTAS, pero no he podido abrirlas. ' + (e.message || String(e)) })])]); }
    };
    if (solo) { pasar(); return; }
    if (fallo) { aviso.textContent = fallo; aviso.hidden = false; }
    puerta('Pasar tus rúbricas aquí', [parrafo(TEXTO_PASAR), parrafo('Tu carpeta RÚBRICAS no se toca: queda como copia de seguridad.', true), aviso], [boton('Pasar mis rúbricas', 'pasar', pasar)]);
  }
  function pintarFallo(est, handle) {
    puerta('No he podido pasar tus rúbricas', [parrafo('No se ha perdido nada: tu carpeta RÚBRICAS sigue como estaba. Puede que no haya espacio en tu Drive o que se haya cortado internet. Quito lo que había copiado a medias para empezar de cero.')],
      [boton('Volver a intentar', 'reintentar', function () { pintarPuerta(est, handle, '', true); })]);
  }

  /* Entrada de la pestaña. */
  async function pintar(est) {
    if (est.rub && est.rub.montar) { await est.rub.montar(); return; }
    var marca = await g.RubPasar.leerMarca(est, true); /* siempre del disco: otro dispositivo puede haberla puesto */
    var handle = await g.Carpeta.rubricasRecordada();
    if (marca && handle && await g.RubPasar.nuevaSinTrabajo(est)) { await g.RubPasar.volverAlPaso(est); marca = null; } /* otro dispositivo abrió Rúbricas vacía: aquí se pasa la carpeta de siempre */
    if (marca) { await abrir(est, ''); return; }
    if (handle) { pintarPuerta(est, handle); return; }
    /* Quien empieza de cero entra directo, con la lista vacía. */
    try { await g.RubPasar.empezarDeCero(est); await abrir(est, ''); }
    catch (e) { montar([h('div', { class: 'vacio' }, [h('div', { class: 'aviso error', id: 'errorRubricas', texto: 'No he podido preparar Rúbricas en tu carpeta ACTAS. ' + (e.message || String(e)) })])]); }
  }

  /* El «i» de ayuda de cada pantalla: dónde va cada uno (los textos están en ayuda.json, bloque «avisos»). */
  var AVISOS = [
    { sel: '.zona', aviso: function () { return g.Ayuda.aviso('rub-listado'); } },
    { sel: '#empezarCurso', despues: true, aviso: function () { return g.Ayuda.aviso('rub-cursoNuevo'); } },
    { sel: '#traerPasado', despues: true, aviso: function () { return g.Ayuda.aviso('rub-traer'); } },
    { sel: '#prepararSeneca, #prepararListado', despues: true, aviso: function () { return g.Ayuda.aviso('rub-seneca'); } },
    { sel: '#pedirClaude', despues: true, aviso: function () { return g.Ayuda.aviso('rub-claude'); } }
  ];
  function ponerAvisos() {
    AVISOS.forEach(function (a) {
      Array.prototype.forEach.call(document.querySelectorAll('#rubContenido ' + a.sel.split(',').join(', #rubContenido ')), function (el) {
        if (el.dataset.conAviso) return;
        var i = a.aviso();
        if (!i) return;
        el.dataset.conAviso = '1';
        if (a.despues) el.insertAdjacentElement('afterend', i); else el.appendChild(i);
      });
    });
  }

  /* Abre Rúbricas con los datos de ACTAS/rubricas. `avisoPaso`: el texto del aviso «Ya están aquí…» (vacío si no hay). */
  async function abrir(est, avisoPaso) {
    var raiz = await est.raiz.sub(g.RubPasar.DESTINO);
    var base = await g.Cursos.iniciar(raiz, { sinGrupos: true });
    var marca = await g.RubPasar.leerMarca(est);
    var rub = { raiz: raiz, raizActas: est.raiz, carpeta: null, config: null, configReal: base.config, cursos: base.cursos, curso: null, editable: true, grupos: [], actividad: null, rubrica: null, cuenta: {},
      grupo: null, area: null, paso: 'grupos', criterio: null, colegio: '', avisoPaso: avisoPaso || '' };
    est.rub = rub;
    rub.irAjustes = function () { return est.irAjustes(); };
    var refrescar, vigia = null;

    /* Quien empezó de cero y aún no ha trabajado puede pasar después su carpeta RÚBRICAS. */
    if (marca && marca.origen === 'nuevo') {
      rub.yaTeniaRubricas = async function (dicho) {
        try {
          var handle = await g.Carpeta.elegirRubricas();
          if ((await g.Carpeta.adaptador(handle).leerTexto('rubricas.json')) == null) { dicho(FRASE_NO_ES); return; }
          if (await g.RubPasar.hayTrabajo(raiz)) { dicho('Aquí ya hay trabajo guardado: no se puede pasar encima. Tu carpeta RÚBRICAS no se ha tocado.'); return; }
          await g.Carpeta.guardarRubricas(handle);
          await g.RubPasar.volverAlPaso(est);
          est.rub = null;
          pintarPuerta(est, handle);
        } catch (e) { if (e && e.name === 'AbortError') return; dicho(e.message || String(e)); }
      };
    }

    var cargarColegio = async function () { try { var c = await g.Colegio.leer(est.raiz); rub.colegio = (c && c.nombre) || ''; } catch (e) { rub.colegio = ''; } };
    var verCurso = async function (curso) {
      var c = await g.Cursos.abrir(raiz, rub.configReal, curso);
      rub.curso = curso; rub.carpeta = c.carpeta; rub.editable = c.editable; rub.grupos = c.grupos; rub.config = c.config;
      rub.anterior = c.editable ? await g.Cursos.puedeDeshacer(raiz, rub.configReal) : null;
      rub.cursos = await g.Cursos.listarCursos(raiz);
      rub.actividad = rub.rubrica = rub.criterio = rub.situacion = rub.enlace = rub.grupo = rub.area = null; rub.situacionNueva = false; rub.paso = 'grupos';
    };
    var pintarCabeceraCurso = function () {
      var sel = $('selectorCurso'), aviso = $('avisoCurso');
      sel.textContent = '';
      rub.cursos.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; o.selected = c === rub.curso; sel.appendChild(o); });
      sel.onchange = function () { verCurso(sel.value).then(function () { return refrescar(); }).catch(function (e) { g.RubPantalla.error(e.message || String(e)); }); };
      aviso.textContent = ''; aviso.hidden = rub.editable;
      if (!rub.editable) {
        var volver = h('button', { type: 'button', class: 'boton', id: 'volverActual', texto: 'Volver al curso ' + rub.configReal.cursoActual, onclick: function () { verCurso(rub.configReal.cursoActual).then(function () { return refrescar(); }); } });
        aviso.appendChild(h('span', { texto: 'Curso ' + rub.curso + ' · solo para consultar' })); aviso.appendChild(volver);
      }
    };
    rub.empezarCurso = async function (nombre) {
      rub.configReal = await g.Cursos.empezar(raiz, rub.configReal, nombre, rub.grupos);
      await verCurso(rub.configReal.cursoActual); await refrescar();
    };
    rub.deshacerCurso = async function () {
      rub.configReal = await g.Cursos.deshacer(raiz, rub.configReal);
      await verCurso(rub.configReal.cursoActual); await refrescar();
    };

    var pintarPaso = async function () {
      var p = rub.paso;
      if (p === 'hoja') await cargarColegio(); /* el colegio de la hoja sale de «Datos del colegio» */
      PASOS.forEach(function (x) { $('paso' + x[0].charAt(0).toUpperCase() + x[0].slice(1)).classList.toggle('activo', p === x[0]); });
      $('pasoActividad').disabled = !(rub.criterio || rub.actividad);
      $('pasoRubrica').disabled = !rub.actividad;
      $('pasoCalificar').disabled = !rub.actividad;
      if (p === 'situacion') { await g.PantallaSituacion.pintarSituacion(rub, refrescar); return; }
      if (p === 'criterio') { await g.PantallaCriterio.pintarCriterio(rub, refrescar); return; }
      if (p === 'actividad') { await g.PantallaActividad.pintarActividad(rub, refrescar); return; }
      if (p === 'hoja') { await g.PantallaHoja.pintarHoja(rub, refrescar); return; }
      if (p === 'rubrica') { await g.PantallaRubrica.pintarRubrica(rub, refrescar); return; }
      if (p === 'calificar') { await g.PantallaCalificar.pintarCalificar(rub, refrescar); return; }
      rub.cuenta = await g.RubDatos.contarAlumnos(rub.carpeta, rub.grupos);
      g.RubPantalla.pintarGrupos(rub, refrescar);
      g.Rubricas.cargar(est).catch(function () { /* el alumnado de Mis actas se pone al día con lo que se acaba de cambiar; si falla, ya se verá en su pantalla */ });
    };
    refrescar = async function () {
      try { pintarCabeceraCurso(); await pintarPaso(); } catch (e) { g.RubPantalla.error(e.message || String(e)); return; }
      ponerAvisos();
    };
    rub.refrescar = refrescar;

    /* El marco: curso, grupo elegido, los pasos y el aviso de «Ya están aquí…». Se vuelve a montar cada vez que se entra en la pestaña. */
    rub.montar = async function () {
      if (vigia) vigia.disconnect();
      var pasos = PASOS.map(function (x) {
        return h('button', { type: 'button', id: 'paso' + x[0].charAt(0).toUpperCase() + x[0].slice(1), 'data-paso': x[0], texto: x[1],
          onclick: function () { if (x[0] === 'criterio') rub.enlace = null; rub.paso = x[0]; refrescar(); } });
      });
      var aviso = rub.avisoPaso ? h('div', { class: 'aviso ok aviso-paso', id: 'avisoPaso' }, [h('span', { texto: rub.avisoPaso }),
        h('button', { type: 'button', class: 'boton', id: 'cerrarAviso', texto: 'Entendido', onclick: function () { rub.avisoPaso = ''; var a = $('avisoPaso'); if (a) a.remove(); } })]) : null;
      montar([h('div', { id: 'rubricas', class: 'rub' }, [
        h('div', { class: 'rub-barra' }, [
          h('div', { class: 'rub-fila' }, [h('label', { class: 'curso-sel' }, ['Curso ', h('select', { id: 'selectorCurso', 'aria-label': 'Curso' })]), h('div', { class: 'seleccion', id: 'seleccion', texto: 'Sin grupo elegido' })]),
          h('nav', { class: 'pasos-r', id: 'pasos', 'aria-label': 'Pasos de rúbricas' }, pasos),
          h('div', { class: 'aviso-curso', id: 'avisoCurso', hidden: '' })
        ]),
        aviso, h('div', { id: 'rubContenido' })
      ])]);
      g.RubPantalla.mostrarSeleccion(rub); /* el grupo y el área elegidos se ven en cualquier paso */
      vigia = g.SoloConsulta.vigilar($('rubContenido'), function () { return !rub.editable; });
      await g.Criterios.cargar();
      await refrescar();
    };

    await verCurso(base.config.cursoActual);
    await rub.montar();
  }

  g.RubTab = { pintar: pintar, seccionAyuda: seccionAyuda, TEXTO_PASAR: TEXTO_PASAR };
})(window);
