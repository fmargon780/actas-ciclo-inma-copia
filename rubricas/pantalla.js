/* Las pantallas. Por ahora solo funciona «Mis grupos»; los demás pasos se activan en las filas 2 a 5.
   Todo el texto de los alumnos entra con textContent, nunca como HTML. */
(function (g) {
  'use strict';
  var D = g.RubDatos, S = g.Seneca;
  var $ = function (id) { return document.getElementById(id); };

  function h(etiqueta, atributos, hijos) {
    var e = document.createElement(etiqueta);
    Object.keys(atributos || {}).forEach(function (k) {
      if (k === 'texto') e.textContent = atributos[k];
      else if (k.indexOf('on') === 0) e[k] = atributos[k];
      else e.setAttribute(k, atributos[k]);
    });
    (hijos || []).forEach(function (x) { if (x) e.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
    return e;
  }
  function montar(nodos) { var p = $('rubContenido'); p.textContent = ''; nodos.forEach(function (n) { if (n) p.appendChild(n); }); }

  function error(texto) { montar([h('div', { class: 'vacio' }, [h('div', { class: 'aviso error', texto: texto }), h('button', { type: 'button', class: 'boton', texto: 'Volver a intentarlo', onclick: function () { location.reload(); } })])]); }

  function mostrarSeleccion(est) {
    var gr = est.grupos.filter(function (x) { return x.id === est.grupo; })[0];
    var ar = gr && gr.areas.filter(function (a) { return a.id === est.area; })[0];
    $('seleccion').textContent = gr ? gr.nombre + (ar ? ' · ' + ar.nombre : '') : 'Sin grupo elegido';
  }

  /* est = { carpeta, grupos, cuenta, grupo, area }. `refrescar` vuelve a pintar. */
  function pintarGrupos(est, refrescar) {
    mostrarSeleccion(est);
    var guardar = async function (grupos) { est.grupos = grupos; await D.guardarGrupos(est.carpeta, grupos); await refrescar(); };
    var intentar = function (fn) { return async function () { try { await fn(); } catch (e) { $('mensaje').textContent = e.message || String(e); $('mensaje').hidden = false; } }; };

    var tarjetas = est.grupos.map(function (gr) {
      var aviso = h('div', { class: 'aviso error', hidden: '' });
      var subir = h('input', { type: 'file', accept: '.csv,.xls,.txt,.tsv', hidden: '' });
      var manual = h('textarea', { placeholder: 'Un nombre por línea', hidden: '' });
      var zona = h('div', { class: 'zona', texto: 'Suelta aquí el listado de Séneca (CSV o XLS) o pulsa para elegirlo' });
      var decir = function (t) { aviso.textContent = t; aviso.hidden = !t; };

      var guardarNombres = async function (nombres) {
        await D.guardarAlumnado(est.carpeta, gr.id, nombres);
        est.cuenta[gr.id] = nombres.length;
        await refrescar();
      };
      var leerFichero = async function (f) {
        decir('');
        var r = S.reconocerAlumnos(new Uint8Array(await f.arrayBuffer()));
        if (r.ok) await guardarNombres(r.nombres);
        else { decir(r.motivo); manual.hidden = false; botonManual.hidden = false; }
      };
      var botonManual = h('button', { type: 'button', class: 'boton principal', hidden: '', texto: 'Guardar estos nombres', onclick: intentar(async function () {
        var n = S.nombresDeTexto(manual.value);
        if (!n.length) { decir('Escribe al menos un nombre.'); return; }
        await guardarNombres(n);
      }) });
      zona.onclick = function () { subir.click(); };
      zona.ondragover = function (e) { e.preventDefault(); zona.classList.add('encima'); };
      zona.ondragleave = function () { zona.classList.remove('encima'); };
      zona.ondrop = function (e) { e.preventDefault(); zona.classList.remove('encima'); if (e.dataTransfer.files[0]) intentar(function () { return leerFichero(e.dataTransfer.files[0]); })(); };
      subir.onchange = function () { if (subir.files[0]) intentar(function () { return leerFichero(subir.files[0]); })(); };

      var editable = est.editable !== false;
      var areas = gr.areas.map(function (a) {
        var elegida = est.grupo === gr.id && est.area === a.id;
        return h('span', { class: 'area' + (elegida ? ' elegida' : '') }, [
          h('button', { type: 'button', texto: a.nombre, onclick: function () { est.grupo = gr.id; est.area = a.id; mostrarSeleccion(est); refrescar(); } }),
          editable ? h('button', { type: 'button', class: 'quitar', title: 'Quitar el área', 'aria-label': 'Quitar ' + a.nombre, texto: '✕', onclick: intentar(function () { if (est.area === a.id && est.grupo === gr.id) est.area = null; return guardar(D.quitarArea(est.grupos, gr.id, a.id)); }) }) : null
        ]);
      });
      var cabecera = h('h2', {}, [gr.nombre, h('span', { class: 'cuenta', texto: (est.cuenta[gr.id] || 0) + ' alumnos' })]);
      if (!editable) return h('div', { class: 'tarjeta', 'data-grupo': gr.id }, [cabecera, h('div', { class: 'areas' }, areas)]);

      var nombreNuevo = h('input', { type: 'text', value: gr.nombre, 'aria-label': 'Nombre del grupo ' + gr.nombre });
      var cambiarNombre = h('div', { class: 'fila cambiar-grupo' }, [nombreNuevo, h('button', { type: 'button', class: 'boton', texto: 'Cambiar nombre', onclick: intentar(async function () {
        if (nombreNuevo.value.trim() === gr.nombre) return;
        if ((est.cuenta[gr.id] || 0) > 0 || await enUso(est, gr.id)) throw new Error('El grupo ' + gr.nombre + ' ya tiene alumnado o trabajo: no se puede cambiar su nombre. Quítalo y añade el nuevo.');
        var lista = D.renombrarGrupo(est.grupos, gr.id, nombreNuevo.value);
        if (est.grupo === gr.id) { est.grupo = null; est.area = null; }
        return guardar(lista);
      }) })]);
      var n = parseInt(gr.nombre, 10), catalogo = isNaN(n) ? [] : g.Criterios.areas().filter(function (a) { return g.Criterios.cursos(a.id).indexOf(n) >= 0; });
      var marcar = h('div', { class: 'marcar-areas', 'aria-label': 'Áreas de ' + gr.nombre }, catalogo.length ? catalogo.map(function (a) {
        var c = h('input', { type: 'checkbox', 'data-area': a.id }); c.checked = gr.areas.some(function (x) { return x.id === a.id; });
        c.onchange = intentar(function () { return guardar(c.checked ? D.anadirArea(est.grupos, gr.id, a.nombre) : D.quitarArea(est.grupos, gr.id, a.id)); });
        return h('label', {}, [c, a.nombre]);
      }) : [h('span', { class: 'suave', texto: 'Aún no hay criterios cargados para ' + (isNaN(n) ? gr.nombre : n + 'º') })]);
      return h('div', { class: 'tarjeta' + (est.grupo === gr.id ? ' elegida' : ''), 'data-grupo': gr.id }, [
        cabecera,
        h('div', { class: 'areas' }, areas),
        marcar, cambiarNombre,
        zona, subir, aviso, manual, botonManual,
        h('div', { class: 'fila' }, [
          h('button', { type: 'button', class: 'boton', texto: 'Escribir nombres a mano', onclick: function () { manual.hidden = false; botonManual.hidden = false; } }),
          h('button', { type: 'button', class: 'boton peligro', texto: 'Quitar grupo', onclick: intentar(function () {
            if (!confirm('¿Quitar el grupo ' + gr.nombre + '? Su listado de alumnos no se borra de la carpeta.')) return Promise.resolve();
            if (est.grupo === gr.id) { est.grupo = null; est.area = null; }
            return guardar(D.quitarGrupo(est.grupos, gr.id));
          }) })
        ])
      ]);
    });

    if (est.editable === false) { montar([h('div', { class: 'rejilla' }, tarjetas)]); return; }
    var nuevo = h('input', { type: 'text', placeholder: 'Nuevo grupo, por ejemplo 5º A', 'aria-label': 'Nombre del nuevo grupo' });
    var sinGrupos = null;
    if (!est.grupos.length) {
      var dicho = h('div', { class: 'aviso error', id: 'avisoYaTenia', hidden: '' });
      sinGrupos = h('div', { class: 'fila', id: 'sinGrupos' }, [h('span', { class: 'suave', texto: 'Aún no tienes grupos. Crea el primero y sube su listado de Séneca.' }),
        est.yaTeniaRubricas ? h('button', { type: 'button', class: 'boton', id: 'yaTenia', texto: 'Ya tenía una carpeta RÚBRICAS', onclick: function () {
          est.yaTeniaRubricas(function (t) { dicho.textContent = t; dicho.hidden = !t; });
        } }) : null, dicho]);
    }
    montar([
      sinGrupos,
      h('div', { id: 'mensaje', class: 'aviso error', hidden: '' }),
      h('div', { class: 'rejilla' }, tarjetas),
      h('div', { class: 'nueva' }, [nuevo, h('button', { type: 'button', class: 'boton principal', texto: 'Añadir grupo', onclick: intentar(function () { return guardar(D.anadirGrupo(est.grupos, nuevo.value)); }) })]),
      cursoNuevo(est, intentar)
    ]);
  }

  /* ¿Hay actividades o situaciones de este grupo? */
  async function enUso(est, gid) {
    var a = await g.Trabajo.actividades(est.carpeta), s = await g.Situacion.todas(est.carpeta);
    return a.concat(s).some(function (x) { return x.grupo === gid; });
  }

  /* Al final de «Mis grupos»: «Empezar curso nuevo» y, mientras el curso nuevo no tenga trabajo, «Deshacer curso nuevo». */
  function cursoNuevo(est, intentar) {
    var caja = h('div', { class: 'curso-nuevo', id: 'cursoNuevo' }), actual = est.config.cursoActual;
    var boton = h('button', { type: 'button', class: 'boton', id: 'empezarCurso', texto: 'Empezar curso nuevo', onclick: function () { formulario(); } });
    var formulario = function () {
      var nombre = h('input', { type: 'text', id: 'nombreCurso', value: g.Cursos.siguiente(actual), 'aria-label': 'Nombre del curso nuevo' });
      var aviso = h('div', { class: 'aviso error', hidden: '' });
      caja.textContent = '';
      [h('label', { class: 'campo' }, ['Curso nuevo', nombre]),
        h('p', { class: 'suave', texto: 'El curso ' + actual + ' quedará guardado solo para consultar. Si te faltan notas, ponlas antes.' }),
        h('button', { type: 'button', class: 'boton principal', id: 'confirmarCurso', texto: 'Empezar', onclick: async function () {
          try { await est.empezarCurso(nombre.value); } catch (e) { aviso.textContent = e.message || String(e); aviso.hidden = false; }
        } }),
        h('button', { type: 'button', class: 'boton', texto: 'Cancelar', onclick: function () { caja.textContent = ''; caja.appendChild(boton); if (deshacer) caja.appendChild(deshacer); } }), aviso
      ].forEach(function (n) { caja.appendChild(n); });
    };
    var deshacer = est.anterior ? h('button', { type: 'button', class: 'boton peligro', id: 'deshacerCurso', texto: 'Deshacer curso nuevo', onclick: intentar(async function () {
      if (!confirm('Se borrará el curso ' + actual + ' con sus grupos y alumnado. El curso ' + est.anterior + ' vuelve a poder cambiarse. ¿Seguir?')) return;
      await est.deshacerCurso();
    }) }) : null;
    caja.appendChild(boton);
    if (deshacer) caja.appendChild(deshacer);
    return caja;
  }

  g.RubPantalla = { error: error, pintarGrupos: pintarGrupos, mostrarSeleccion: mostrarSeleccion };
})(window);
