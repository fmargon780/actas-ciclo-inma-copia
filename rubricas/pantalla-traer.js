/* «Traer del curso pasado»: botón en «Crear actividad» y «Nueva situación», lista de lo de cursos pasados y elección de grupo y área.
   La copia queda abierta en pantalla con la etiqueta «Traída del curso …». Textos siempre con textContent. */
(function (g) {
  'use strict';
  var Dm = g.RubDom, h = Dm.h, T = g.RubTraer, C = g.Criterios;

  /* Los de cursos pasados, o [] si se mira un curso pasado (ahí no se escribe). */
  async function disponibles(est, tipo) {
    return est.editable ? T.lista(est.raiz, est.configReal, tipo) : [];
  }

  function boton(est, tipo, refrescar, items) {
    if (!items.length) return null;
    return h('button', { type: 'button', class: 'boton', id: 'traerPasado', texto: 'Traer del curso pasado', onclick: function () { elegir(est, tipo, refrescar, items); } });
  }

  function etiqueta(x) { return x && x.origen ? h('p', { class: 'etiqueta-ia', id: 'etiquetaTraida', texto: 'Traída del curso ' + x.origen.curso }) : null; }

  /* Aviso con los criterios quitados al traer (se enseña una sola vez). */
  function aviso(est) {
    var q = est.avisoTraida; est.avisoTraida = null;
    if (!q || !q.length) return null;
    return h('div', { class: 'aviso', id: 'avisoTraida', texto: 'Al traerla he quitado ' + q.length + ' criterio(s) que no están en la lista oficial de este curso y área: ' +
      q.map(function (id) { return '«' + String(id).split(':').slice(1).join(':') + '»'; }).join(', ') + '. Marca los que correspondan.' });
  }

  function elegir(est, tipo, refrescar, items) {
    var areas = [], porCurso = {};
    items.forEach(function (x) { x.areas.forEach(function (a) { if (!areas.some(function (b) { return b.id === a.id; })) areas.push(a); }); });
    var filtro = h('select', { id: 'traerArea', 'aria-label': 'Filtrar por área' }, [h('option', { value: '', texto: 'Todas las áreas' })].concat(areas.map(function (a) { return h('option', { value: a.id, texto: a.nombre }); })));
    var caja = h('div', { id: 'traerLista' });
    var pintar = function () {
      caja.textContent = ''; porCurso = {};
      items.filter(function (x) { return !filtro.value || x.areas.some(function (a) { return a.id === filtro.value; }); }).forEach(function (x) { (porCurso[x.curso] = porCurso[x.curso] || []).push(x); });
      var cursos = Object.keys(porCurso).sort().reverse();
      if (!cursos.length) caja.appendChild(h('p', { class: 'suave', texto: 'No hay nada de esa área.' }));
      cursos.forEach(function (c) {
        caja.appendChild(h('h3', { class: 'suave', texto: 'Curso ' + c }));
        porCurso[c].forEach(function (x) {
          caja.appendChild(h('button', { type: 'button', class: 'boton', 'data-traer': x.curso + '/' + x.id, onclick: function () { destino(est, tipo, refrescar, x); },
            texto: (x.titulo || '(sin título)') + ' · ' + x.grupoNombre + (x.areas.length ? ' · ' + x.areas.map(function (a) { return a.nombre; }).join(', ') : '') }));
        });
      });
    };
    filtro.onchange = pintar; pintar();
    Dm.montar([h('div', { class: 'tarjeta', id: 'panelTraer' }, [
      h('h2', { texto: tipo === 'situacion' ? 'Traer una situación del curso pasado' : 'Traer una actividad del curso pasado' }),
      h('label', { class: 'campo' }, ['Área', filtro]), caja,
      h('button', { type: 'button', class: 'boton', id: 'traerCancelar', texto: 'Cancelar', onclick: function () { refrescar(); } })
    ])]);
  }

  /* Segundo paso: a qué grupo y área del curso actual va. */
  function destino(est, tipo, refrescar, item) {
    var enlace = tipo === 'actividad' ? est.enlace : null;
    var grupoDe = function (id) { return est.grupos.filter(function (x) { return x.id === id; })[0]; };
    var inicial = grupoDe(est.grupo) || est.grupos[0];
    var aviso = Dm.aviso(), areaCaja = h('div', { id: 'traerAreaCaja' });
    var grupo = h('select', { id: 'traerGrupo', 'aria-label': 'Grupo' }, est.grupos.map(function (x) { var o = h('option', { value: x.id, texto: x.nombre }); if (inicial && x.id === inicial.id) o.selected = true; return o; }));
    if (enlace) grupo.disabled = true;
    var area = null;
    var pintarArea = function () {
      areaCaja.textContent = ''; area = null;
      var gr = grupoDe(grupo.value);
      if (!gr || !T.necesitaArea(item, gr) || !gr.areas.length) return;
      area = h('select', { id: 'traerAreaDestino', 'aria-label': 'Área' }, gr.areas.map(function (a) { var o = h('option', { value: a.id, texto: a.nombre }); if (a.id === T.areaPropuesta(item, gr)) o.selected = true; return o; }));
      areaCaja.appendChild(h('label', { class: 'campo' }, [tipo === 'situacion' ? 'Área para las actividades que no encajan' : 'Área', area]));
    };
    grupo.onchange = pintarArea; pintarArea();
    var traer = h('button', { type: 'button', class: 'boton principal', id: 'traerConfirmar', texto: 'Traer', onclick: async function () {
      try {
        Dm.decir(aviso, '');
        var gr = grupoDe(grupo.value);
        if (!gr) throw new Error('Elige el grupo.');
        if (!gr.areas.length) throw new Error('Ese grupo no tiene ninguna área. Añádela en «Mis grupos».');
        var op = { grupo: gr, area: area ? area.value : T.areaPropuesta(item, gr), Criterios: C };
        if (tipo === 'actividad') {
          if (enlace) op.enlace = { sid: enlace.sid, n: enlace.n };
          var r = await T.actividad(est.raiz, est.carpeta, item.curso, item.id, op);
          est.actividad = r.actividad; est.rubrica = null; est.grupo = gr.id; est.areaCrit = r.actividad.area; est.cursoCrit = r.actividad.curso;
          est.trimestre = Number(r.actividad.trimestre) || 1; est.avisoTraida = r.quitados; est.paso = 'actividad';
        } else {
          var s = await T.situacion(est.raiz, est.carpeta, item.curso, item.id, op);
          est.situacion = s.situacion; est.situacionNueva = false; est.grupo = gr.id; est.avisoTraida = s.quitados; est.paso = 'situacion';
        }
        await refrescar();
      } catch (e) { Dm.decir(aviso, e.message || String(e)); }
    } });
    Dm.montar([h('div', { class: 'tarjeta', id: 'panelTraer' }, [
      h('h2', { texto: 'Traer «' + (item.titulo || '(sin título)') + '»' }),
      h('p', { class: 'suave', texto: 'Del curso ' + item.curso + ' (' + item.grupoNombre + '). Se crea una copia en el curso actual, con su rúbrica y su hoja (si la tiene), y sin notas.' }),
      h('label', { class: 'campo' }, ['Grupo', grupo]), areaCaja, aviso,
      h('div', { class: 'fila' }, [traer, h('button', { type: 'button', class: 'boton', id: 'traerCancelar', texto: 'Cancelar', onclick: function () { refrescar(); } })])
    ])]);
  }

  g.RubPantallaTraer = { disponibles: disponibles, boton: boton, etiqueta: etiqueta, aviso: aviso };
})(window);
