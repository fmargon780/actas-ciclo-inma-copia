/* Revisión: por cada punto, las notas a la izquierda y el párrafo a la derecha. Redactar con Claude, otra versión, escribir encima y «Crear acta»
   (que guarda el acta en PDF y en Word en la carpeta ACTAS). Lo que no cuadre (fechas, cursos, relleno) sale en amarillo, con su porqué: solo avisa. */
(function (g) {
  'use strict';
  var h = g.Dom.h, R = g.Redaccion;
  var ETIQUETAS = { cambiadas: 'Las notas han cambiado', sinRedactar: 'Sin redactar', sinNotas: 'Sin notas' };

  /* volverFormulario(): al formulario; volverInicio(): a la lista; redactarAlEntrar: empezar redactando lo que falte. */
  function pintarRevision(est, b, volverFormulario, volverInicio, redactarAlEntrar) {
    var cambio = g.Autoguardado.crear(est, b).cambio;
    var ocupado = false, preguntas = {}, confirmando = false, faltaAnterior = false, avisosNombres = {};
    var avisoClaude = g.Dom.aviso(), estadoRedaccion = h('span', { class: 'suave', id: 'estadoRedaccion' });
    var contenedor = h('div', { class: 'puntos', id: 'puntosRevision' });
    var zonaCrear = h('div', { class: 'zona-crear' });
    var otrosAvisos = h('div', { class: 'aviso amarillo', id: 'avisosActa', hidden: '' });
    var fichaActa = null, hechas = [], listoParaMarcar = false;

    /* El cuadro del párrafo crece con lo escrito (así la capa amarilla de detrás siempre coincide con el texto). */
    function ajustar(area) { area.style.height = 'auto'; area.style.height = Math.max(area.scrollHeight + 2, 90) + 'px'; }

    /* Lo que no cuadre en todo el acta, en amarillo detrás del texto y con su frase debajo. No impide crear el acta. */
    function marcar() {
      if (!listoParaMarcar) return;
      var rev, vivos = [];
      try {
        rev = g.ActaModelo.revisar(R.armarEnvio(b, g.ActaModelo.fechaActaAnterior(b, fichaActa, hechas), new Date()), fichaActa);
      } catch (e) { return; }
      b.puntos.forEach(function (p, i) { if (String(p.titulo || '').trim()) vivos.push(i); });
      b.puntos.forEach(function (p, i) {
        var fondo = contenedor.querySelector('[data-fondo="' + i + '"]'), lista = contenedor.querySelector('[data-marcas="' + i + '"]');
        if (!fondo) return;
        var marcas = rev.porPunto[vivos.indexOf(i)] || [], rangos = g.ActaModelo.rangosDeMarcas(p.parrafo, marcas), t = String(p.parrafo || ''), desde = 0;
        fondo.textContent = ''; lista.textContent = '';
        rangos.forEach(function (r) {
          fondo.appendChild(document.createTextNode(t.slice(desde, r[0])));
          fondo.appendChild(h('mark', { texto: t.slice(r[0], r[1]) })); desde = r[1];
        });
        fondo.appendChild(document.createTextNode(t.slice(desde) + '\u200b'));
        marcas.forEach(function (m) { lista.appendChild(h('div', { class: 'marca-frase', texto: m.frase })); });
      });
      otrosAvisos.textContent = '';
      rev.otros.forEach(function (o) { otrosAvisos.appendChild(h('div', { class: 'marca-frase', texto: o.donde + ': ' + o.frase })); });
      otrosAvisos.hidden = !rev.otros.length;
    }

    function decirError(e) {
      g.Dom.decir(avisoClaude, e && e.message ? e.message : String(e));
      if (e && (e.tipo === 'clave' || e.tipo === 'ajustes')) avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(e.destino); } }));
    }

    /* Escribe con Claude los puntos pedidos. Devuelve true si todo salió bien. */
    async function redactarPuntos(indices, otraVersion) {
      if (!indices.length) return true;
      ocupado = true; g.Dom.decir(avisoClaude, ''); estadoRedaccion.textContent = 'Claude está redactando…'; pintar();
      try {
        var clave = await g.Claude.claveDe(est.raiz);
        var rub = await g.Rubricas.cargar(est);
        var res = await g.Claude.redactarConAlumnado(clave, b, indices, rub.lista ? rub.lista.todos : null, { otraVersion: !!otraVersion, estilo: await g.Estilo.paraClaude(est.raiz, rub.lista ? rub.lista.todos : null) });
        indices.forEach(function (i) {
          var p = b.puntos[i], n = i + 1;
          R.ponerMarcados(p, res.marcados[n] || { notas: res.notasMarcadas[n] }); /* los nombres que Inma escribió sueltos quedan marcados */
          var antes = p.parrafo;
          R.ponerParrafo(p, res.parrafos[n]);
          g.Retoque.cambiar(p, 'parrafo', antes, p.parrafo); /* «Deshacer» guarda el texto de antes, con lo corregido a mano */
          if (res.avisos[n]) avisosNombres[i] = res.avisos[n]; else delete avisosNombres[i];
        });
        cambio();
        return true;
      } catch (e) { decirError(e); return false; }
      finally { ocupado = false; estadoRedaccion.textContent = ''; pintar(); }
    }

    /* Redacta un punto; si Inma lo había cambiado a mano, antes lo pregunta en el propio punto. */
    function pedirPunto(i, otraVersion, confirmado) {
      var p = b.puntos[i];
      if (!confirmado && R.hayQuePreguntar(p)) { preguntas[i] = !!otraVersion ? 'otra' : 'nueva'; pintar(); return Promise.resolve(); }
      delete preguntas[i];
      if (!R.hayContenido(p)) { g.Retoque.guardarVersion(p, 'parrafo', p.parrafo); R.quitarParrafo(p); cambio(); pintar(); return Promise.resolve(); }
      return redactarPuntos([i], otraVersion);
    }

    function redactarTodo() {
      var todos = R.indicesPorRedactar(b);
      if (!todos.length) { g.Dom.decir(avisoClaude, 'No hay nada por redactar: todos los puntos con notas ya tienen su párrafo.'); return Promise.resolve(); }
      var directos = [];
      todos.forEach(function (i) { if (R.hayQuePreguntar(b.puntos[i])) preguntas[i] = 'nueva'; else directos.push(i); });
      if (!directos.length) { g.Dom.decir(avisoClaude, ''); pintar(); return Promise.resolve(); }
      return redactarPuntos(directos, false);
    }

    /* «Más escueto», «Desarrolla más»… junto al párrafo (fila 64): Claude parte del párrafo tal como está, con las correcciones a mano. */
    function barraRetoque(p, i) {
      return g.PantallaRetoque.barra({
        est: est, id: 'punto-' + i, almacen: p, clave: 'parrafo', ocupado: ocupado, todos: async function () { var rub = await g.Rubricas.cargar(est); return rub.lista ? rub.lista.todos : null; },
        leer: function () { return p.parrafo || ''; },
        escribir: function (t, aviso) { R.ponerRetocado(p, t); if (aviso) avisosNombres[i] = aviso; else delete avisosNombres[i]; },
        ocupar: function (si) { ocupado = si; if (si) g.Dom.decir(avisoClaude, ''); estadoRedaccion.textContent = si ? 'Claude está cambiando el texto…' : ''; pintar(); },
        alCambiar: function () { cambio(); pintar(); }, error: decirError
      });
    }

    function tarjeta(p, i) {
      var estado = R.estadoPunto(p), fijo = estado === 'fijo';
      var cabeza = h('div', { class: 'cabeza-punto' }, [h('span', { class: 'numero', texto: (i + 1) + '.' }), h('strong', { class: 'titulo-rev', texto: p.titulo || '(sin título)' })]);
      if (ETIQUETAS[estado]) cabeza.appendChild(h('span', { class: 'etiqueta ' + estado, 'data-estado': estado, texto: ETIQUETAS[estado] }));
      if (fijo) return h('div', { class: 'punto fijo', 'data-punto': String(i) }, [cabeza, h('p', { class: 'suave', texto: 'Este punto lleva su texto fijo (lectura del acta anterior): se escribe solo al crear el acta.' })]);
      var area = h('textarea', { class: 'parrafo', rows: '5', 'data-parrafo': String(i), placeholder: estado === 'sinNotas' ? 'Sin notas: si no escribes nada, saldrá «' + R.TEXTO_PENDIENTE + '» en gris.' : 'El párrafo del acta' });
      area.value = p.parrafo || '';
      area.oninput = function () { R.editarParrafo(p, area.value); delete avisosNombres[i]; cambio(); ajustar(area); marcar(); };
      area.readOnly = ocupado;
      var acciones = h('div', { class: 'fila' });
      var puede = !ocupado && R.hayContenido(p);
      if (estado === 'cambiadas' || estado === 'sinRedactar') acciones.appendChild(h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'de-nuevo', texto: estado === 'cambiadas' ? 'Redactar de nuevo' : 'Redactar este punto', onclick: function () { pedirPunto(i, false, false); } }));
      Array.prototype.forEach.call(acciones.querySelectorAll('button'), function (x) { x.disabled = ocupado; });
      if ((estado === 'redactado' || estado === 'cambiadas') && puede) acciones.appendChild(h('button', { type: 'button', class: 'boton chico', 'data-accion': 'otra', texto: 'Otra versión', onclick: function () { pedirPunto(i, true, false); } }));
      var nodos = [cabeza, h('div', { class: 'dos' }, [
        h('div', { class: 'izq' }, [h('div', { class: 'suave', texto: 'Tus notas' }), h('div', { class: 'notas-vistas', 'data-vistas': String(i), texto: R.verContenido(p) || '(sin notas)' })]),
        h('div', { class: 'der' }, [h('div', { class: 'suave', texto: 'Párrafo del acta' }),
          h('div', { class: 'caja-marcas' }, [h('div', { class: 'fondo', 'data-fondo': String(i), 'aria-hidden': 'true' }), area]), h('div', { class: 'marcas-frases', 'data-marcas': String(i) })])
      ]), acciones];
      if (String(p.parrafo || '').trim()) nodos.push(barraRetoque(p, i));
      var avisoNombres = avisosNombres[i] || (g.AlumnadoClaude.quedanMarcas(p.parrafo) ? g.AlumnadoClaude.AVISO_NOMBRES : '');
      if (avisoNombres) nodos.push(h('div', { class: 'aviso', 'data-aviso-nombres': String(i), texto: avisoNombres }));
      if (preguntas[i]) {
        var otra = preguntas[i] === 'otra';
        nodos.push(h('div', { class: 'aviso pregunta', 'data-pregunta': String(i) }, [
          h('span', { texto: 'Has cambiado este párrafo a mano. ¿Sustituirlo por uno nuevo? ' }),
          h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'si-sustituir', texto: 'Sí, sustituir', onclick: function () { pedirPunto(i, otra, true); } }),
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'no-sustituir', texto: 'No', onclick: function () { delete preguntas[i]; pintar(); } })
        ]));
      }
      return h('div', { class: 'punto', 'data-punto': String(i) }, nodos);
    }

    /* La plantilla del membrete, la ficha del curso y los dos ficheros: todo se monta aquí, sin el documento de Google. */
    async function montarFicheros() {
      var ficha = await g.Datos.leerFicha(est.raiz), problema = g.ActaModelo.problemaDeFichaActa(ficha);
      if (problema) { var e = new Error(problema); e.tipo = 'ajustes'; throw e; }
      var anterior = g.ActaModelo.fechaActaAnterior(b, ficha, await g.Envios.fechasHechas(est.raiz));
      var envio = R.armarEnvio(b, anterior, new Date()), modelo = g.ActaModelo.montar(ficha, envio);
      var mem = (await g.Colegio.paraDocumentos(est.raiz)).mem, opc = { pie: g.Membrete.textoPie(ficha.ciclo) };
      return { ficha: ficha, envio: envio, pdf: await g.ActaPdf.crear(modelo, mem, opc), docx: await g.ActaDocx.crear(modelo, mem, opc) };
    }

    /* La última acta del curso pasa a ser esta (si es más nueva): el próximo borrador ya lleva «Lectura del acta anterior». */
    async function apuntarUltimaActa(ficha) {
      try {
        var antes = ficha.ultimaActa ? g.fechaDesdeCorta(ficha.ultimaActa) : '';
        if (!antes || antes < b.fecha) await est.raiz.escribirJSON('ficha.json', Object.assign({}, ficha, { ultimaActa: g.fechaCorta(b.fecha) }));
      } catch (e) { /* no es esencial: el acta ya está guardada */ }
    }

    async function crear() {
      confirmando = false;
      /* sin los datos del colegio no hay documento: se avisa antes de gastar una redacción de Claude */
      var sinColegio = await g.Colegio.falta(est.raiz);
      if (sinColegio) { var ec = new Error(sinColegio); ec.tipo = 'ajustes'; ec.destino = 'colegio'; decirError(ec); pintar(); return; }
      ocupado = true; pintar();
      var bien = await redactarPuntos(b.puntos.map(function (p, i) { return R.estadoPunto(p) === 'sinRedactar' ? i : -1; }).filter(function (i) { return i >= 0; }), false);
      if (!bien) return;
      ocupado = true; estadoRedaccion.textContent = 'Creando el acta…'; pintar();
      try {
        await est.alSalir();
        var f = await montarFicheros();
        var guardado = await g.Envios.guardarCreada(est.raiz, f.envio, f.pdf, f.docx, g.cursoEscolar(b.fecha));
        await apuntarUltimaActa(f.ficha);
        est.alSalir = null; est.estadoGuardado.textContent = ''; estadoRedaccion.textContent = '';
        var aviso = g.Dom.aviso();
        function abrir(tipo) { return async function () { var r = await g.Envios.abrir(est.raiz, guardado, tipo); g.Dom.decir(aviso, r === 'falta' ? 'No encuentro el fichero en la carpeta ACTAS.' : ''); }; }
        g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [
          h('h2', { texto: 'Acta guardada en tu carpeta ACTAS' }),
          h('p', { id: 'actaGuardada', texto: 'El acta del ' + g.fechaCorta(b.fecha) + ' está en PDF y en Word, en la carpeta ACTAS › ' + guardado.documentos.curso + '.' }),
          h('div', { class: 'fila' }, [
            h('button', { type: 'button', class: 'boton principal', id: 'abrirPdf', texto: 'Abrir PDF', onclick: abrir('pdf') }),
            h('button', { type: 'button', class: 'boton principal', id: 'abrirWord', texto: 'Abrir Word', onclick: abrir('docx') }),
            h('button', { type: 'button', class: 'boton', id: 'volverInicio', texto: 'Volver al inicio', onclick: volverInicio })
          ]), aviso
        ])]);
      } catch (e) { ocupado = false; estadoRedaccion.textContent = ''; decirError(e); pintar(); }
    }

    function pintarZonaCrear() {
      zonaCrear.textContent = '';
      var motivo = R.motivoQueImpide(b);
      if (faltaAnterior) {
        zonaCrear.appendChild(h('div', { class: 'aviso pregunta', id: 'avisoActaAnterior' }, [
          h('span', { texto: 'Falta el punto «Lectura y aprobación del acta anterior», que es obligatorio. ' }),
          h('button', { type: 'button', class: 'boton principal', 'data-accion': 'anadir-acta-anterior', texto: 'Añadirlo', onclick: async function () {
            R.anadirActaAnterior(b); cambio(); faltaAnterior = false; await est.alSalir(); volverFormulario();
          } }),
          h('button', { type: 'button', class: 'boton', 'data-accion': 'crear-igualmente', texto: 'Crear igualmente', onclick: function () { faltaAnterior = false; confirmando = true; pintar(); } })]));
        return;
      }
      if (confirmando) {
        zonaCrear.appendChild(h('div', { class: 'aviso pregunta', id: 'confirmarCrear' }, [
          h('span', { texto: 'Se guardará el acta en tu carpeta ACTAS, en PDF y en Word. ¿Crear? ' }),
          h('button', { type: 'button', class: 'boton principal', 'data-accion': 'si-crear', texto: 'Sí, crear', onclick: crear }),
          h('button', { type: 'button', class: 'boton', 'data-accion': 'no-crear', texto: 'No', onclick: function () { confirmando = false; pintar(); } })]));
        return;
      }
      zonaCrear.appendChild(h('button', { type: 'button', class: 'boton principal grande', id: 'crearActa', texto: 'Crear acta', onclick: function () { if (R.tieneActaAnterior(b)) confirmando = true; else faltaAnterior = true; pintar(); } }));
      zonaCrear.lastChild.disabled = !!motivo || ocupado;
      var infoCrear = g.Ayuda.aviso('crear-acta'); if (infoCrear) zonaCrear.appendChild(infoCrear);
      if (motivo) zonaCrear.appendChild(h('p', { class: 'suave', id: 'motivoCrear', texto: motivo }));
    }

    function pintar() {
      contenedor.textContent = '';
      b.puntos.forEach(function (p, i) { contenedor.appendChild(tarjeta(p, i)); });
      pintarZonaCrear();
      Array.prototype.forEach.call(contenedor.querySelectorAll('textarea.parrafo'), ajustar);
      marcar();
      var boton = document.getElementById('redactarTodo'); if (boton) boton.disabled = ocupado;
    }

    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverFormulario', texto: '← Cambiar las notas', onclick: async function () { await est.alSalir(); volverFormulario(); } }),
        h('h2', { class: 'subtitulo', texto: 'Revisar el acta' }), estadoRedaccion,
        h('span', { class: 'derecha' }, [g.Ayuda.aviso('redactar-claude')]),
        h('button', { type: 'button', class: 'boton principal', id: 'redactarTodo', texto: 'Redactar con Claude', onclick: redactarTodo })
      ]),
      avisoClaude, contenedor, otrosAvisos, zonaCrear
    ]);
    pintar();
    /* La ficha y las actas ya hechas hacen falta para revisar (curso, acta anterior, profesorado): se cargan sin parar la pantalla. */
    Promise.all([g.Datos.leerFicha(est.raiz), g.Envios.fechasHechas(est.raiz)]).then(function (r) { fichaActa = r[0]; hechas = r[1]; listoParaMarcar = true; marcar(); })
      .catch(function () { listoParaMarcar = true; marcar(); });
    if (redactarAlEntrar) redactarTodo();
  }

  g.PantallaRevision = { pintarRevision: pintarRevision };
})(window);
