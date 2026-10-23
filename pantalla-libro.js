/* «Libro de actas del curso» (fila 56): junta todas las actas del curso en un solo PDF y un solo Word y los guarda en ACTAS › documentos › <curso>. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  async function pintarLibro(est, alInicio) {
    var aviso = g.Dom.aviso();
    function volver() { return h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: 'Volver al inicio', onclick: alInicio }); }
    function abrir(r, tipo) {
      return h('button', { type: 'button', class: 'boton principal', id: tipo === 'pdf' ? 'abrirLibroPdf' : 'abrirLibroWord', texto: tipo === 'pdf' ? 'Abrir PDF' : 'Abrir Word', onclick: async function () {
        g.Dom.decir(aviso, (await g.Envios.abrir(est.raiz, { documentos: { pdf: r.pdf, docx: r.docx } }, tipo)) === 'falta' ? 'No encuentro el fichero en la carpeta ACTAS.' : '');
      } });
    }
    function mostrar(r) {
      g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [
        h('h2', { texto: 'Libro de actas del curso ' + r.curso }),
        h('p', { id: 'libroGuardado', texto: 'He juntado ' + r.actas + (r.actas === 1 ? ' acta' : ' actas') + ' del curso, por orden de fecha, en PDF y en Word, en la carpeta ACTAS › documentos › ' + r.curso + '.' }),
        r.fallos.length ? h('div', { class: 'aviso', id: 'libroFallos' }, r.fallos.map(function (f) { return h('div', { texto: 'No he podido incluir el acta del ' + g.fechaCorta(f.fecha) + ': ' + f.motivo }); })) : null,
        h('div', { class: 'fila' }, [abrir(r, 'pdf'), abrir(r, 'docx'), volver()]), aviso
      ])]);
    }
    if (est.libro && est.libro.r) { mostrar(est.libro.r); return; }
    g.Dom.montar([h('div', { class: 'barra-form' }, [h('h2', { class: 'subtitulo', texto: 'Libro de actas del curso' }), h('span', { class: 'derecha' }, [g.Ayuda.aviso('libro-actas')])]),
      h('p', { class: 'suave', id: 'estadoLibro', texto: 'Montando el libro de actas del curso…' })]);
    try { est.libro = { r: await g.Libro.crear(est.raiz, est.ficha) }; mostrar(est.libro.r); }
    catch (e) {
      g.Dom.decir(aviso, (e && e.message) || String(e));
      if (e && e.tipo === 'ajustes') aviso.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
      g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [h('h2', { texto: 'Libro de actas del curso' }), aviso, h('div', { class: 'fila' }, [volver()])])]);
    }
  }

  g.PantallaLibro = { pintarLibro: pintarLibro };
})(window);
