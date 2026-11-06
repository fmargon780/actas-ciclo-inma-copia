/* Paso 4 · Rúbrica: tabla «qué se mira» × cinco niveles, editable casilla a casilla. Se guarda sola en la carpeta de Inma.
   A la derecha, «Mis rúbricas» para reutilizar una en otra actividad. */
(function (g) {
  'use strict';
  var R = g.Rubrica, T = g.Trabajo, Dm = g.RubDom, h = Dm.h;

  async function pintarRubrica(est, refrescar) {
    var act = est.actividad;
    if (!est.rubrica) est.rubrica = (await T.rubricaDe(est.carpeta, act.id)) || R.rubricaNueva(act.id, act.titulo, 3);
    var plantillas = await T.plantillas(est.carpeta);
    var aviso = Dm.aviso();
    var intentar = function (fn) { return async function () { try { Dm.decir(aviso, ''); await fn(); } catch (e) { Dm.decir(aviso, e.message || String(e)); } }; };
    var guardar = function (r) { est.rubrica = r; return T.guardarRubrica(est.carpeta, r); };
    var cambiar = function (hacer) { return intentar(async function () { await guardar(hacer()); await refrescar(); }); };

    var r = est.rubrica, crit = act.criterios || [];
    var grupos = R.agrupar(r, crit), multi = crit.length > 1 || grupos.some(function (x) { return !x.criterio; });
    var COLS = 8, titulo = function (id) { return R.tituloCriterio(id, crit, g.Criterios, act.curso); };
    var cabeza = h('tr', {}, [h('th', { class: 'quemira', texto: 'Qué se mira' }), h('th', { class: 'peso', texto: 'Peso' })].concat(
      est.config.niveles.map(function (n, i) {
        var v = h('input', { type: 'number', class: 'valor', 'data-nivel': String(i), min: '0', max: '10', step: '0.5', value: String(n.valor), 'aria-label': 'Valor de ' + n.nombre });
        v.onchange = intentar(async function () {
          var nuevos = Array.prototype.map.call(document.querySelectorAll('input.valor'), function (x) { return x.value; });
          await T.guardarNiveles(est.carpeta, est.config, R.validarValores(nuevos));
          await refrescar();
        });
        return h('th', { class: 'nivel n' + i }, [h('span', { texto: n.nombre }), v]);
      })
    ).concat([h('th', { texto: '' })]));

    var filaDe = {}, hechas = r.filas.map(function (f, i) {
      var texto = h('textarea', { class: 'celda-texto', 'aria-label': 'Qué se mira, fila ' + (i + 1), placeholder: 'Qué se mira' }); texto.value = f.texto;
      texto.onchange = intentar(async function () { f.texto = texto.value; await guardar(r); });
      var peso = h('input', { type: 'number', class: 'pesoFila', min: '0.5', step: '0.5', value: String(f.peso), 'aria-label': 'Peso de la fila ' + (i + 1) });
      peso.onchange = intentar(async function () { await guardar(R.ponerPeso(r, f.id, peso.value)); });
      var selCrit = !multi ? null : h('select', { class: 'selCriterioFila', 'aria-label': 'Criterio de la fila ' + (i + 1) }, (R.criterioDe(f, crit) ? [] : [h('option', { value: '', texto: 'Sin criterio' })]).concat(crit.map(function (id) { return h('option', { value: id, texto: R.etiquetaCriterio(id, crit) }); })));
      if (selCrit) { selCrit.value = R.criterioDe(f, crit); selCrit.onchange = cambiar(function () { return R.asignarCriterio(r, f.id, selCrit.value); }); }
      var celdas = f.celdas.map(function (c, k) {
        var t = h('textarea', { class: 'celda n' + k, 'aria-label': est.config.niveles[k].nombre + ', fila ' + (i + 1), placeholder: 'Qué tiene que pasar' }); t.value = c;
        t.onchange = intentar(async function () { f.celdas[k] = t.value; await guardar(r); });
        return h('td', { class: 'nivel n' + k }, [t]);
      });
      var boton = function (txt, titulo, fn) { return h('button', { type: 'button', class: 'mini', title: titulo, 'aria-label': titulo, texto: txt, onclick: fn }); };
      return h('tr', { 'data-fila': f.id }, [h('td', { class: 'quemira' }, [selCrit, texto]), h('td', { class: 'peso' }, [peso])].concat(celdas).concat([
        h('td', { class: 'acciones' }, [
          boton('↑', 'Subir la fila', cambiar(function () { return R.moverEnGrupo(r, f.id, -1, crit); })), boton('↓', 'Bajar la fila', cambiar(function () { return R.moverEnGrupo(r, f.id, 1, crit); })),
          boton('✕', 'Quitar la fila', function () { if (r.filas.length > 1 && confirm('¿Quitar esta fila de la rúbrica?')) cambiar(function () { return R.quitarFila(r, f.id); })(); })
        ])
      ]));
    });
    r.filas.forEach(function (f, i) { filaDe[f.id] = hechas[i]; });
    /* Con varios criterios las filas salen agrupadas bajo el título de su criterio, cada grupo con su «Añadir fila». */
    var filas = [];
    grupos.forEach(function (gr) {
      if (multi) {
        filas.push(h('tr', { class: 'grupo-criterio', 'data-criterio-grupo': gr.criterio }, [h('td', { colspan: String(COLS) }, [h('b', { texto: titulo(gr.criterio) }),
          gr.criterio ? h('button', { type: 'button', class: 'mini anadirFilaGrupo', 'data-criterio': gr.criterio, texto: '+ Añadir fila', onclick: cambiar(function () { return R.anadirFila(r, gr.criterio); }) }) : null])]));
        if (!gr.filas.length) filas.push(h('tr', { class: 'grupo-vacio' }, [h('td', { colspan: String(COLS), class: 'suave', texto: 'Este criterio aún no tiene filas.' })]));
      }
      gr.filas.forEach(function (f) { filas.push(filaDe[f.id]); });
    });

    var malasYa = R.problemas(r, crit), avisoCriterios = h('div', { class: 'aviso', id: 'avisoCriterios' });
    avisoCriterios.textContent = malasYa.join('. '); avisoCriterios.hidden = !malasYa.length;
    var soloVer = est.editable === false;
    var nombrePlantilla = h('input', { type: 'text', id: 'nombrePlantilla', value: r.nombre || act.titulo, 'aria-label': 'Nombre para guardarla' });
    var lateral = soloVer ? h('aside', { class: 'tarjeta lateral', id: 'misRubricasLectura' }, [h('h2', { texto: 'Mis rúbricas' })].concat(
      plantillas.length ? plantillas.map(function (p) { return h('p', { class: 'plantilla-nombre', texto: p.nombre + ' (' + p.filas.length + ' filas)' }); }) : [h('p', { class: 'suave', texto: 'No hay ninguna guardada.' })]
    )) : h('aside', { class: 'tarjeta lateral', id: 'misRubricas' }, [
      h('h2', { texto: 'Mis rúbricas' }),
      plantillas.length ? h('div', { class: 'lista' }, plantillas.map(function (p) {
        return h('button', { type: 'button', class: 'boton', 'data-plantilla': p.id, texto: 'Usar «' + p.nombre + '» (' + p.filas.length + ' filas)', onclick: intentar(async function () {
          if (r.filas.some(function (f) { return f.texto || f.celdas.some(Boolean); }) && !confirm('Esto sustituye la rúbrica de esta actividad. ¿Seguir?')) return;
          await guardar(R.copiarRubrica(p, act.id, act.titulo, crit)); await refrescar();
        }) });
      })) : h('p', { class: 'suave', texto: 'Aún no has guardado ninguna.' }),
      h('label', { class: 'campo' }, ['Guardar esta rúbrica como', nombrePlantilla]),
      h('button', { type: 'button', class: 'boton', id: 'guardarPlantilla', texto: 'Guardar en mis rúbricas', onclick: intentar(async function () {
        if (!nombrePlantilla.value.trim()) throw new Error('Ponle un nombre para guardarla.');
        await T.guardarPlantilla(est.carpeta, r, nombrePlantilla.value.trim()); await refrescar();
      }) })
    ]);

    Dm.montar([h('div', { class: 'dos' }, [
      h('div', {}, [
        r.porIA ? h('p', { class: 'etiqueta-ia', id: 'etiquetaIA', texto: g.PantallaClaude.ETIQUETA }) : null,
        h('h2', { class: 'titulo-paso', texto: 'Rúbrica de «' + act.titulo + '»' }),
        h('div', { class: 'tabla-ancha' }, [h('table', { class: 'rubrica', id: 'tablaRubrica' }, [h('thead', {}, [cabeza]), h('tbody', {}, filas)])]),
        h('div', { class: 'fila' }, [
          h('button', { type: 'button', class: 'boton', id: 'anadirFila', texto: 'Añadir fila', onclick: cambiar(function () { return R.anadirFila(r, multi ? crit[crit.length - 1] : null); }) }),
          h('button', { type: 'button', class: 'boton principal', id: 'usarCalificar', texto: 'Usar para calificar', onclick: intentar(async function () {
            if (!r.filas.some(function (f) { return f.texto.trim(); })) throw new Error('Escribe qué se mira en al menos una fila.');
            var malas = R.problemas(r, crit);
            if (malas.length) throw new Error(malas.join('. ') + '.');
            await guardar(r); est.paso = 'calificar'; await refrescar();
          }) })
        ]),
        aviso, avisoCriterios
      ]),
      lateral
    ])]);
  }

  g.PantallaRubrica = { pintarRubrica: pintarRubrica };
})(window);
