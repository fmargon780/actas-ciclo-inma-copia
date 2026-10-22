/* «Mi tutoría» (fila 41): todo el grupo de tutoría de Inma de un vistazo. Por alumno: la fecha de su última entrevista terminada (o «Sin entrevista») y cuántos
   compromisos tiene pendientes; al pulsar el nombre se despliegan con su casilla. Marcar una casilla escribe en la propia entrevista (ACTAS/entrevistas/). */
(function (g) {
  'use strict';
  var h = g.Dom.h, T = g.Tutoria, A = g.Alumnado;
  var QUIEN = [['tutora', 'De la tutora'], ['familia', 'De la familia']];

  function fechaCorta(iso) { try { return g.fechaCorta(iso); } catch (e) { return iso; } }
  function clave(a) { return a.nombre + '|' + a.grupo; }

  async function pintarMiTutoria(est, alInicio) {
    var repintar = function () { pintarMiTutoria(est, alInicio); };
    var cabecera = h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: alInicio }), h('h2', { class: 'subtitulo', texto: 'Mi tutoría' })]);
    var tut = await T.leerTutoria(est.raiz);
    if (!tut) {
      g.Dom.montar([cabecera, h('p', { id: 'pedirTutoria', texto: 'Antes de empezar, dime cuál es tu grupo de tutoría.' }), await g.PantallaTutoria.tarjeta(est, repintar, repintar)]);
      return;
    }
    await g.Rubricas.cargar(est);
    var lista = est.alumnado && est.alumnado.lista, alumnos = lista ? T.alumnadoDelGrupo(lista, tut.grupo) : [];
    var curso = (est.ficha && est.ficha.curso) || '';
    var abiertos = {}, cumplidos = {};
    var zona = h('div', { id: 'listaTutoria', class: 'grupo-tutoria' }), resumen = h('p', { id: 'resumenTutoria', class: 'resumen-tutoria' });
    var entrevistas = await T.listarEntrevistas(est.raiz);

    function nuevaEntrevista(alumno) {
      var previa = T.sinTerminar(T.delCurso(entrevistas, curso), alumno);
      est.paso = 'entrevista'; est.entrevistaId = null; est.borrador = null;
      est.entrevistaActual = previa || T.nueva(alumno, hoy(), new Date());
      est.refrescar();
    }
    function hoy() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

    function detalle(r) {
      var k = clave(r.alumno), todos = T.compromisosDe(T.delCurso(entrevistas, curso), r.alumno);
      var visibles = todos.filter(function (c) { return cumplidos[k] || !c.hecho; });
      var nodos = [];
      QUIEN.forEach(function (q) {
        var suyos = visibles.filter(function (c) { return (c.quien === 'tutora') === (q[0] === 'tutora'); });
        if (!suyos.length) return;
        nodos.push(h('strong', { texto: q[1] }), h('ul', { class: 'compromisos', 'data-quien': q[0] }, suyos.map(function (c) {
          var casilla = h('input', { type: 'checkbox', 'data-compromiso': c.entrevistaId + ':' + c.indice });
          casilla.checked = c.hecho;
          casilla.onchange = async function () {
            await T.marcarCompromiso(est.raiz, c.entrevistaId, c.indice, casilla.checked, new Date());
            entrevistas = await T.listarEntrevistas(est.raiz); pintarLista();
          };
          return h('li', {}, [h('label', {}, [casilla, ' ', h('span', { class: 'suave', texto: fechaCorta(c.fecha) + ' · ' }), c.texto])]);
        })));
      });
      if (!nodos.length) nodos.push(h('p', { class: 'suave', texto: todos.length ? 'No queda ningún compromiso pendiente.' : 'Todavía no hay compromisos.' }));
      var hayHechos = todos.some(function (c) { return c.hecho; }), acciones = [
        h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'nueva-entrevista', texto: 'Nueva entrevista', onclick: function () { nuevaEntrevista(r.alumno); } })
      ];
      if (hayHechos) acciones.push(h('button', { type: 'button', class: 'enlace', 'data-accion': 'ver-cumplidos', texto: cumplidos[k] ? 'Ocultar cumplidos' : 'Ver cumplidos', onclick: function () { cumplidos[k] = !cumplidos[k]; pintarLista(); } }));
      return h('div', { class: 'detalle-tutoria' }, nodos.concat([h('div', { class: 'fila' }, acciones)]));
    }

    function fila(r) {
      var k = clave(r.alumno), abierto = !!abiertos[k];
      var nombre = h('button', { type: 'button', class: 'enlace nombre-alumno', 'data-accion': 'desplegar', 'aria-expanded': String(abierto), texto: (abierto ? '▾ ' : '▸ ') + r.alumno.nombre,
        onclick: function () { abiertos[k] = !abiertos[k]; pintarLista(); } });
      var datos = [];
      if (r.ultima) {
        datos.push(h('button', { type: 'button', class: 'enlace fecha-entrevista', 'data-accion': 'abrir-entrevista', texto: fechaCorta(r.ultima.fecha), onclick: function () { est.abrirEntrevista(r.ultima.id); } }));
        datos.push(h('span', { class: 'pendientes ' + (r.pendientes.length ? 'hay' : ''), 'data-pendientes': String(r.pendientes.length), texto: r.pendientes.length + (r.pendientes.length === 1 ? ' pendiente' : ' pendientes') }));
      } else datos.push(h('span', { class: 'sin-entrevista-texto', texto: 'Sin entrevista' }));
      if (r.enCurso) datos.push(h('span', { class: 'suave', texto: 'en curso' }));
      return h('div', { class: 'alumno-tutoria' + (r.ultima ? '' : ' sin-entrevista'), 'data-alumno': r.alumno.nombre }, [h('div', { class: 'linea-alumno' }, [nombre, h('span', { class: 'datos-alumno' }, datos)])].concat(abierto ? [detalle(r)] : []));
    }

    function pintarLista() {
      var filas = T.resumenGrupo(alumnos, T.delCurso(entrevistas, curso), curso);
      var hechas = filas.filter(function (r) { return r.ultima; }).length;
      resumen.textContent = 'Entrevistas hechas: ' + hechas + ' de ' + filas.length;
      zona.textContent = '';
      filas.forEach(function (r) { zona.appendChild(fila(r)); });
    }
    var nodos = [cabecera, h('p', { class: 'suave', texto: 'Tu tutoría: ' + tut.grupo + (tut.tutora ? ' · ' + tut.tutora : '') + '. Se cambia en Ajustes.' }), resumen];
    var aviso = g.PantallaFichas.avisoRubricas(est, repintar);
    if (aviso) nodos.push(aviso);
    if (lista && !alumnos.length) nodos.push(h('div', { class: 'aviso', id: 'grupoVacio', texto: 'No hay alumnado de ' + tut.grupo + ' en la lista de Rúbricas. Revisa tu grupo en Ajustes.' }));
    nodos.push(zona);
    g.Dom.montar(nodos);
    pintarLista();
  }

  g.PantallaMiTutoria = { pintarMiTutoria: pintarMiTutoria };
})(window);
