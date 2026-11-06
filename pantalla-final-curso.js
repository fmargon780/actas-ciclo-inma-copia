/* «Final de curso» (fila 101): todo el grupo de tutoría con el estado de su informe (Sin empezar, Con notas, Redactado o Hecho), «Hechos N de M», «Redactar todos»
   y, al elegir un alumno, su detalle (pantalla-final-curso-detalle.js). El informe que toca sale solo del curso del grupo de tutoría:
   1.º, 3.º y 5.º «Informe de final de curso»; 2.º y 4.º «Informe final de ciclo»; 6.º «Informe final de etapa» (con el tránsito dentro). Se guarda en ACTAS/final-curso/. */
(function (g) {
  'use strict';
  var h = g.Dom.h, F = g.FinalCurso, S = g.FinalCursoSabe, T = g.Tutoria, A = g.Alumnado;

  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function clave(a) { return a.nombre + '|' + a.grupo; }
  function visible(a) { return a.apellidos ? a.apellidos + ', ' + a.pila : a.nombre; }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  async function pintarFinalCurso(est, alInicio) {
    var repintar = function () { pintarFinalCurso(est, alInicio); };
    var cabecera = h('div', { class: 'barra-form' }, [h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: '← Volver al inicio', onclick: alInicio }), h('h2', { class: 'subtitulo', texto: 'Final de curso' })]);
    var tut = await T.leerTutoria(est.raiz);
    if (!tut) {
      g.Dom.montar([cabecera, h('p', { id: 'pedirTutoria', texto: 'Antes de empezar, dime cuál es tu grupo de tutoría.' }), await g.PantallaTutoria.tarjeta(est, repintar, repintar)]);
      return;
    }
    var tipo = F.tipoDeGrupo(tut.grupo);
    if (!tipo) {
      g.Dom.montar([cabecera, h('div', { class: 'aviso', id: 'cursoNoReconocido', texto: 'No reconozco el curso de tu grupo «' + tut.grupo + '». Cámbialo en Ajustes: el nombre tiene que empezar por el número del curso, por ejemplo «6º A».' })]);
      return;
    }
    await g.Rubricas.cargar(est);
    var lista = est.alumnado && est.alumnado.lista, todos = lista ? lista.todos : [];
    var alumnos = (lista ? T.alumnadoDelGrupo(lista, tut.grupo) : []).slice().sort(function (a, b) {
      var x = A.normalizar(a.apellidos + ' ' + a.pila), y = A.normalizar(b.apellidos + ' ' + b.pila);
      return x < y ? -1 : x > y ? 1 : 0;
    });
    var hoy = hoyIso(), curso = g.cursoEscolar(hoy);
    var raizRub = est.alumnado && est.alumnado.estado === 'ok' && est.alumnado.raiz ? est.alumnado.raiz : null;
    var fuentes = await S.leerFuentes(est.raiz, raizRub, tut.grupo, curso, hoy), guardados = F.delCurso(await F.listar(est.raiz), curso), informes = {};
    var sel = alumnos.length ? 0 : -1;

    /* El informe de cada alumno: el guardado o uno nuevo (que no se guarda hasta que haya algo). */
    function informe(i) {
      var a = alumnos[i], k = clave(a);
      if (!informes[k]) {
        informes[k] = F.existente(guardados, a, curso, tipo.id) || F.nueva(a, tipo.id, hoy, new Date());
        if (!informes[k].alumno.genero) informes[k].alumno.genero = S.generoDe(a, fuentes);
      }
      return informes[k];
    }
    function sabeDe(i) { return S.sabe(alumnos[i], curso, fuentes, hoy); }

    /* La memoria final de tutoría (fila 108): una tarjeta encima de los informes. */
    var memoria = await g.Memoria.existente(est.raiz, tut.grupo, curso);
    function hechosInformes() { var fs = alumnos.map(function (a, i) { return informe(i); }); return { hechos: F.contarHechos(fs), total: fs.length }; }
    function ctxMemoria() { return { est: est, tut: tut, curso: curso, hoy: hoy, alumnos: alumnos, fuentes: fuentes, todos: todos, informes: hechosInformes, volver: repintar }; }
    function tarjetaMemoria() {
      var d = g.PantallaMemoria.calcular(ctxMemoria()), e = g.Memoria.estado(memoria, d);
      return h('section', { class: 'tarjeta memoria', id: 'tarjetaMemoria' }, [
        h('div', { class: 'texto' }, [h('h3', { texto: g.Memoria.NOMBRE }), h('span', { class: 'suave', texto: 'Una sola memoria de todo el grupo, con lo guardado durante el curso.' })]),
        h('span', { class: 'etiqueta ' + e, id: 'estadoMemoria', 'data-estado': e, texto: g.Memoria.ESTADOS[e] }),
        h('button', { type: 'button', class: 'boton principal', id: 'abrirMemoria', texto: 'Abrir la memoria', onclick: async function () { if (est.alSalir) await est.alSalir(); g.PantallaMemoria.pintarMemoria(ctxMemoria()); } })
      ]);
    }

    var resumen = h('span', { class: 'derecha', id: 'resumenFinal' }), ul = h('ul', { class: 'lista-final', id: 'listaFinal' });
    var detalle = h('div', { id: 'zonaDetalle' }), avisoTodos = g.Dom.aviso(), boton = h('button', { type: 'button', class: 'boton principal', id: 'redactarTodos', texto: 'Redactar todos' });
    avisoTodos.id = 'avisoTodos';
    var etiquetas = [];

    function pintarEtiquetas() {
      var fs = alumnos.map(function (a, i) { return informe(i); });
      resumen.textContent = 'Hechos ' + F.contarHechos(fs) + ' de ' + fs.length;
      etiquetas.forEach(function (e, i) { var est1 = F.estado(fs[i]); e.textContent = F.ESTADOS[est1]; e.className = 'etiqueta ' + est1; e.setAttribute('data-estado', est1); });
    }
    function pintarLista() {
      ul.textContent = ''; etiquetas = [];
      alumnos.forEach(function (a, i) {
        var e = h('span', { class: 'etiqueta' }); etiquetas.push(e);
        ul.appendChild(h('li', {}, [h('button', { type: 'button', class: 'alumno-final' + (i === sel ? ' activo' : ''), 'data-alumno': a.nombre, onclick: function () { elegir(i); } }, [h('span', { texto: visible(a) }), e])]));
      });
      pintarEtiquetas();
    }
    function pintarDetalle() {
      detalle.textContent = '';
      if (sel < 0) return;
      var f = informe(sel), auto = g.Autoguardado.crear(est, f, F.guardar);
      detalle.appendChild(g.PantallaFinalCursoDetalle.crear({ est: est, f: f, sabe: sabeDe(sel), todos: todos, tut: tut, cambio: auto.cambio, alCambiar: pintarEtiquetas }).nodo);
    }
    async function elegir(i) { if (est.alSalir) await est.alSalir(); sel = i; pintarLista(); pintarDetalle(); }

    /* «Redactar todos»: de uno en uno, solo a quien aún no tiene texto. Cada alumno gasta una redacción; ante el tope se para y lo redactado se queda. */
    async function redactarTodos() {
      if (est.alSalir) await est.alSalir();
      boton.disabled = true; g.Dom.decir(avisoTodos, '');
      var hechos = 0, ya = 0, sin = [], fallos = [], parada = '';
      for (var i = 0; i < alumnos.length && !parada; i++) {
        var f = informe(i), s = sabeDe(i);
        if (F.hayTextos(f)) { ya++; continue; }
        if (F.problema(f, s)) { sin.push(alumnos[i].nombre); continue; }
        boton.textContent = 'Redactando ' + (hechos + 1) + '…';
        try {
          await g.FinalCursoClaude.redactarInforme(est.raiz, f, s, todos);
          await F.guardar(est.raiz, f, new Date()); hechos++;
        } catch (x) {
          if (x && x.tipo === 'formato') fallos.push(alumnos[i].nombre); else parada = (x && x.message) || String(x);
        }
        pintarEtiquetas();
      }
      var t = 'Claude ha redactado ' + plural(hechos, 'informe', 'informes') + '. ';
      if (ya) t += 'No he tocado ' + ya + (ya === 1 ? ' que ya tenía texto. ' : ' que ya tenían texto. ');
      if (sin.length) t += 'Sin redactar: ' + sin.join(', ') + '. No hay notas ni nada guardado. ';
      if (fallos.length) t += 'Sin redactar por una respuesta ilegible de Claude: ' + fallos.join(', ') + '. Vuelve a intentarlo. ';
      if (parada) t += parada + ' Lo ya redactado se queda.';
      g.Dom.decir(avisoTodos, t.trim());
      avisoTodos.className = 'aviso' + (parada ? ' error' : '');
      boton.textContent = 'Redactar todos'; boton.disabled = false;
      pintarLista(); pintarDetalle();
    }
    boton.onclick = redactarTodos;

    var nodos = [cabecera, h('div', { class: 'barra-final' }, [h('span', { class: 'etiqueta', id: 'tipoFinal', texto: tipo.nombre }),
      h('span', { class: 'suave', id: 'grupoFinal', texto: tut.grupo + ' · curso ' + curso }), g.Ayuda.aviso('final-curso'), resumen, boton])];
    nodos.push(avisoTodos);
    if (alumnos.length) nodos.push(tarjetaMemoria());
    var avisoRub = g.PantallaFichas.avisoRubricas(est, repintar, 'Para ver a tu grupo, abre una vez la carpeta RÚBRICAS (Mi unidad › RÚBRICAS). Solo la leo: no escribo nada en ella.');
    if (avisoRub) nodos.push(avisoRub);
    if (!alumnos.length && !avisoRub) nodos.push(h('p', { class: 'suave', id: 'sinAlumnadoFinal', texto: 'No encuentro alumnado en el grupo ' + tut.grupo + '.' }));
    nodos.push(h('div', { class: 'mesa-final' }, [h('section', { class: 'tarjeta' }, [h('h3', { texto: 'Tu grupo' }), ul]), detalle]));
    g.Dom.montar(nodos.filter(Boolean));
    pintarLista(); pintarDetalle();
  }

  g.PantallaFinalCurso = { pintarFinalCurso: pintarFinalCurso };
})(window);
