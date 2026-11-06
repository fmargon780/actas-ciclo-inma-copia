/* Paso 1 · Situación: Inma escribe el reto, Claude propone la Situación de Aprendizaje (criterios solo de la lista oficial),
   ella la edita, abre cada actividad en el paso «Actividad» y prepara el listado para Séneca. Textos siempre con textContent.
   A Claude solo van el reto, el curso, las áreas y los criterios oficiales; nunca nombres de alumnos. */
(function (g) {
  'use strict';
  var C = g.Criterios, S = g.Situacion, Cl = g.RubClaude, PC = g.PantallaClaude, Dm = g.RubDom, h = Dm.h, PT = g.RubPantallaTraer;

  function campoTexto(s, clave, etiqueta, id, tipo) {
    var i = h(tipo === 'area' ? 'textarea' : 'input', tipo === 'area' ? { id: id } : { id: id, type: tipo || 'text' });
    if (tipo === 'number') i.min = '1';
    i.value = s[clave] == null ? '' : s[clave];
    i.oninput = function () { s[clave] = tipo === 'number' ? Number(i.value) || 1 : i.value; };
    return h('label', { class: 'campo' }, [etiqueta, i]);
  }
  function selector(etiqueta, id, opciones, actual, alCambiar) {
    var sel = h('select', { id: id, 'aria-label': etiqueta }, opciones.map(function (o) { var op = h('option', { value: String(o.valor), texto: o.texto }); if (String(o.valor) === String(actual)) op.selected = true; return op; }));
    sel.onchange = function () { alCambiar(sel.value); };
    return h('label', { class: 'campo' }, [etiqueta, sel]);
  }
  function copiar(texto) { try { return navigator.clipboard.writeText(texto); } catch (e) { return Promise.resolve(); } }

  async function pintarSituacion(est, refrescar) {
    var lista = await S.todas(est.carpeta), soloVer = est.editable === false;
    if (soloVer && !est.situacion) est.situacion = lista[0] || null;
    if (soloVer && !est.situacion) { Dm.montar([h('div', { class: 'vacio' }, [h('p', { id: 'sinSituaciones', texto: 'En este curso no hay ninguna situación.' })])]); return; }
    if (!est.situacion) { var gr0 = est.grupos.filter(function (x) { return x.id === est.grupo; })[0] || est.grupos[0]; est.situacion = S.nueva(gr0 ? gr0.id : '', est.trimestre || 1); est.situacionNueva = true; }
    var s = est.situacion;
    var aviso = Dm.aviso(), estado = h('p', { class: 'suave', id: 'sitEstado' }), avisoIA = h('div', { class: 'aviso', id: 'sitDescartados', hidden: '' });
    var grupo = est.grupos.filter(function (x) { return x.id === s.grupo; })[0];
    var cat = S.catalogo(grupo, C), porId = {};
    cat.criterios.forEach(function (k) { porId[k.id] = k; });
    var estados = await S.estados(est.carpeta, s), hojas = await S.hojas(est.carpeta, s);
    var traido = PT.aviso(est), traer = est.situacionNueva ? PT.boton(est, 'situacion', refrescar, await PT.disponibles(est, 'situacion')) : null;
    var repintar = function () { return pintarSituacion(est, refrescar); };
    var guardar = async function () {
      if (!s.titulo.trim()) throw new Error('Escribe el título de la situación.');
      s.titulo = s.titulo.trim(); await S.guardar(est.carpeta, s); est.situacionNueva = false;
    };
    var intentar = function (fn) { return async function () { try { Dm.decir(aviso, ''); await fn(); } catch (e) { Dm.decir(aviso, e.message || String(e)); } }; };

    /* Claude. */
    var reto = h('textarea', { id: 'sitReto', placeholder: 'El reto en una frase. Por ejemplo: que la clase organice la excursión al parque y después se la cuente a otra clase.' }); reto.value = s.reto; reto.oninput = function () { s.reto = reto.value; };
    var cambios = h('textarea', { id: 'sitCambios', placeholder: 'Qué quieres que cambie' });
    var pedir = async function (anterior, textoCambios) {
      Dm.decir(aviso, ''); Dm.decir(avisoIA, '');
      try {
        var clave = await Cl.claveDe(est.raizActas);
        if (!clave) throw Object.assign(new Error('Falta la clave de Claude. Pégala una vez en «Ajustes».'), { codigo: 'sin-clave' });
        if (!s.reto.trim()) throw new Error('Escribe el reto en una frase.');
        if (!cat.criterios.length) throw new Error('Este grupo no tiene áreas con criterios oficiales cargados.');
        estado.textContent = 'Claude está pensando…';
        var r = await Cl.proponerSituacion(clave, { curso: cat.curso, areas: cat.areas, criterios: cat.criterios, idea: s.reto.trim(), anterior: anterior, cambios: textoCambios }, await PC.nombresAlumnado(est));
        S.aplicarPropuesta(s, r.situacion);
        est.avisoDescartados = r.descartados; est.avisoActividades = r.actividadesDescartadas;
        await repintar();
      } catch (e) {
        estado.textContent = ''; Dm.decir(aviso, e.message || String(e));
        if (e.codigo === 'sin-clave' || e.codigo === 'clave') aviso.appendChild(h('button', { type: 'button', class: 'boton', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
      }
    };
    if (est.avisoDescartados && est.avisoDescartados.length) {
      Dm.decir(avisoIA, 'Claude propuso ' + est.avisoDescartados.length + ' criterio(s) que no están en la norma oficial cargada («' + est.avisoDescartados.join('», «') + '»). Los he descartado.');
    }
    if (est.avisoActividades && est.avisoActividades.length) {
      avisoIA.appendChild(document.createTextNode(' Claude propuso ' + est.avisoActividades.length + ' actividad(es) sin ningún criterio oficial de su área («' + est.avisoActividades.join('», «') + '»). Las he quitado.'));
    }
    est.avisoDescartados = null; est.avisoActividades = null;
    var caja = h('div', { class: 'caja-ia', id: 'cajaSituacion' }, [
      h('h3', { texto: 'Pedir a Claude' }),
      h('p', { class: 'suave', texto: 'Cuéntale el reto y te propone la situación completa, con criterios oficiales. No escribas nombres de alumnos.' }),
      reto,
      h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton principal', id: 'proponerSituacion', texto: 'Proponer situación', onclick: function () { pedir(null, null); } })]),
      estado, avisoIA
    ]);
    if (s.porIA) {
      caja.appendChild(h('p', { class: 'etiqueta-ia', id: 'etiquetaSituacion', texto: PC.ETIQUETA }));
      caja.appendChild(h('label', { class: 'campo' }, ['Pedir cambios', cambios]));
      caja.appendChild(h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton', id: 'sitPedirCambios', texto: 'Pedir cambios', onclick: function () {
        if (!cambios.value.trim()) { Dm.decir(aviso, 'Escribe qué quieres que cambie.'); return; }
        pedir({ titulo: s.titulo, semanas: s.semanas, sesiones: s.sesiones, producto: s.producto, recursos: s.recursos, criterios: s.criterios,
          actividades: s.actividades.map(function (a) { return { titulo: a.titulo, area: a.area, sesiones: a.sesiones, criterios: S.criteriosDe(a) }; }) }, cambios.value.trim());
      } })]));
    }

    /* Criterios de la situación. */
    var criterios = s.criterios.map(function (id) {
      var k = porId[id];
      return h('div', { class: 'criterio-sit', 'data-criterio': id }, [h('b', { texto: k ? k.codigo : id }), ' ' + (k ? k.texto + ' (' + k.areaNombre + ')' : ''),
        h('button', { type: 'button', class: 'boton peligro', 'aria-label': 'Quitar el criterio ' + id, texto: '✕', onclick: function () { s.criterios = s.criterios.filter(function (x) { return x !== id; }); repintar(); } })]);
    });
    var libres = cat.criterios.filter(function (k) { return s.criterios.indexOf(k.id) < 0; });
    var anadirCrit = h('select', { id: 'sitAnadirCriterio', 'aria-label': 'Añadir un criterio' }, [h('option', { value: '', texto: 'Añadir un criterio…' })].concat(
      libres.map(function (k) { return h('option', { value: k.id, texto: k.areaNombre + ' · ' + k.codigo + ' · ' + k.texto.slice(0, 90) }); })));
    anadirCrit.onchange = function () { if (anadirCrit.value) { s.criterios.push(anadirCrit.value); repintar(); } };

    /* Actividades. */
    var filas = s.actividades.map(function (a, n) {
      var t = h('input', { type: 'text', class: 'actSitTitulo', 'aria-label': 'Título de la actividad ' + (n + 1), value: a.titulo }); t.oninput = function () { a.titulo = t.value; };
      var ses = h('input', { type: 'number', min: '1', class: 'actSitSesiones', 'aria-label': 'Sesiones de la actividad ' + (n + 1), value: String(a.sesiones) }); ses.oninput = function () { a.sesiones = Number(ses.value) || 1; };
      var area = selector('Área', 'actSitArea' + n, cat.areas.map(function (x) { return { valor: x.id, texto: x.nombre }; }), a.area, function (v) { a.area = v; });
      /* Criterios de la actividad: el primero en el selector de siempre; los demás, como etiquetas con ✕ y un selector para añadir otro. */
      var lista = S.criteriosDe(a), codigo = function (id) { return porId[id] ? porId[id].codigo : id; };
      var crit = selector('Criterio', 'actSitCriterio' + n, [{ valor: '', texto: '(sin criterio)' }].concat(s.criterios.map(function (id) { return { valor: id, texto: codigo(id) }; })), lista[0] || '', function (v) {
        S.ponerCriterios(a, v ? [v].concat(lista.slice(1).filter(function (x) { return x !== v; })) : []); repintar();
      });
      var otros = h('span', { class: 'criterios-otros', 'data-otros': String(n) }, lista.slice(1).map(function (id) {
        return h('span', { class: 'criterio-extra', 'data-criterio-extra': id }, [codigo(id) + ' ', h('button', { type: 'button', class: 'mini', 'aria-label': 'Quitar el criterio ' + codigo(id) + ' de la actividad ' + (n + 1), texto: '✕', onclick: function () { S.ponerCriterios(a, lista.filter(function (x) { return x !== id; })); repintar(); } })]);
      }));
      var libresAct = s.criterios.filter(function (id) { return lista.indexOf(id) < 0; });
      if (lista.length && libresAct.length) otros.appendChild(selector('Otro criterio', 'actSitMas' + n, [{ valor: '', texto: '+ otro criterio' }].concat(libresAct.map(function (id) { return { valor: id, texto: codigo(id) }; })), '', function (v) { if (v) { S.ponerCriterios(a, lista.concat([v])); repintar(); } }));
      return h('div', { class: 'actividad-sit', 'data-n': String(n) }, [
        h('span', { class: 'numero', texto: String(n + 1) }), t, area, ses, crit, otros,
        h('span', { class: 'estado-rubrica ' + estados[n], texto: S.ETIQUETA_ESTADO[estados[n]] }),
        hojas[n] === null ? null : h('span', { class: 'estado-hoja ' + (hojas[n] ? 'si' : 'no'), texto: hojas[n] ? 'Hoja: sí' : 'Hoja: no' }),
        soloVer && estados[n] === 'sin-crear' ? null : h('button', { type: 'button', class: 'boton principal abrirActividad', texto: estados[n] === 'sin-crear' ? 'Crear actividad' : 'Abrir actividad', onclick: intentar(async function () {
          if (!S.criteriosDe(a).length) throw new Error('Elige antes el criterio de esta actividad.');
          if (!soloVer) await guardar();
          var curso = cat.curso, k = C.buscar(S.criteriosDe(a)[0], curso), previa = null;
          if (a.actividadId) previa = await est.carpeta.leerJSON('actividades/' + a.actividadId + '.json');
          est.grupo = s.grupo; est.areaCrit = a.area; est.cursoCrit = curso; est.trimestre = Number(s.trimestre); est.criterio = k;
          est.actividad = previa; est.rubrica = null; est.enlace = { sid: s.id, n: n, titulo: a.titulo, sesiones: a.sesiones, criterios: S.criteriosDe(a) };
          est.paso = 'actividad'; await refrescar();
        }) }),
        h('button', { type: 'button', class: 'boton peligro', 'aria-label': 'Quitar la actividad ' + (n + 1), texto: '✕', onclick: function () { s.actividades.splice(n, 1); repintar(); } })
      ]);
    });

    /* Séneca. */
    var seneca = h('div', { id: 'panelSeneca', hidden: '' });
    var preparar = h('button', { type: 'button', class: 'boton', id: 'prepararSeneca', texto: 'Preparar para Séneca', onclick: intentar(async function () {
      seneca.textContent = ''; seneca.hidden = false;
      seneca.appendChild(h('p', { class: 'suave', texto: 'Apartados por orden, para copiar uno a uno en Séneca. (Los apartados exactos de Séneca están por confirmar.)' }));
      S.paraSeneca(s, cat, estados).forEach(function (b, i) {
        var t = h('textarea', { class: 'senecaTexto', readonly: '', 'aria-label': b.apartado }); t.value = b.texto;
        seneca.appendChild(h('section', { class: 'apartado-seneca', 'data-apartado': String(i) }, [h('h4', { texto: b.apartado }), t,
          h('button', { type: 'button', class: 'boton', texto: 'Copiar', onclick: function () { copiar(b.texto); } })]));
      });
    }) });

    var principal = h('div', { class: 'tarjeta', id: 'panelSituacion' }, [
      h('h2', { texto: est.situacionNueva ? 'Nueva situación de aprendizaje' : 'Situación de aprendizaje' }),
      h('div', { class: 'barra' }, [
        selector('Grupo', 'sitGrupo', est.grupos.map(function (x) { return { valor: x.id, texto: x.nombre }; }), s.grupo, function (v) { s.grupo = v; repintar(); }),
        selector('Trimestre', 'sitTrimestre', S.TRIMESTRES.map(function (t, i) { return { valor: i + 1, texto: t }; }), s.trimestre, function (v) { s.trimestre = Number(v); })
      ]),
      PT.etiqueta(s), traido, traer,
      caja,
      campoTexto(s, 'titulo', 'Título', 'sitTitulo'),
      h('div', { class: 'barra' }, [campoTexto(s, 'semanas', 'Semanas', 'sitSemanas', 'number'), campoTexto(s, 'sesiones', 'Sesiones en total', 'sitSesiones', 'number')]),
      campoTexto(s, 'producto', 'Producto final', 'sitProducto'),
      campoTexto(s, 'recursos', 'Recursos', 'sitRecursos', 'area'),
      campoTexto(s, 'saberes', 'Saberes básicos (cópialos del anexo oficial)', 'sitSaberes', 'area'),
      h('h3', { texto: 'Criterios que se evalúan' }), h('div', { id: 'sitCriterios' }, criterios), anadirCrit,
      h('h3', { texto: 'Actividades' }), h('div', { id: 'sitActividades' }, filas),
      h('button', { type: 'button', class: 'boton', id: 'sitAnadirActividad', texto: 'Añadir actividad', onclick: function () { s.actividades.push(S.actividadNueva(cat.areas[0] ? cat.areas[0].id : '')); repintar(); } }),
      aviso,
      h('div', { class: 'fila' }, [
        h('button', { type: 'button', class: 'boton principal', id: 'guardarSituacion', texto: 'Guardar situación', onclick: intentar(async function () { await guardar(); await repintar(); }) }),
        preparar
      ]),
      seneca
    ]);

    /* Mis situaciones. */
    var grupos = S.agrupar(lista, est.grupos), lateral = h('aside', { class: 'tarjeta lateral', id: 'misSituaciones' }, [h('h2', { texto: 'Mis situaciones' })]);
    if (!grupos.length) lateral.appendChild(h('p', { class: 'suave', texto: 'Aún no hay ninguna.' }));
    grupos.forEach(function (b) {
      lateral.appendChild(h('h3', { class: 'suave', texto: b.grupo.nombre + ' · ' + S.TRIMESTRES[b.trimestre - 1] }));
      b.situaciones.forEach(function (x) { lateral.appendChild(h('button', { type: 'button', class: 'boton', 'data-situacion': x.id, texto: x.titulo || '(sin título)', onclick: function () { est.situacion = x; est.situacionNueva = false; refrescar(); } })); });
    });
    lateral.appendChild(h('button', { type: 'button', class: 'boton principal', id: 'situacionNueva', texto: 'Nueva situación', onclick: function () { est.situacion = null; refrescar(); } }));
    Dm.montar([h('div', { class: 'dos' }, [principal, lateral])]);
  }

  g.PantallaSituacion = { pintarSituacion: pintarSituacion };
})(window);
