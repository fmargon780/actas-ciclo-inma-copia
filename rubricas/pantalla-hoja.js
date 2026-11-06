/* Hoja del alumno (desde la actividad): Claude propone la ficha o prueba escrita, Inma la retoca y se imprime en A4 (o se guarda como PDF).
   Hoja de soluciones aparte, solo para la maestra. Se guarda en hojas/<actividad>.json. Textos siempre con textContent. */
(function (g) {
  'use strict';
  var H = g.Hoja, C = g.Criterios, T = g.Trabajo, Cl = g.RubClaude, CH = g.ClaudeHoja, PC = g.PantallaClaude, Dm = g.RubDom, h = Dm.h;
  var ALTO_CARA = 264 * 96 / 25.4; /* A4 con márgenes de 1,5 cm dan 267 mm de alto útil; se cuentan 3 mm menos de margen de seguridad, para no decir una cara de menos */

  async function pintarHoja(est, refrescar) {
    var act = est.actividad, editable = est.editable !== false;
    var rub = await T.rubricaDe(est.carpeta, act.id);
    var filas = rub ? rub.filas.filter(function (f) { return f.texto.trim(); }).map(function (f) { return { id: f.id, texto: f.texto }; }) : [];
    var hoja = await H.leer(est.carpeta, act.id), pendiente = null;
    var grupo = est.grupos.filter(function (x) { return x.id === act.grupo; })[0], area = C.areas().filter(function (x) { return x.id === act.area; })[0];
    var cat = g.Situacion.catalogo(grupo, C).criterios;
    var criterios = (act.criterios || []).map(function (id) {
      var k = cat.filter(function (x) { return x.id === id; })[0] || C.buscar(id, act.curso) || {};
      return { id: id, codigo: k.codigo || id, texto: k.texto || '' };
    });
    var ctxPapel = { colegio: est.colegio || H.COLEGIO, area: area ? area.nombre : act.area, grupo: grupo ? grupo.nombre : act.grupo, titulo: act.titulo };
    var aviso = Dm.aviso(), estado = h('p', { class: 'suave', id: 'hojaEstado' });
    var papel = h('div', { class: 'hoja-papel', id: 'hojaPapel' }), sol = h('div', { class: 'hoja-papel', id: 'hojaSoluciones' });
    var ocupa = h('span', { id: 'ocupaCaras' }), avisosCaras = h('div', { id: 'avisosCaras' });
    var panel = h('div', { id: 'panelHoja', class: 'hoja-pantalla' }), editor = h('div', { id: 'editorHoja', class: 'cambia-hoja' });
    var vista = 'normal'; /* «normal» o «adaptada»: la pestaña abierta */
    var actual = function () { return vista === 'adaptada' ? (hoja && hoja.adaptada) : hoja; }; /* lo que se retoca, se mide y se imprime */
    var mostrada = function () { return pendiente || actual(); };

    var medir = function () {
      var m = mostrada(); if (!m) return;
      var med = H.paginar(Array.prototype.map.call(papel.children, function (b) { return b.getBoundingClientRect().height; }), ALTO_CARA), prev = m.caras || 1;
      ocupa.textContent = H.textoCaras(med, prev); avisosCaras.textContent = '';
      H.avisosCaras(med, prev).forEach(function (t) { avisosCaras.appendChild(h('div', { class: 'aviso', texto: t })); });
      papel.dataset.caras = String(med.caras);
    };
    var repintarPapel = function () {
      var m = mostrada(); papel.textContent = ''; sol.textContent = ''; papel.classList.toggle('hoja-adaptada', vista === 'adaptada'); if (!m) return;
      g.HojaPapel.bloques(ctxPapel, m).forEach(function (b) { papel.appendChild(b); });
      sol.appendChild(g.HojaPapel.soluciones(vista === 'adaptada' ? Object.assign({ adaptada: true }, ctxPapel) : ctxPapel, m, filas));
      medir();
    };
    if (g.document.fonts && g.document.fonts.ready) g.document.fonts.ready.then(medir);

    var decir = function (t) { Dm.decir(aviso, t); };
    var guardar = async function () { if (!editable || !hoja) return; try { await H.guardar(est.carpeta, hoja); } catch (e) { decir(e.message || String(e)); } };
    var estructura = async function () { await guardar(); pintarEditor(); repintarPapel(); };
    var ctx = { filas: filas, alEscribir: repintarPapel, alTerminar: guardar, alEstructura: estructura,
      mover: function (i, d) { var l = actual().ejercicios, j = i + d; if (j < 0 || j >= l.length) return; var t = l[i]; l[i] = l[j]; l[j] = t; estructura(); },
      quitar: function (i) { var l = actual().ejercicios; if (l.length < 2) { decir('La hoja tiene que tener al menos un ejercicio.'); return; } if (!confirm('¿Quitar este ejercicio?')) return; l.splice(i, 1); estructura(); } };
    var pintarEditor = function () {
      editor.textContent = '';
      if (!actual() || pendiente) return;
      actual().ejercicios.forEach(function (e, i) { editor.appendChild(g.HojaEditor.tarjeta(e, i, ctx)); });
      var tipo = h('select', { id: 'tipoNuevo', 'aria-label': 'Tipo del ejercicio nuevo' }, H.TIPOS.map(function (t) { return h('option', { value: t.id, texto: t.nombre }); }));
      editor.appendChild(h('div', { class: 'barra' }, [tipo, h('button', { type: 'button', class: 'boton', id: 'anadirEjercicio', texto: 'Añadir ejercicio', onclick: function () {
        if (actual().ejercicios.length >= H.MAX_EJERCICIOS) { decir('Una hoja puede tener hasta ' + H.MAX_EJERCICIOS + ' ejercicios.'); return; }
        actual().ejercicios.push(H.ejercicioNuevo(tipo.value)); estructura();
      } })]));
    };

    /* Claude: la clave de la carpeta, sin nombres de alumnos, y los fallos a la vista. */
    var conClave = async function (fn) {
      decir('');
      try {
        var clave = await Cl.claveDe(est.raizActas);
        if (!clave) throw Object.assign(new Error('Falta la clave de Claude. Pégala una vez en «Ajustes».'), { codigo: 'sin-clave' });
        estado.textContent = 'Claude está pensando…';
        await fn(clave, await PC.nombresAlumnado(est));
        estado.textContent = '';
      } catch (e) {
        estado.textContent = ''; decir(e.message || String(e));
        if (e.codigo === 'sin-clave' || e.codigo === 'clave') aviso.appendChild(h('button', { type: 'button', class: 'boton', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
      }
    };
    var base = function (caras) {
      return { area: ctxPapel.area, curso: act.curso || est.cursoCrit, actividad: { id: act.id, titulo: act.titulo, producto: act.producto || '', materiales: act.materiales || '', pasos: act.pasos || [] },
        criterios: criterios, filas: filas, caras: caras };
    };
    var proponer = function (idea, caras) {
      return conClave(async function (clave, nombres) {
        var c = base(caras); c.idea = idea;
        pendiente = await CH.proponerHoja(clave, c, nombres); pintarTodo();
      });
    };
    var pedirCambios = function (texto) {
      return conClave(async function (clave, nombres) {
        var c = base(actual().caras); c.hoja = actual(); c.cambios = texto; c.adaptada = vista === 'adaptada';
        var r = await CH.cambiarHoja(clave, c, nombres);
        if (vista === 'adaptada') pendiente = CH.aAdaptada(r); else { r.adaptada = hoja.adaptada; pendiente = r; } /* cambiar la normal no toca la adaptada */
        pintarTodo();
      });
    };
    var proponerAdaptada = function (caras) {
      return conClave(async function (clave, nombres) {
        var c = base(caras); c.hoja = hoja;
        pendiente = await CH.proponerAdaptada(clave, c, nombres); pintarTodo();
      });
    };

    var imprimir = function (clase) { document.body.classList.add(clase); try { window.print(); } finally { document.body.classList.remove(clase); } };
    var verSol = h('input', { type: 'checkbox', id: 'verSoluciones', 'aria-label': 'Ver las soluciones' });
    verSol.onchange = function () { panel.classList.toggle('ver-sol', verSol.checked); medir(); };
    var barra = h('div', { class: 'barra barra-hoja' }, [
      h('button', { type: 'button', class: 'boton', id: 'volverActividad', texto: '← Volver a la actividad', onclick: function () { est.paso = 'actividad'; refrescar(); } }),
      h('button', { type: 'button', class: 'boton principal', id: 'imprimirHoja', texto: 'Imprimir hoja', onclick: function () { imprimir('imprime-hoja'); } }),
      h('button', { type: 'button', class: 'boton', id: 'imprimirSoluciones', texto: 'Imprimir soluciones', onclick: function () { imprimir('imprime-soluciones'); } }),
      h('label', { class: 'campo-fila' }, [verSol, ' Ver las soluciones'])
    ]);
    var numeroCaras = function (valor, alCambiar) {
      var n = h('input', { type: 'number', id: 'carasPrevistas', min: '1', max: '10', value: String(valor), 'aria-label': 'Caras previstas' });
      n.onchange = function () { alCambiar(Math.max(1, Math.min(10, parseInt(n.value, 10) || 1))); };
      return n;
    };

    var pestanas = function () {
      var pestana = function (id, texto, v) {
        return h('button', { type: 'button', class: 'boton', id: id, role: 'tab', 'aria-selected': String(vista === v), texto: texto, onclick: function () { vista = v; decir(''); pintarTodo(); } });
      };
      return h('div', { class: 'pestanas-hoja', role: 'tablist' }, [pestana('pestanaHoja', 'Hoja', 'normal'), pestana('pestanaAdaptada', 'Versión adaptada', 'adaptada')]);
    };

    function pintarTodo() {
      var partes = [barra];
      if (hoja && !pendiente) partes.push(pestanas());
      if (vista === 'adaptada' && hoja && !hoja.adaptada && !pendiente) {
        if (!editable) partes.push(h('p', { class: 'suave', id: 'sinAdaptada', texto: 'Esta hoja no tiene versión adaptada.' }));
        else {
          var carasA = hoja.caras, nA = numeroCaras(carasA, function (v) { carasA = v; });
          partes.push(h('div', { class: 'tarjeta cambia-hoja', id: 'adaptadaInicio' }, [h('h2', { texto: 'Versión adaptada' }),
            h('p', { class: 'suave', texto: 'Claude hace, a partir de la hoja normal, otra más sencilla: menos ejercicios, enunciados más cortos y letra más grande. Es una hoja más, no la de un niño concreto.' }),
            h('label', { class: 'campo' }, ['Caras previstas', nA]),
            h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton principal', id: 'proponerAdaptada', texto: 'Versión adaptada', onclick: function () { proponerAdaptada(carasA); } })])]));
        }
      } else if (!hoja && !pendiente) {
        if (!editable) partes.push(h('p', { class: 'suave', id: 'sinHoja', texto: 'Esta actividad no tiene hoja del alumno.' }));
        else {
          var idea = h('textarea', { id: 'hojaIdea', placeholder: 'Si quieres, cuéntale cómo la quieres. Por ejemplo: con un problema de monedas y un dibujo.' });
          var caras = 1, n = numeroCaras(1, function (v) { caras = v; });
          partes.push(h('div', { class: 'tarjeta cambia-hoja', id: 'hojaInicio' }, [h('h2', { texto: 'Hoja del alumno' }),
            h('p', { class: 'suave', texto: 'Claude propone una ficha o prueba escrita a partir de la actividad y su rúbrica; luego la retocas. No escribas nombres de alumnos.' }),
            idea, h('label', { class: 'campo' }, ['Caras previstas', n]),
            h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton principal', id: 'proponerHoja', texto: 'Proponer la hoja con Claude', onclick: function () { proponer(idea.value.trim(), caras); } }),
              h('button', { type: 'button', class: 'boton', id: 'hojaEnBlanco', texto: 'Empezar en blanco', onclick: async function () { hoja = H.hojaNueva(act.id, caras); await guardar(); pintarTodo(); } })])]));
        }
      } else if (pendiente) {
        partes.push(h('div', { class: 'tarjeta cambia-hoja', id: 'propuestaHoja' }, [h('p', { class: 'etiqueta-ia', texto: PC.ETIQUETA }),
          h('p', { class: 'suave', texto: 'Esta es la propuesta (debajo, tal como saldría en el papel). Hasta que la aceptes no se guarda nada.' }),
          h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton principal', id: 'aceptarHoja', texto: 'Aceptar', onclick: async function () {
            pendiente.porIA = true;
            if (vista === 'adaptada') hoja.adaptada = pendiente; else hoja = pendiente;
            pendiente = null; await guardar(); pintarTodo();
          } }), h('button', { type: 'button', class: 'boton', id: 'descartarHoja', texto: 'Descartar', onclick: function () { pendiente = null; pintarTodo(); } })])]));
      } else if (actual()) {
        var cambios = h('textarea', { id: 'hojaCambios', placeholder: 'Qué quieres que cambie: «más corta», «más larga», «cambia el ejercicio 3 por uno de unir»…' });
        partes.push(h('div', { class: 'cambia-hoja barra' }, [actual().porIA ? h('span', { class: 'etiqueta-ia', id: 'etiquetaHoja', texto: PC.ETIQUETA }) : null,
          h('label', { class: 'campo' }, ['Caras previstas', numeroCaras(actual().caras, function (v) { actual().caras = v; guardar(); medir(); })])]));
        partes.push(h('div', { class: 'tarjeta cambia-hoja', id: 'cajaCambiosHoja' }, [h('h3', { texto: 'Pedir cambios a Claude' }), cambios,
          h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton', id: 'pedirCambiosHoja', texto: 'Pedir cambios', onclick: function () {
            if (!cambios.value.trim()) { decir('Escribe qué quieres que cambie.'); return; }
            pedirCambios(cambios.value.trim());
          } }), h('button', { type: 'button', class: 'boton peligro', id: 'otraHoja', texto: vista === 'adaptada' ? 'Pedir otra versión adaptada a Claude' : 'Pedir otra hoja a Claude', onclick: function () {
            if (vista === 'adaptada') { if (!confirm('Se perderá la versión adaptada actual. ¿Seguir?')) return; proponerAdaptada(hoja.adaptada.caras); return; }
            if (!confirm(hoja.adaptada ? 'Se perderán la hoja actual y su versión adaptada. ¿Seguir?' : 'Se perderá la hoja actual. ¿Seguir?')) return;
            proponer('', hoja.caras);
          } })])]));
      }
      var m = mostrada();
      if (m) partes.push(h('div', { class: 'fila-caras' }, [ocupa]), avisosCaras);
      partes.push(estado, aviso);
      if (actual() && !pendiente) partes.push(editor);
      if (m) partes.push(h('div', { class: 'papel-wrap', id: 'hojaPapelWrap' }, [papel]), h('div', { class: 'papel-wrap sol-wrap', id: 'hojaSolWrap' }, [sol]));
      panel.textContent = ''; partes.forEach(function (p) { panel.appendChild(p); });
      pintarEditor(); repintarPapel();
    }
    Dm.montar([panel]); pintarTodo();
  }

  g.PantallaHoja = { pintarHoja: pintarHoja };
})(window);
