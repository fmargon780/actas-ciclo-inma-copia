/* Comunicaciones a familias (fila 109): el editor de una circular o de una autorización de salida. A la izquierda los datos, las notas, «Redactar con Claude» y el texto (con los
   botones de estilo); a la derecha, «Cómo queda» (la hoja), «Crear PDF y Word» y, en una autorización ya creada, las entregadas. La comunicación se guarda sola.
   Lo usa pantalla-comunicaciones.js. */
(function (g) {
  'use strict';
  var h = g.Dom.h, C = g.Comunicacion, P = g.PantallaComunicaciones, T = g.Tutoria;

  function larga(iso) { try { return g.fechaLarga(iso); } catch (e) { return '____'; } }

  /* La hoja tal como saldrá: membrete, título, texto, pie y, en la autorización, el talón. */
  function hoja(c, colegio) {
    var nodos = [
      h('div', { class: 'memb' }, [h('span', { texto: 'Junta de Andalucía' }), h('span', { texto: 'Consejería de Educación' + (colegio ? ' · ' + colegio : '') })]),
      h('h4', { 'data-hoja': 'titulo', texto: C.tituloDe(c) || '(título)' }),
      h('p', { 'data-hoja': 'texto', texto: c.texto || 'Aquí saldrá el texto cuando pulses «Redactar con Claude».' }),
      h('div', { class: 'pie-carta', 'data-hoja': 'pie', texto: (c.localidad ? 'En ' + c.localidad + ', a ' : 'A ') + larga(c.fecha) + '\n' + (c.tutora ? 'La tutora: ' + c.tutora : 'La tutora') })
    ];
    if (C.esAutorizacion(c)) {
      var s = c.salida, hueco = function () { return h('span', { class: 'hueco' }); };
      nodos.push(h('div', { class: 'talon', 'data-hoja': 'talon' }, [
        h('strong', { texto: 'Recortar y entregar antes del ' + larga(s.limite) }),
        h('p', {}, ['D./Dª. ', hueco(), ', como padre, madre o tutor legal de ', hueco(), ', del grupo ' + c.grupo + ', AUTORIZO a que participe en «' + (String(s.actividad).trim() || '____') + '» el día ' + larga(s.dia) + '.']),
        h('p', { texto: 'Fecha y firma:' })
      ]));
    }
    return h('div', { class: 'hoja' }, nodos);
  }

  async function pintar(est, tut, c, alLista) {
    var rub = await g.Rubricas.cargar(est), lista = rub.lista, alumnos = lista ? T.alumnadoDelGrupo(lista, tut.grupo) : [], todos = lista ? lista.todos : [];
    C.alinear(c, tut, est.ficha, alumnos);
    var colegio = '';
    try { var col = await g.Colegio.leer(est.raiz); colegio = (col && col.nombre) || ''; } catch (e) { /* sin colegio: la hoja sale sin su nombre */ }
    var cambio = g.Autoguardado.crear(est, c, C.guardar).cambio, auto = C.esAutorizacion(c);
    var ocupado = false, avisoNombres = '';
    var avisoClaude = g.Dom.aviso(), avisoCrear = g.Dom.aviso(), estado = h('span', { class: 'suave', id: 'estadoRedaccion' });
    avisoClaude.id = 'avisoClaude'; avisoCrear.id = 'avisoCrear';
    var hojaCaja = h('div', { id: 'hojaComunicacion' }), zonaPie = h('div', { id: 'pieComunicacion' }), zonaEntregas = h('div', { id: 'zonaEntregas' }), zonaRetoque = h('div', { id: 'retoqueComunicacion' });
    var titulo = h('h2', { class: 'subtitulo', 'data-comunicacion': 'titulo' }), etiquetaBorrador = h('span', { class: 'etiqueta cambiadas', id: 'etiquetaBorrador', texto: 'Borrador, se guarda solo' });
    var botonRedactar = h('button', { type: 'button', class: 'boton principal', id: 'redactarComunicacion' });
    var area = h('textarea', { id: 'textoComunicacion', rows: '9', placeholder: 'Pulsa «Redactar con Claude» o escribe aquí directamente.' });
    area.value = c.texto || '';

    function pintarCabecera() {
      titulo.textContent = C.tituloDe(c) || (auto ? 'Nueva autorización de salida' : 'Nueva circular');
      etiquetaBorrador.hidden = c.estado === 'creada';
    }
    function pintarHoja() { hojaCaja.textContent = ''; hojaCaja.appendChild(hoja(c, colegio)); }
    function alEditar() { cambio(); pintarHoja(); pintarCabecera(); g.Dom.decir(avisoCrear, ''); }
    function decirError(x) {
      g.Dom.decir(avisoClaude, x && x.message ? x.message : String(x));
      if (x && x.tipo === 'clave') avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    }

    /* --- los botones de estilo: siempre, pero sin texto no se pueden pulsar --- */
    function pintarRetoque() {
      zonaRetoque.textContent = '';
      var vacio = !String(c.texto || '').trim();
      var barra = g.PantallaRetoque.barra({
        est: est, id: 'comunicacion', almacen: c, clave: 'texto', ocupado: ocupado, todos: function () { return todos; },
        leer: function () { return c.texto || ''; }, escribir: function (txt, aviso) { c.texto = txt; area.value = txt; avisoNombres = aviso || ''; },
        ocupar: function (si) { ocupado = si; if (si) g.Dom.decir(avisoClaude, ''); estado.textContent = si ? 'Claude está cambiando el texto…' : ''; pintarBotones(); pintarRetoque(); },
        alCambiar: function () { alEditar(); pintarBotones(); pintarRetoque(); }, error: decirError
      });
      if (vacio) Array.prototype.forEach.call(barra.querySelectorAll('button, input'), function (x) { x.disabled = true; });
      zonaRetoque.appendChild(barra);
      if (avisoNombres) zonaRetoque.appendChild(h('div', { class: 'aviso', 'data-aviso-nombres': '1', texto: avisoNombres }));
    }
    function pintarBotones() { botonRedactar.textContent = String(c.texto || '').trim() ? 'Redactar de nuevo' : 'Redactar con Claude'; botonRedactar.disabled = ocupado; area.readOnly = ocupado; }
    area.oninput = function () {
      var vacioAntes = !String(c.texto || '').trim();
      c.texto = area.value; avisoNombres = ''; alEditar(); pintarBotones();
      if (vacioAntes !== !String(c.texto).trim()) pintarRetoque();
    };
    botonRedactar.onclick = async function () {
      ocupado = true; g.Dom.decir(avisoClaude, ''); estado.textContent = 'Claude está redactando…'; pintarBotones();
      try {
        avisoNombres = await g.ComunicacionClaude.redactarComunicacion(est.raiz, c, todos);
        area.value = c.texto; alEditar();
      } catch (x) { decirError(x); }
      finally { ocupado = false; estado.textContent = ''; pintarBotones(); pintarRetoque(); }
    };

    /* --- los campos --- */
    function campo(etiqueta, obj, k, tipo, ancho, alCambiar) {
      var i = h('input', { type: tipo || 'text', id: 'c-' + k, value: obj[k] || '' });
      i.oninput = function () { if (alCambiar) alCambiar(i.value); else obj[k] = i.value; alEditar(); };
      return h('label', { class: 'campo' + (ancho ? ' ancho' : '') }, [etiqueta, i]);
    }
    var campos = auto ? [
      campo('Actividad', c.salida, 'actividad', 'text', true, function (v) { C.ponerActividad(c, v); }), campo('Destino', c.salida, 'destino', 'text', true),
      campo('Fecha de la salida', c.salida, 'dia', 'date'), campo('Sale a las', c.salida, 'sale', 'time'), campo('Vuelve a las', c.salida, 'vuelve', 'time'),
      campo('Transporte', c.salida, 'transporte'), campo('Coste', c.salida, 'coste'), campo('Entregar antes del', c.salida, 'limite', 'date'),
      campo('Qué deben traer', c.salida, 'traer', 'text', true), campo('Fecha del papel', c, 'fecha', 'date')
    ] : [campo('Título', c, 'titulo', 'text', true), campo('Fecha del papel', c, 'fecha', 'date')];
    var notas = h('textarea', { id: 'notasComunicacion', rows: '3' });
    notas.value = c.notas || ''; notas.oninput = function () { c.notas = notas.value; cambio(); };

    /* --- crear los ficheros --- */
    function pintarPie() {
      zonaPie.textContent = '';
      var hecho = c.estado === 'creada' && !!c.documentos, dicho = h('div', { class: 'aviso ok', id: 'guardadoComunicacion', hidden: '' });
      var crear = h('button', { type: 'button', class: 'boton principal', id: 'crearComunicacion', texto: hecho ? 'Volver a crear PDF y Word' : 'Crear PDF y Word', onclick: async function () {
        g.Dom.decir(avisoCrear, '');
        var pr = C.problema(c);
        if (pr) { g.Dom.decir(avisoCrear, pr); return; }
        crear.disabled = true;
        try {
          if (await g.PantallaColegio.avisoSiFalta(est, avisoCrear)) { crear.disabled = false; return; }
          await est.alSalir();
          await g.ComunicacionDocs.crear(est.raiz, c, tut, est.ficha, new Date());
        } catch (x) { crear.disabled = false; g.Dom.decir(avisoCrear, 'No he podido crear los ficheros: ' + ((x && x.message) || x)); return; }
        pintarCabecera(); pintarPie(); pintarEntregas();
        var d = document.getElementById('guardadoComunicacion');
        if (d) { d.textContent = 'Guardado en ' + g.Envios.carpetaTexto(c.documentos.pdf) + ': «' + c.documentos.base + '» (PDF y Word). También sale en Mis papeles.'; d.hidden = false; }
      } });
      var acciones = [crear];
      if (hecho) {
        [['pdf', 'Abrir PDF'], ['docx', 'Abrir Word']].forEach(function (x) {
          acciones.push(h('button', { type: 'button', class: 'boton', 'data-accion': 'abrir-' + x[0], texto: x[1], onclick: async function () {
            if ((await g.Envios.abrir(est.raiz, c, x[0])) === 'falta') g.Dom.decir(avisoCrear, 'No encuentro el fichero en la carpeta ACTAS.');
          } }));
        });
      }
      zonaPie.appendChild(h('div', { class: 'fila' }, acciones)); zonaPie.appendChild(avisoCrear); zonaPie.appendChild(dicho);
    }
    function pintarEntregas() {
      zonaEntregas.textContent = '';
      if (auto && c.estado === 'creada') zonaEntregas.appendChild(g.PantallaComunicacionEntregas.tarjeta({ c: c, cambio: cambio, hoy: P.hoyIso() }));
    }

    var aviso = g.PantallaFichas.avisoRubricas(est, function () { est.refrescar(); });
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverComunicaciones', texto: '← Comunicaciones a familias', onclick: async function () { await est.alSalir(); alLista(); } }),
        titulo, h('span', { class: 'etiqueta', texto: c.grupo }), etiquetaBorrador, estado])
    ].concat(aviso ? [aviso] : [], [h('div', { class: 'mesa-comunicacion' }, [
      h('div', { class: 'columna-comunicacion' }, [
        h('section', { class: 'tarjeta' }, [h('h3', { texto: auto ? 'Autorización de salida' : 'Circular' }), h('div', { class: 'campos' }, campos),
          h('label', { class: 'campo' }, [auto ? 'Notas: algo más que contar (opcional)' : 'Notas: lo que quieres contar', notas]),
          h('div', { class: 'fila' }, [botonRedactar, h('span', { class: 'suave', texto: 'Gasta una redacción. A Claude no va ningún nombre de alumno: solo tapo los de tu alumnado, no escribas otros nombres.' })]), avisoClaude]),
        h('section', { class: 'tarjeta' }, [h('h3', { texto: 'Texto' }), area, zonaRetoque])]),
      h('div', { class: 'columna-comunicacion' }, [h('section', { class: 'tarjeta' }, [h('h3', { texto: 'Cómo queda' }), hojaCaja, zonaPie]), zonaEntregas])
    ])]));
    pintarCabecera(); pintarHoja(); pintarBotones(); pintarRetoque(); pintarPie(); pintarEntregas();
  }

  g.PantallaComunicacionEditor = { pintar: pintar, hoja: hoja };
})(window);
