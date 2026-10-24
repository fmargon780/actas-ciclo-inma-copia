/* «Libro de reuniones con familias» (fila 57): junta las reuniones creadas del curso (las del grupo de tu tutoría) en un solo PDF y un solo Word,
   por orden de fecha, y los guarda en ACTAS › documentos › <curso>. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  async function pintar(est, tut, volver) {
    var aviso = g.Dom.aviso();
    function botonVolver() { return h('button', { type: 'button', class: 'boton', id: 'volverReuniones', texto: 'Volver a las reuniones', onclick: volver }); }
    function abrir(r, tipo) {
      return h('button', { type: 'button', class: 'boton principal', id: tipo === 'pdf' ? 'abrirLibroPdf' : 'abrirLibroWord', texto: tipo === 'pdf' ? 'Abrir PDF' : 'Abrir Word', onclick: async function () {
        g.Dom.decir(aviso, (await g.Envios.abrir(est.raiz, { documentos: { pdf: r.pdf, docx: r.docx } }, tipo)) === 'falta' ? 'No encuentro el fichero en la carpeta ACTAS.' : '');
      } });
    }
    g.Dom.montar([h('div', { class: 'barra-form' }, [h('h2', { class: 'subtitulo', texto: 'Libro de reuniones con familias' }), h('span', { class: 'derecha' }, [g.Ayuda.aviso('libro-reuniones')])]),
      h('p', { class: 'suave', id: 'estadoLibroReuniones', texto: 'Montando el libro de reuniones con familias…' })]);
    try {
      var r = await g.ReunionDocs.libro(est.raiz, est.ficha, tut);
      g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [
        h('h2', { texto: 'Libro de reuniones con familias ' + r.grupo + ' · ' + r.curso }),
        h('p', { id: 'libroReunionesGuardado', texto: 'He juntado ' + r.reuniones + (r.reuniones === 1 ? ' reunión' : ' reuniones') + ' del curso, por orden de fecha, en PDF y en Word, en la carpeta ACTAS › documentos › ' + r.curso + '.' }),
        h('div', { class: 'fila' }, [abrir(r, 'pdf'), abrir(r, 'docx'), botonVolver()]), aviso
      ])]);
    } catch (e) {
      g.Dom.decir(aviso, (e && e.message) || String(e));
      if (e && e.tipo === 'ajustes') aviso.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(e.destino); } }));
      g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [h('h2', { texto: 'Libro de reuniones con familias' }), aviso, h('div', { class: 'fila' }, [botonVolver()])])]);
    }
  }

  g.PantallaReunionLibro = { pintar: pintar };
})(window);
