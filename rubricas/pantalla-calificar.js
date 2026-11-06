/* Paso 5 · Calificar: un alumno por fila, una columna por fila de la rúbrica y un toque por nivel. Cada toque se guarda al momento.
   «Cómo va» a la derecha y el listado para Séneca (notas de un criterio, orden alfabético, para copiar o descargar). */
(function (g) {
  'use strict';
  var R = g.Rubrica, T = g.Trabajo, D = g.RubDatos, Dm = g.RubDom, h = Dm.h;
  var fmt = function (n) { return n == null ? '–' : (Math.round(n * 10) / 10).toString().replace('.', ','); };

  /* Notas de un criterio en un grupo: una entrada { nombre → nota } por cada actividad del grupo que lo evalúa
     (con varios criterios en la actividad, la nota de ese criterio sale solo de sus filas). */
  async function notasDelCriterio(est, criterioId, grupo, valores) {
    var out = [], acts = await T.actividades(est.carpeta);
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a.grupo !== grupo || a.criterios.indexOf(criterioId) < 0) continue;
      var r = await T.rubricaDe(est.carpeta, a.id), c = await T.calificacionDe(est.carpeta, a.id, grupo);
      if (!r) continue;
      var m = {}; Object.keys(c.notas).forEach(function (n) { var v = R.notasPorCriterio(r, a.criterios, valores, c.notas[n])[criterioId]; if (v != null) m[n] = v; });
      out.push(m);
    }
    return out;
  }

  async function pintarCalificar(est, refrescar) {
    var act = est.actividad, r = est.rubrica || await T.rubricaDe(est.carpeta, act.id);
    if (!r) { est.paso = 'rubrica'; await refrescar(); return; }
    est.rubrica = r;
    var gr = est.grupos.filter(function (x) { return x.id === act.grupo; })[0];
    var alumnos = await D.leerAlumnado(est.carpeta, act.grupo);
    var vals = est.config.niveles.map(function (n) { return n.valor; });
    if (!alumnos.length) {
      Dm.montar([h('div', { class: 'vacio' }, [h('h2', { texto: 'Faltan los alumnos' }),
        h('p', { texto: 'El grupo ' + (gr ? gr.nombre : act.grupo) + ' no tiene alumnos. Súbelos en «Mis grupos».' })])]);
      return;
    }
    var cal = await T.calificacionDe(est.carpeta, act.id, act.grupo);
    var aviso = Dm.aviso();
    var orden = R.ordenar(alumnos);
    var crit = act.criterios || [], grupos = R.agrupar(r, crit).filter(function (x) { return x.filas.length; }), multi = grupos.length > 1;
    var filasOrden = []; grupos.forEach(function (x) { x.filas.forEach(function (f) { filasOrden.push(f); }); });
    var etiqueta = function (id) { return id ? R.etiquetaCriterio(id, crit) : 'Sin criterio'; };

    var panel = h('aside', { class: 'tarjeta lateral', id: 'comoVa' });
    var celdasNota = {}, botones = {};
    var pintarPanel = function () {
      var s = R.resumen(r, vals, alumnos, cal.notas);
      panel.textContent = '';
      panel.appendChild(h('h2', { texto: 'Cómo va' }));
      panel.appendChild(h('p', { id: 'vaCalificados', texto: 'Calificados: ' + s.calificados + ' de ' + s.total }));
      panel.appendChild(h('p', { id: 'vaMedia', texto: multi ? 'Media del grupo · ' + grupos.map(function (x) { return etiqueta(x.criterio) + ': ' + fmt(R.resumen({ filas: x.filas }, vals, alumnos, cal.notas).media); }).join(' · ') : 'Media del grupo: ' + fmt(s.media) }));
      panel.appendChild(h('p', { id: 'vaFloja', texto: s.filaFloja ? 'Fila más floja: ' + (s.filaFloja.texto || '(sin texto)') + ' (' + fmt(s.filaFloja.media) + ')' : 'Fila más floja: aún no hay notas' }));
    };
    var pintarAlumno = function (a) {
      var e = cal.notas[a] || {};
      grupos.forEach(function (x, i) { celdasNota[a][i].textContent = fmt(R.nota({ filas: x.filas }, vals, e)); });
      r.filas.forEach(function (f) {
        botones[a + '|' + f.id].forEach(function (b, k) { var on = e[f.id] === k; b.classList.toggle('puesto', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      });
    };
    var elegir = async function (a, f, k) {
      var e = cal.notas[a] = cal.notas[a] || {};
      if (e[f.id] === k) delete e[f.id]; else e[f.id] = k;
      try { Dm.decir(aviso, ''); await T.guardarCalificacion(est.carpeta, cal); pintarAlumno(a); pintarPanel(); }
      catch (x) { Dm.decir(aviso, 'No he podido guardar: ' + (x.message || x)); }
    };

    var colFila = function (f) { return h('th', { class: 'colfila', texto: f.texto || '(sin texto)' }); };
    var cabeza = multi ? [
      h('tr', {}, [h('th', { rowspan: '2', texto: 'Alumno/a' })].concat(grupos.map(function (x) {
        return h('th', { class: 'critgrupo', 'data-criterio-titulo': x.criterio, colspan: String(x.filas.length), texto: R.tituloCriterio(x.criterio, crit, g.Criterios, act.curso) });
      })).concat([h('th', { class: 'nota', colspan: String(grupos.length), texto: 'Notas' })])),
      h('tr', {}, filasOrden.map(colFila).concat(grupos.map(function (x) { return h('th', { class: 'nota', texto: etiqueta(x.criterio) }); })))
    ] : [h('tr', {}, [h('th', { texto: 'Alumno/a' })].concat(filasOrden.map(colFila)).concat([h('th', { class: 'nota', texto: 'Nota' })]))];
    var cuerpo = orden.map(function (a) {
      var tds = filasOrden.map(function (f) {
        var bs = est.config.niveles.map(function (n, k) {
          /* En un curso pasado los niveles se ven pero no son botones: no hay nada que pulsar. */
          var cuerpo = { class: 'nivelBtn n' + k, 'data-alumno': a, 'data-fila': f.id, 'data-nivel': String(k), title: n.nombre + ' (' + n.valor + ')', 'aria-label': a + ': ' + n.nombre, 'aria-pressed': 'false', texto: R.CORTOS[k] };
          if (est.editable === false) return h('span', cuerpo);
          cuerpo.type = 'button'; cuerpo.onclick = function () { elegir(a, f, k); };
          return h('button', cuerpo);
        });
        botones[a + '|' + f.id] = bs;
        return h('td', {}, [h('div', { class: 'niveles' }, bs)]);
      });
      celdasNota[a] = grupos.map(function (x) { var d = { class: 'nota', 'data-nota': a, texto: '–' }; if (multi) d['data-criterio'] = x.criterio; return h('td', d); });
      return h('tr', {}, [h('th', { class: 'alumno', texto: a })].concat(tds).concat(celdasNota[a]));
    });

    var salida = h('div', { id: 'zonaListado' });
    var listado = h('div', { class: 'tarjeta' }, [h('h2', { texto: 'Listado para Séneca' })]);
    var copiarTexto = function (boton, texto, caja) {
      return async function () { try { await navigator.clipboard.writeText(texto); boton.textContent = 'Copiado'; } catch (x) { if (caja) caja.select(); boton.textContent = 'Selecciona y copia (Ctrl+C)'; } };
    };
    var selCrit = h('select', { id: 'selCriterioListado', 'aria-label': 'Criterio del listado' }, crit.map(function (id) { return h('option', { value: id, texto: id.split(':')[1] }); }));
    /* Una actividad con varios criterios: tabla con una columna por criterio, cada una con su «Copiar». */
    var prepararTabla = async function () {
      var cols = [];
      for (var i = 0; i < crit.length; i++) cols.push({ id: crit[i], etiqueta: etiqueta(crit[i]), notasPorActividad: await notasDelCriterio(est, crit[i], act.grupo, vals) });
      var t = R.tablaSeneca(alumnos, cols);
      var tabla = h('table', { class: 'listado-seneca', id: 'tablaListado' }, [
        h('thead', {}, [h('tr', {}, [h('th', { texto: 'Alumno/a' })].concat(t.columnas.map(function (c, i) {
          var b = h('button', { type: 'button', class: 'boton', 'data-copiar': c.id, texto: 'Copiar' });
          b.onclick = copiarTexto(b, R.textoColumna(t, i));
          return h('th', { 'data-columna': c.id }, [h('span', { texto: c.etiqueta }), b]);
        })))]),
        h('tbody', {}, t.filas.map(function (f) { return h('tr', {}, [h('th', { class: 'alumno', texto: f.nombre })].concat(f.notas.map(function (n) { return h('td', { class: 'nota', texto: n == null ? '' : fmt(n) }); }))); }))
      ]);
      var url = URL.createObjectURL(new Blob([R.csvTabla(t)], { type: 'text/csv;charset=utf-8' }));
      var bajar = h('a', { class: 'boton', id: 'descargarListado', href: url, download: 'notas-' + act.id + '-' + act.grupo + '.csv', texto: 'Descargar (CSV, todas las columnas)' });
      salida.textContent = '';
      [h('p', { class: 'suave', texto: (gr ? gr.nombre : act.grupo) + ' · orden alfabético. Cada columna es un criterio: copia la que vayas a pasar. Séneca no admite que una aplicación le meta datos: pégalo a mano.' }), h('div', { class: 'tabla-ancha' }, [tabla]), h('div', { class: 'fila' }, [bajar])].forEach(function (n) { salida.appendChild(n); });
    };
    var preparar = h('button', { type: 'button', class: 'boton principal', id: 'prepararListado', texto: 'Preparar listado para Séneca', onclick: async function () {
      try {
        if (crit.length > 1) { await prepararTabla(); return; }
        var filas = R.listadoSeneca(alumnos, await notasDelCriterio(est, selCrit.value, act.grupo, vals));
        var texto = R.textoListado(filas);
        var caja = h('textarea', { id: 'textoListado', readonly: '', rows: String(Math.min(filas.length, 12) + 1) }); caja.value = texto;
        var copiar = h('button', { type: 'button', class: 'boton', id: 'copiarListado', texto: 'Copiar' });
        copiar.onclick = copiarTexto(copiar, texto, caja);
        var url = URL.createObjectURL(new Blob([R.csvListado(filas)], { type: 'text/csv;charset=utf-8' }));
        var bajar = h('a', { class: 'boton', id: 'descargarListado', href: url, download: 'notas-' + selCrit.value.replace(':', '-') + '-' + act.grupo + '.csv', texto: 'Descargar (CSV)' });
        salida.textContent = '';
        [h('p', { class: 'suave', texto: 'Criterio ' + selCrit.value.split(':')[1] + ' · ' + (gr ? gr.nombre : act.grupo) + ' · orden alfabético. Séneca no admite que una aplicación le meta datos: cópialo y pégalo a mano.' }), caja, h('div', { class: 'fila' }, [copiar, bajar])].forEach(function (n) { salida.appendChild(n); });
      } catch (x) { Dm.decir(aviso, x.message || String(x)); }
    } });
    [h('div', { class: 'fila' }, [crit.length > 1 ? null : selCrit, preparar]), salida].forEach(function (n) { listado.appendChild(n); });

    Dm.montar([h('div', { class: 'dos' }, [
      h('div', {}, [
        h('h2', { class: 'titulo-paso', texto: act.titulo + ' · ' + (gr ? gr.nombre : act.grupo) }),
        h('div', { class: 'tabla-ancha' }, [h('table', { class: 'calificar', id: 'tablaCalificar' }, [h('thead', {}, cabeza), h('tbody', {}, cuerpo)])]),
        aviso, listado
      ]),
      panel
    ])]);
    orden.forEach(pintarAlumno); pintarPanel();
  }

  g.PantallaCalificar = { pintarCalificar: pintarCalificar };
})(window);
