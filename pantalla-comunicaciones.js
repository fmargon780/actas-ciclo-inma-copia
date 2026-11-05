/* Comunicaciones a familias (fila 109): la lista de las del curso (circulares y autorizaciones de salida) y la entrada a cada una. Se abre desde Inicio.
   El editor está en pantalla-comunicacion-editor.js y las autorizaciones entregadas en pantalla-comunicacion-entregas.js. Cada comunicación se guarda sola en ACTAS/comunicaciones/. */
(function (g) {
  'use strict';
  var h = g.Dom.h, C = g.Comunicacion, T = g.Tutoria;

  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function dia(iso) { try { return g.fechaCorta(iso); } catch (e) { return iso || ''; } }

  async function alumnadoDe(est, tut) {
    await g.Rubricas.cargar(est);
    var l = est.alumnado && est.alumnado.lista;
    return l ? T.alumnadoDelGrupo(l, tut.grupo) : [];
  }

  /* --- la lista --- */
  async function pintarLista(est, alInicio, tut, lista) {
    var aviso = h('div', { class: 'aviso ok', id: 'avisoLista', hidden: '' }), curso = (est.ficha && est.ficha.curso) || g.cursoEscolar(hoyIso());
    function decir(t) { aviso.textContent = t || ''; aviso.hidden = !t; }
    async function nueva(tipo) {
      var alumnos = await alumnadoDe(est, tut);
      est.comunicacionActual = C.nueva(tipo, tut, est.ficha, alumnos, hoyIso(), new Date());
      est.refrescar();
    }
    var items = lista.map(function (c) {
      var confirmar = h('span', { class: 'confirmar', hidden: '' }), botones = h('span', { class: 'botones' });
      botones.appendChild(h('button', { type: 'button', class: 'boton principal', 'data-accion': 'abrir-comunicacion', texto: c.estado === 'creada' ? 'Abrir' : 'Seguir', onclick: function () { est.comunicacionActual = c; est.refrescar(); } }));
      if (c.estado === 'creada' && c.documentos) {
        [['pdf', 'Abrir PDF'], ['docx', 'Abrir Word']].forEach(function (x) {
          botones.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'abrir-' + x[0], texto: x[1], onclick: async function () {
            decir((await g.Envios.abrir(est.raiz, c, x[0])) === 'falta' ? 'No encuentro el fichero en la carpeta ACTAS.' : '');
          } }));
        });
      }
      botones.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'borrar', texto: 'Borrar', onclick: function () { botones.hidden = true; confirmar.hidden = false; } }));
      confirmar.appendChild(h('span', { texto: '¿Borrar esta comunicación? ' }));
      confirmar.appendChild(h('button', { type: 'button', class: 'boton peligro', 'data-accion': 'si-borrar', texto: 'Sí, borrar', onclick: async function () {
        await C.borrar(est.raiz, c.id); est.comunicacionActual = null; await pintarComunicaciones(est, alInicio); decirDespues('Borrada. Sus ficheros de la carpeta no se tocan.');
      } }));
      confirmar.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'no-borrar', texto: 'No', onclick: function () { confirmar.hidden = true; botones.hidden = false; } }));
      var chips = [h('span', { class: 'etiqueta', 'data-tipo': c.tipo, texto: C.TIPOS[c.tipo].etiqueta })];
      if (c.estado !== 'creada') chips.push(h('span', { class: 'etiqueta cambiadas', 'data-estado': 'borrador', texto: 'Borrador' }));
      if (C.esAutorizacion(c) && c.estado === 'creada') {
        var n = C.contarEntregas(c);
        chips.push(h('span', { class: 'etiqueta ' + (n.todas ? 'hecho' : 'cambiadas'), 'data-entregas': n.si + '/' + n.total, texto: n.si + ' de ' + n.total + ' entregadas' }));
      }
      var cuando = dia(c.fecha) + (C.esAutorizacion(c) && c.salida && c.salida.dia ? ' · salida el ' + dia(c.salida.dia) : '');
      return h('li', { class: 'borrador', 'data-id': c.id, 'data-estado': c.estado, 'data-tipo': c.tipo }, [
        h('div', { class: 'datos' }, [h('strong', { texto: C.tituloDe(c) || '(sin título)' }), h('span', { class: 'suave', texto: cuando })]),
        h('span', { class: 'fila' }, chips), botones, confirmar
      ]);
    });
    function decirDespues(t) { var a = document.getElementById('avisoLista'); if (a) { a.textContent = t; a.hidden = false; } }
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: alInicio }),
        h('h2', { class: 'subtitulo', texto: 'Comunicaciones a familias' }), h('span', { class: 'etiqueta', id: 'grupoComunicaciones', texto: tut.grupo }), h('span', { class: 'suave', texto: 'Curso ' + curso })]),
      h('div', { class: 'fila' }, [
        h('button', { type: 'button', class: 'boton principal grande', id: 'nuevaCircular', texto: 'Nueva circular', onclick: function () { nueva('circular'); } }),
        h('button', { type: 'button', class: 'boton principal grande', id: 'nuevaAutorizacion', texto: 'Nueva autorización de salida', onclick: function () { nueva('autorizacion'); } })]),
      aviso,
      h('section', { class: 'tarjeta' }, [lista.length ? h('ul', { class: 'borradores', id: 'listaComunicaciones' }, items) : h('p', { class: 'suave', id: 'sinComunicaciones', texto: 'Aún no hay comunicaciones este curso.' })])
    ]);
  }

  async function pintarComunicaciones(est, alInicio) {
    var salida = function () { est.comunicacionActual = null; alInicio(); };
    var tut = await T.leerTutoria(est.raiz);
    if (!tut) {
      var repintar = function () { pintarComunicaciones(est, alInicio); };
      g.Dom.montar([
        h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: salida }), h('h2', { class: 'subtitulo', texto: 'Comunicaciones a familias' })]),
        h('p', { id: 'pedirTutoria', texto: 'Antes de empezar, dime cuál es tu grupo de tutoría.' }), await g.PantallaTutoria.tarjeta(est, repintar, repintar)
      ]);
      return;
    }
    var c = est.comunicacionActual;
    if (c) { await g.PantallaComunicacionEditor.pintar(est, tut, c, function () { est.comunicacionActual = null; est.refrescar(); }); return; }
    await pintarLista(est, salida, tut, C.delCurso(await C.listar(est.raiz), (est.ficha && est.ficha.curso) || ''));
  }

  g.PantallaComunicaciones = { pintarComunicaciones: pintarComunicaciones, hoyIso: hoyIso, dia: dia, alumnadoDe: alumnadoDe };
})(window);
