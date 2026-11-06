/* Paso 2 · Criterio: Inma elige área, curso y trimestre, ve las competencias específicas con sus criterios oficiales y marca uno.
   A la derecha, cuánto se usa ese criterio en su clase. Textos siempre con textContent. */
(function (g) {
  'use strict';
  var C = g.Criterios, D = g.RubDatos;
  var $ = function (id) { return document.getElementById(id); };
  var TRIMESTRES = ['1.er trimestre', '2.º trimestre', '3.er trimestre'];

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
  function selector(etiqueta, id, opciones, actual, alCambiar) {
    var s = h('select', { id: id, 'aria-label': etiqueta }, opciones.map(function (o) {
      var op = h('option', { value: String(o.valor), texto: o.texto }); if (String(o.valor) === String(actual)) op.selected = true; return op;
    }));
    s.onchange = function () { alCambiar(s.value); };
    return h('label', { class: 'campo' }, [etiqueta, s]);
  }

  /* Valores de partida: el grupo y el área elegidos en «Mis grupos», si los hay. */
  function ajustar(est) {
    var areas = C.areas();
    if (!areas.length) return false;
    if (!est.areaCrit || !areas.some(function (a) { return a.id === est.areaCrit; })) {
      est.areaCrit = areas.some(function (a) { return a.id === est.area; }) ? est.area : areas[0].id;
    }
    var cs = C.cursos(est.areaCrit);
    if (!est.cursoCrit || cs.indexOf(Number(est.cursoCrit)) < 0) {
      var gr = est.grupos.filter(function (x) { return x.id === est.grupo; })[0], n = gr ? parseInt(gr.nombre, 10) : NaN;
      est.cursoCrit = cs.indexOf(n) >= 0 ? n : cs[0];
    }
    est.trimestre = est.trimestre || 1;
    return true;
  }

  async function panelDerecho(est, refrescar) {
    var caja = h('aside', { class: 'tarjeta lateral', id: 'usoCriterio' }, [h('h2', { texto: 'Este criterio en tu clase' })]);
    if (!est.criterio) { caja.appendChild(h('p', { class: 'suave', texto: 'Marca un criterio de la lista para ver cómo está en tu clase.' })); return caja; }
    var uso = await D.usoDeCriterio(est.carpeta, est.criterio.id, est.trimestre);
    caja.appendChild(h('p', { class: 'codigo', texto: est.criterio.codigo }));
    caja.appendChild(h('p', { id: 'usoActividades', texto: 'Actividades que lo evalúan en el ' + TRIMESTRES[est.trimestre - 1] + ': ' + uso.actividades }));
    caja.appendChild(h('p', { id: 'usoRubricas', texto: 'Rúbricas guardadas: ' + uso.rubricas }));
    /* Las actividades que lo evalúan, también las creadas en otra área (marcadas «de …»); se abren enteras. */
    var propias = (await g.Trabajo.actividades(est.carpeta)).filter(function (a) { return Array.isArray(a.criterios) && a.criterios.indexOf(est.criterio.id) >= 0 && Number(a.trimestre) === Number(est.trimestre); });
    if (propias.length) caja.appendChild(h('div', { class: 'lista', id: 'usoLista' }, propias.map(function (a) {
      var otra = a.area && a.area !== est.areaCrit ? C.areas().filter(function (x) { return x.id === a.area; })[0] : null;
      return h('button', { type: 'button', class: 'boton', 'data-actividad-uso': a.id, texto: (a.titulo || '(sin título)') + (otra ? ' (de ' + otra.nombre + ')' : ''), onclick: function () { est.actividad = a; est.enlace = null; est.paso = 'actividad'; refrescar(); } });
    })));
    if (!uso.actividades) caja.appendChild(h('div', { class: 'aviso', id: 'avisoSinEvaluar', texto: 'Este criterio se queda sin evaluar en el ' + TRIMESTRES[est.trimestre - 1] + '.' }));
    caja.appendChild(h('button', { type: 'button', class: 'boton principal', id: 'crearActividad', texto: 'Crear actividad para este criterio', onclick: function () { est.actividad = null; est.enlace = null; est.paso = 'actividad'; refrescar(); } }));
    return caja;
  }

  async function pintarCriterio(est, refrescar) {
    if (!ajustar(est)) { montar([h('div', { class: 'vacio' }, [h('div', { class: 'aviso error', texto: 'No hay criterios cargados. Actualiza la página.' })])]); return; }
    var otra = function (campo) { return function (v) { est[campo] = v; est.criterio = null; refrescar(); }; };
    var barra = h('div', { class: 'barra' }, [
      selector('Área', 'selArea', C.areas().map(function (a) { return { valor: a.id, texto: a.nombre }; }), est.areaCrit, otra('areaCrit')),
      selector('Curso', 'selCurso', C.cursos(est.areaCrit).map(function (n) { return { valor: n, texto: n + '.º' }; }), est.cursoCrit, otra('cursoCrit')),
      selector('Trimestre', 'selTrimestre', TRIMESTRES.map(function (t, i) { return { valor: i + 1, texto: t }; }), est.trimestre, function (v) { est.trimestre = Number(v); refrescar(); })
    ]);
    var lista = C.competencias(est.areaCrit, est.cursoCrit).map(function (c) {
      return h('section', { class: 'competencia' }, [
        h('h3', {}, [h('span', { class: 'numero', texto: 'Competencia ' + c.numero }), ' ' + c.texto]),
        h('div', { class: 'criterios' }, c.criterios.map(function (k) {
          var marcado = est.criterio && est.criterio.id === k.id;
          return h('button', { type: 'button', class: 'criterio' + (marcado ? ' marcado' : ''), 'data-criterio': k.id, 'aria-pressed': marcado ? 'true' : 'false', onclick: function () { est.criterio = k; refrescar(); } },
            [h('b', { texto: k.codigo }), ' ' + k.texto]);
        }))
      ]);
    });
    var f = C.fuente(est.areaCrit);
    montar([barra, h('div', { class: 'dos' }, [
      h('div', { class: 'competencias' }, lista.concat([h('p', { class: 'suave', texto: 'Fuente: ' + (f ? f.norma + '. ' + f.anexo + '. ' + f.paginas + '.' : '') })])),
      await panelDerecho(est, refrescar)
    ])]);
  }

  g.PantallaCriterio = { pintarCriterio: pintarCriterio };
})(window);
