/* «Traer actas del documento antiguo» (fila 56): elegir el Word, avisar de cuántas se han traído y revisar cada una (lo que no cuadre, en amarillo con su porqué;
   se corrige allí mismo y «Guardar» rehace su PDF y su Word). La app nunca corrige sola. La lógica está en traer.js y acta-traida.js. */
(function (g) {
  'use strict';
  var h = g.Dom.h;
  var PEGA_GOOGLE = 'Si tu documento es de Google Docs, ábrelo y usa Archivo › Descargar › Microsoft Word (.docx); después elige ese fichero.';

  /* El Word que elige quien usa la app -> { nombre, bloques }, o null si cancela. */
  async function elegirDocx() {
    if (typeof g.showOpenFilePicker !== 'function') throw new Error('Este navegador no puede abrir ficheros. Hace falta Google Chrome en el ordenador.');
    var m;
    try {
      m = await g.showOpenFilePicker({ multiple: false, id: 'actas-antiguas', types: [{ description: 'Documento de actas (Word)', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }] });
    } catch (e) { if (e && e.name === 'AbortError') return null; throw e; }
    var f = await m[0].getFile(), nombre = m[0].name || f.name || 'documento';
    if (/\.gdoc$/i.test(nombre)) throw new Error('«' + nombre + '» es un acceso directo de Google Docs, no tiene el texto dentro. ' + PEGA_GOOGLE);
    return { nombre: nombre, bloques: await g.DocxBloques.leerBloques(await f.arrayBuffer()) };
  }

  function fechaDe(d) { try { return g.fechaCorta(d.fecha); } catch (e) { return d.fecha; } }
  function decirError(est, caja, e) {
    g.Dom.decir(caja, (e && e.message) || String(e));
    if (e && e.tipo === 'ajustes') caja.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
  }

  function botonesAbrir(est, d, aviso) {
    return [['pdf', 'Abrir PDF'], ['docx', 'Abrir Word']].map(function (x) {
      return h('button', { type: 'button', class: 'boton chico', 'data-accion': 'abrir-' + x[0], texto: x[1], onclick: async function () {
        g.Dom.decir(aviso, (await g.Envios.abrir(est.raiz, d, x[0])) === 'falta' ? 'No encuentro el fichero en la carpeta ACTAS.' : '');
      } });
    });
  }

  function pintarElegir(est, alInicio) {
    var aviso = g.Dom.aviso(), estado = h('div', { class: 'aviso ok', id: 'estadoTraer', hidden: '' });
    var boton = h('button', { type: 'button', class: 'boton principal grande', id: 'traerElegir', texto: 'Elegir el documento de actas', onclick: async function () {
      g.Dom.decir(aviso, ''); boton.disabled = true;
      try {
        var doc = await elegirDocx();
        if (!doc) { boton.disabled = false; return; }
        estado.textContent = 'Leyendo el documento y montando las actas de este curso…'; estado.hidden = false;
        var r = await g.Traer.traer(est.raiz, est.ficha, doc.bloques, doc.nombre, new Date());
        est.traer = { fase: 'resumen', resultado: r }; est.refrescar();
      } catch (e) { boton.disabled = false; estado.hidden = true; decirError(est, aviso, e); }
    } });
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [h('h2', { class: 'subtitulo', texto: 'Traer actas del documento antiguo' }), h('span', { class: 'derecha' }, [g.Ayuda.aviso('traer-actas')]),
        h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: 'Volver al inicio', onclick: alInicio })]),
      h('p', { class: 'suave', texto: 'Elige el documento de actas del curso, en Word. Traigo solo las actas de este curso, cada una con su PDF y su Word en la carpeta ACTAS; las de otros cursos no las toco. El texto se trae tal cual: nada se corrige solo.' }),
      h('p', { class: 'suave', texto: PEGA_GOOGLE }), h('div', { class: 'fila' }, [boton]), estado, aviso
    ]);
  }

  function pintarResumen(est, alInicio) {
    var r = est.traer.resultado, aviso = g.Dom.aviso();
    var acciones = [];
    if (r.traidas.length) acciones.push(h('button', { type: 'button', class: 'boton principal', id: 'revisarTraidas', texto: 'Revisar las actas traídas', onclick: function () {
      est.traer = { fase: 'revisar', traidas: r.traidas.slice(), i: 0, actual: null }; est.refrescar();
    } }));
    acciones.push(h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: 'Volver al inicio', onclick: alInicio }));
    g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [
      h('h2', { texto: 'Actas traídas del documento antiguo' }), h('p', { id: 'traerResumen', texto: g.Traer.mensaje(r) }),
      r.traidas.length ? h('ul', { class: 'borradores', id: 'listaTraidas' }, r.traidas.map(function (d) {
        return h('li', { class: 'borrador', 'data-id': d.id }, [h('div', { class: 'datos' }, [h('strong', { texto: 'Acta del ' + fechaDe(d) })]), h('span', { class: 'botones' }, botonesAbrir(est, d, aviso))]);
      })) : null,
      r.traidas.length ? h('p', { class: 'suave', texto: 'Ahora puedes revisarlas una por una: lo que no cuadre saldrá en amarillo, con el motivo.' }) : null,
      h('div', { class: 'fila' }, acciones), aviso
    ])]);
  }

  /* Una caja de texto con su capa amarilla detrás (como en «Revisar el acta») y las frases de lo marcado debajo. */
  function campo(u, cambio, refs, clase) {
    var area = h('textarea', { class: 'parrafo ' + (clase || ''), rows: '1', 'data-campo': u.id, 'aria-label': u.donde });
    area.value = u.texto;
    var fondo = h('div', { class: 'fondo', 'aria-hidden': 'true', 'data-fondo-traida': u.id }), frases = h('div', { class: 'marcas-frases', 'data-frases': u.id });
    area.oninput = function () { u.set(area.value); u.texto = area.value; ajustar(area); cambio(); };
    refs[u.id] = { area: area, fondo: fondo, frases: frases };
    return h('div', { class: 'campo-traida' }, [h('div', { class: 'caja-marcas' }, [fondo, area]), frases]);
  }
  function ajustar(area) { area.style.height = 'auto'; area.style.height = Math.max(area.scrollHeight + 2, 30) + 'px'; }

  function pintarTabla(t, i, k, mapa, cambio, refs) {
    return h('table', { class: 'tabla-traida' }, t.filas.map(function (f, r) {
      return h('tr', {}, f.filter(function (c) { return c.vm !== 'c'; }).map(function (c) {
        var ci = f.indexOf(c), td = h('td', { colspan: String(c.span), rowspan: String(c.rs) }, c.parrafos.map(function (p, z) { return campo(mapa['c-' + i + '-' + k + '-' + r + '-' + ci + '-' + z], cambio, refs); }));
        return td;
      }));
    }));
  }

  async function pintarRevisionActa(est, alInicio) {
    var t = est.traer, aviso = g.Dom.aviso(), ficha = est.ficha;
    if (t.i >= t.traidas.length) {
      var fin = g.Dom.aviso();
      g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [h('h2', { texto: 'Revisión terminada' }),
        h('p', { id: 'traerFin', texto: 'Ya están todas las actas traídas revisadas. Las encuentras en «Actas hechas», con su PDF y su Word.' }),
        h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton principal', id: 'volverInicio', texto: 'Volver al inicio', onclick: alInicio })]), fin])]);
      return;
    }
    if (!t.actual) t.actual = JSON.parse(JSON.stringify(t.traidas[t.i]));
    var d = t.actual, refs = {}, dirty = false, ocupado = false;
    var anterior = g.ActaModelo.fechaActaAnterior({ id: d.id, fecha: d.fecha }, ficha, await g.Envios.fechasHechas(est.raiz));
    var us = g.ActaTraida.unidades(d), mapa = {};
    us.forEach(function (u) { if (u.id) mapa[u.id] = u; });
    var otros = h('div', { class: 'aviso amarillo', id: 'avisosActa', hidden: '' }), estado = h('span', { class: 'suave', id: 'estadoTraida' });
    var guardar = h('button', { type: 'button', class: 'boton principal', id: 'guardarTraida', texto: 'Guardar y seguir' });
    var seguir = h('button', { type: 'button', class: 'boton', id: 'siguienteTraida', texto: 'Seguir sin cambiar' });

    function marcar() {
      var rev = g.ActaTraida.revisar(d, ficha, anterior), total = 0;
      Object.keys(refs).forEach(function (id) {
        var x = refs[id], marcas = rev.porId[id] || [], texto = x.area.value, desde = 0;
        x.fondo.textContent = ''; x.frases.textContent = '';
        g.ActaTraida.rangosDe(texto, marcas).forEach(function (rg) {
          x.fondo.appendChild(document.createTextNode(texto.slice(desde, rg[0]))); x.fondo.appendChild(h('mark', { texto: texto.slice(rg[0], rg[1]) })); desde = rg[1];
        });
        x.fondo.appendChild(document.createTextNode(texto.slice(desde) + '​'));
        marcas.forEach(function (m) { x.frases.appendChild(h('div', { class: 'marca-frase', texto: m.frase })); total++; });
      });
      otros.textContent = '';
      rev.otros.forEach(function (o) { otros.appendChild(h('div', { class: 'marca-frase', texto: o.donde + ': ' + o.frase })); });
      otros.hidden = !rev.otros.length;
      estado.textContent = 'Acta del ' + fechaDe(d) + ' (' + (t.i + 1) + ' de ' + t.traidas.length + ') · ' + (total + rev.otros.length ? 'hay ' + (total + rev.otros.length) + ' cosas en amarillo' : 'todo cuadra') + (dirty ? ' · cambios sin guardar' : '');
    }
    function cambio() { dirty = true; marcar(); }
    function siguiente() { t.i++; t.actual = null; est.refrescar(); }
    seguir.onclick = siguiente;
    guardar.onclick = async function () {
      if (ocupado) return;
      ocupado = true; guardar.disabled = seguir.disabled = true; estado.textContent = 'Guardando el PDF y el Word…';
      try { t.traidas[t.i] = await g.Traer.guardarRevisada(est.raiz, ficha, d); siguiente(); }
      catch (e) { ocupado = false; guardar.disabled = seguir.disabled = false; decirError(est, aviso, e); marcar(); }
    };

    var nodos = [];
    nodos.push(h('div', { class: 'cuadro-traida' }, [campo(mapa.titulo, cambio, refs, 'negrita'), campo(mapa.celebrada, cambio, refs)]));
    d.filas.forEach(function (f, i) {
      nodos.push(h('div', { class: 'fila-cabecera-traida' }, [h('strong', { texto: f[0] })].concat(f[1].map(function (l, j) { return campo(mapa['f-' + i + '-' + j], cambio, refs); }))));
    });
    if (d.puntosDia.length) {
      nodos.push(h('h3', { class: 'rotulo-traida', texto: 'PUNTOS DEL DÍA' }));
      d.puntosDia.forEach(function (x, i) { nodos.push(h('div', { class: 'linea-traida' }, [h('span', { class: 'numero', texto: (i + 1) + '.' }), campo(mapa['d-' + i], cambio, refs)])); });
    }
    nodos.push(h('h3', { class: 'rotulo-traida', texto: 'ASUNTOS TRATADOS' }));
    d.puntos.forEach(function (p, i) {
      var cuerpo = [];
      if (p.titulo || mapa['a-' + i]) cuerpo.push(h('div', { class: 'linea-traida' }, [h('span', { class: 'numero', texto: (i + 1) + '.' }), campo(mapa['a-' + i], cambio, refs, 'negrita')]));
      p.bloques.forEach(function (b, k) {
        if (b.t === 'tabla') { cuerpo.push(pintarTabla(b, i, k, mapa, cambio, refs)); return; }
        cuerpo.push(h('div', { class: 'linea-traida' }, [h('span', { class: 'numero', texto: b.lista === 'vineta' ? '•' : b.lista === 'num' ? b.n + '.' : '' }), campo(mapa['b-' + i + '-' + k], cambio, refs)]));
      });
      nodos.push(h('div', { class: 'punto', 'data-punto-traida': String(i) }, cuerpo));
    });
    nodos.push(h('h3', { class: 'rotulo-traida', texto: 'CIERRE' }));
    d.cierre.forEach(function (x, i) { nodos.push(campo(mapa['z-' + i], cambio, refs)); });

    g.Dom.montar([
      h('div', { class: 'barra-form' }, [h('h2', { class: 'subtitulo', texto: 'Revisar acta traída' }), estado, h('span', { class: 'derecha' }, [g.Ayuda.aviso('traer-revision')]),
        h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: 'Volver al inicio', onclick: alInicio })]),
      h('p', { class: 'suave', texto: 'Lo que no cuadre sale en amarillo, con su motivo. Corrígelo aquí mismo o déjalo como está; solo se rehacen el PDF y el Word si pulsas «Guardar y seguir».' }),
      otros, h('div', { class: 'puntos' }, nodos), h('div', { class: 'fila' }, [guardar, seguir]), aviso
    ]);
    Object.keys(refs).forEach(function (id) { ajustar(refs[id].area); });
    marcar();
  }

  async function pintarTraer(est, alInicio) {
    var t = est.traer || (est.traer = { fase: 'elegir' });
    if (t.fase === 'resumen') pintarResumen(est, alInicio);
    else if (t.fase === 'revisar') await pintarRevisionActa(est, alInicio);
    else pintarElegir(est, alInicio);
  }

  g.PantallaTraer = { pintarTraer: pintarTraer, elegirDocx: elegirDocx };
})(window);
