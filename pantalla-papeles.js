/* «Mis papeles» (fila 95): las cuatro carpetas del curso con buscador, desplegable de curso y «Abrir PDF» / «Abrir Word» en cada papel. Solo lee la carpeta ACTAS. El paso de la app es 'papeles'. */
(function (g) {
  'use strict';
  var h = g.Dom.h;
  var MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

  async function pintarPapeles(est, alInicio) {
    var actual = g.cursoEscolar(g.Peticion.hoyIso());
    var s = est.papeles = est.papeles || { curso: actual, texto: '', ver: {} };
    var aviso = g.Dom.aviso(), caja = h('div', { class: 'dos-col', id: 'carpetasPapeles' }), datos = [];

    async function abrir(ruta, tipo) {
      var f = null;
      try { f = await est.raiz.abrirArchivo(ruta); } catch (e) { f = null; }
      if (!f) { g.Dom.decir(aviso, 'No encuentro el fichero en la carpeta ACTAS.'); return; }
      g.Dom.decir(aviso, '');
      g.Dom.abrirFichero(f, ruta.split('/').pop(), MIME[tipo] || 'application/octet-stream');
    }
    function enlace(ruta, tipo, texto) { return h('button', { type: 'button', class: 'boton chico', 'data-accion': 'abrir-' + tipo, texto: texto, onclick: function () { abrir(ruta, tipo); } }); }
    function linea(p) {
      var botones = h('span', { class: 'botones' });
      if (p.pdf) botones.appendChild(enlace(p.pdf, 'pdf', 'PDF'));
      if (p.docx) botones.appendChild(enlace(p.docx, 'docx', 'Word'));
      if (p.otro) botones.appendChild(enlace(p.otro, 'otro', 'Abrir'));
      return h('li', { class: 'papel' }, [h('span', { class: 'nombre-papel', texto: p.nombre }), botones]);
    }
    function tarjeta(c) {
      var v = g.Papeles.vista(c.papeles, s.texto, s.ver[c.id]), cuerpo;
      if (v.vacia) cuerpo = h('p', { class: 'suave', texto: 'Todavía no hay papeles aquí.' });
      else if (v.sinResultados) cuerpo = h('p', { class: 'suave', texto: 'Ningún papel con «' + s.texto.trim() + '».' });
      else cuerpo = h('ul', { class: 'papeles' }, v.visibles.map(linea));
      var nodos = [h('h3', { texto: c.titulo }), cuerpo];
      if (v.hayMas) nodos.push(h('button', { type: 'button', class: 'enlace', 'data-accion': 'ver-' + c.id, texto: s.ver[c.id] ? 'Ver menos' : 'Ver los ' + v.total, onclick: function () { s.ver[c.id] = !s.ver[c.id]; pintarCajas(); } }));
      return h('section', { class: 'tarjeta', id: 'papeles-' + c.id, 'data-carpeta': c.titulo }, nodos);
    }
    function pintarCajas() { caja.textContent = ''; datos.forEach(function (c) { caja.appendChild(tarjeta(c)); }); }

    async function cargarCurso() {
      try { datos = await g.Papeles.leerCurso(est.raiz, s.curso); g.Dom.decir(aviso, ''); }
      catch (e) { datos = []; g.Dom.decir(aviso, 'No he podido leer la carpeta de papeles. Vuelve a intentarlo.'); }
      pintarCajas();
    }

    var buscar = h('input', { type: 'search', id: 'buscarPapeles', placeholder: 'Buscar un papel…', 'aria-label': 'Buscar un papel', value: s.texto, oninput: function () { s.texto = buscar.value; pintarCajas(); } });
    var cursos = [];
    try { cursos = await g.Papeles.cursos(est.raiz, actual); } catch (e) { cursos = [actual]; }
    if (cursos.indexOf(s.curso) < 0) cursos.push(s.curso);
    var elegir = h('select', { id: 'cursoPapeles', 'aria-label': 'Curso' }, cursos.map(function (c) { return h('option', { value: c, texto: 'Curso ' + c }); }));
    elegir.value = s.curso;
    elegir.onchange = function () { s.curso = elegir.value; s.ver = {}; cargarCurso(); };

    g.Dom.montar([
      h('div', { class: 'barra-form barra-papeles' }, [h('h2', { class: 'subtitulo', texto: 'Mis papeles' }), g.Ayuda.aviso('mis-papeles'), buscar, elegir,
        h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: 'Volver', onclick: alInicio })]),
      aviso, caja
    ]);
    await cargarCurso();
  }

  g.PantallaPapeles = { pintarPapeles: pintarPapeles };
})(window);
