/* Fichas del alumnado (fila 16): buscar a un alumno, ver lo dicho de él en las actas creadas, imprimir y copiar. */
(function (g) {
  'use strict';
  var h = g.Dom.h, F = g.Fichas, A = g.Alumnado;

  async function copiar(f) {
    var html = F.aHtml(f), texto = F.aTexto(f);
    try {
      if (g.ClipboardItem && g.navigator.clipboard && g.navigator.clipboard.write) {
        await g.navigator.clipboard.write([new g.ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([texto], { type: 'text/plain' }) })]);
        return true;
      }
    } catch (e) { /* se prueba el texto plano */ }
    try { await g.navigator.clipboard.writeText(texto); return true; } catch (e) { return false; }
  }

  function fechaDe(iso) { try { return g.fechaLarga(iso); } catch (e) { return iso; } }

  function verFicha(f, volver, otro, abrir) {
    var aviso = h('span', { class: 'suave', id: 'avisoCopiada', 'aria-live': 'polite' });
    var cuerpo = [h('h2', { 'data-ficha': 'titulo', texto: 'Ficha de ' + A.etiqueta(f.alumno) })];
    if (f.curso) cuerpo.push(h('p', { class: 'suave', 'data-ficha': 'curso', texto: 'Curso ' + f.curso }));
    if (!f.reuniones.length) cuerpo.push(h('p', { class: 'aviso', id: 'fichaVacia', texto: F.VACIA + '.' }));
    f.reuniones.forEach(function (r) {
      if (r.entrevista) {
        cuerpo.push(h('div', { class: 'reunion-ficha entrevista-ficha', 'data-fecha': r.fecha, 'data-entrevista': r.entrevista.id }, [
          h('h3', {}, [F.TITULO_ENTREVISTA + ' — ', h('button', { type: 'button', class: 'boton chico no-imprimir', 'data-accion': 'abrir-entrevista', title: 'Abrir esta entrevista', texto: fechaDe(r.fecha), onclick: function () { abrir(r.entrevista.id); } }), h('span', { class: 'solo-imprimir', texto: fechaDe(r.fecha) })])
        ].concat(F.CAJAS_ENTREVISTA.filter(function (c) { return r.entrevista.textos[c[0]]; }).map(function (c) {
          return h('div', { class: 'punto-ficha' }, [h('strong', { texto: c[1] })].concat(String(r.entrevista.textos[c[0]]).split(/\n+/).filter(Boolean).map(function (x) { return h('p', { class: 'texto-enviado', texto: x }); })));
        }))));
        return;
      }
      cuerpo.push(h('div', { class: 'reunion-ficha', 'data-fecha': r.fecha }, [h('h3', { texto: 'Reunión del ' + fechaDe(r.fecha) })].concat(r.puntos.map(function (p) {
        return h('div', { class: 'punto-ficha' }, [h('strong', { texto: p.titulo })].concat(p.parrafos.map(function (x) { return h('p', { class: 'texto-enviado', texto: x }); })));
      }))));
    });
    cuerpo.push(h('p', { class: 'suave pie-ficha', texto: F.AVISO_PIE + '.' }));
    var botones = h('div', { class: 'botones no-imprimir' }, [
      h('button', { type: 'button', class: 'boton', 'data-accion': 'volver-inicio', texto: 'Volver al inicio', onclick: volver }),
      h('button', { type: 'button', class: 'boton', 'data-accion': 'otro-alumno', texto: 'Elegir otro alumno', onclick: otro }),
      h('button', { type: 'button', class: 'boton', 'data-accion': 'imprimir-ficha', texto: 'Imprimir', onclick: function () { g.print(); } }),
      h('button', { type: 'button', class: 'boton principal', 'data-accion': 'copiar-ficha', texto: 'Copiar', onclick: async function () {
        aviso.textContent = (await copiar(f)) ? 'Ficha copiada' : 'No he podido copiar la ficha';
      } }),
      aviso
    ]);
    g.Dom.montar([botones, h('div', { class: 'ficha', id: 'ficha' }, cuerpo)]);
  }

  /* El aviso de la carpeta RÚBRICAS (el mismo de la fila 15): la ficha funciona igual con los alumnos citados en las actas. */
  function avisoRubricas(est, repintar, textoSinCarpeta) {
    var a = est.alumnado, texto = '', boton = 'Abrir la carpeta RÚBRICAS', permiso = false;
    if (!a || a.estado === 'ok') return null;
    if (a.estado === 'sinCarpeta') texto = a.texto || textoSinCarpeta || 'Para buscar en toda la lista de alumnado, abre una vez la carpeta RÚBRICAS (Mi unidad › RÚBRICAS). Solo la leo: no escribo nada en ella.';
    else if (a.estado === 'sinPermiso') { texto = 'Chrome necesita tu permiso para abrir la carpeta RÚBRICAS. Pulsa «Dar permiso» y, en la ventana de Chrome, elige «Permitir en cada visita»: así no te lo volverá a pedir en este dispositivo.'; boton = 'Dar permiso'; permiso = true; }
    else if (a.estado === 'vacia') texto = 'En la carpeta RÚBRICAS no hay alumnado de este ciclo todavía.';
    else texto = a.texto;
    var caja = h('div', { class: 'aviso', id: 'avisoAlumnado' }, [h('span', { id: 'textoAvisoAlumnado', texto: texto + ' ' })]);
    caja.appendChild(h('button', { type: 'button', class: 'boton chico principal', id: 'abrirRubricas', texto: boton, onclick: async function () {
      var mal = permiso ? (await g.Rubricas.darPermiso(est), '') : await g.Rubricas.abrir(est);
      if (mal) caja.appendChild(h('div', { class: 'aviso error', id: 'errorRubricas', texto: mal })); else repintar();
    } }));
    var info = g.Ayuda.aviso('carpeta-rubricas');
    if (info) caja.appendChild(info);
    return caja;
  }

  async function pintarFichas(est, alInicio) {
    var actas = await F.leerActas(est.raiz, est.ficha);
    await g.Rubricas.cargar(est);
    var repintar = function () { pintarFichas(est, alInicio); };
    var curso = (est.ficha && est.ficha.curso) || '';
    var lista = { estado: 'ok', lista: { delCiclo: F.candidatos(est.alumnado && est.alumnado.lista, actas), grupos: [] } };
    var buscador = g.BuscadorAlumno.crear('', function () { return lista; }, async function (a) {
      var ents = g.Tutoria ? g.Tutoria.terminadas(g.Tutoria.deAlumno(await g.Tutoria.listarEntrevistas(est.raiz), a)) : [];
      verFicha(F.ficha(actas, a, curso, ents), alInicio, repintar, est.abrirEntrevista);
    }, alInicio, { sinLibre: true });
    var nodos = [h('h2', { texto: 'Fichas del alumnado' }), h('p', { class: 'suave', texto: 'Elige a un alumno para ver lo que se ha dicho de él en las actas creadas con Mis actas.' })];
    var aviso = avisoRubricas(est, repintar);
    if (aviso) nodos.push(aviso);
    nodos.push(buscador.elemento);
    g.Dom.montar(nodos);
    buscador.enfocar();
  }

  g.PantallaFichas = { pintarFichas: pintarFichas, avisoRubricas: avisoRubricas };
})(window);
