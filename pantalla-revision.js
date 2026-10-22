/* Revisión: por cada punto, las notas a la izquierda y el párrafo a la derecha. Redactar con Claude, otra versión, escribir encima y «Crear acta». */
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

    function decirError(e) {
      g.Dom.decir(avisoClaude, e && e.message ? e.message : String(e));
      if (e && e.tipo === 'clave') avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    }

    /* Escribe con Claude los puntos pedidos. Devuelve true si todo salió bien. */
    async function redactarPuntos(indices, otraVersion) {
      if (!indices.length) return true;
      ocupado = true; g.Dom.decir(avisoClaude, ''); estadoRedaccion.textContent = 'Claude está redactando…'; pintar();
      try {
        var clave = await g.Datos.leerClave(est.raiz);
        var rub = await g.Rubricas.cargar(est);
        var res = await g.Claude.redactarConAlumnado(clave, b, indices, rub.lista ? rub.lista.todos : null, { otraVersion: !!otraVersion });
        indices.forEach(function (i) {
          var p = b.puntos[i], n = i + 1;
          R.ponerMarcados(p, res.marcados[n] || { notas: res.notasMarcadas[n] }); /* los nombres que Inma escribió sueltos quedan marcados */
          R.ponerParrafo(p, res.parrafos[n]);
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
      if (!R.hayContenido(p)) { R.quitarParrafo(p); cambio(); pintar(); return Promise.resolve(); }
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

    function tarjeta(p, i) {
      var estado = R.estadoPunto(p), fijo = estado === 'fijo';
      var cabeza = h('div', { class: 'cabeza-punto' }, [h('span', { class: 'numero', texto: (i + 1) + '.' }), h('strong', { class: 'titulo-rev', texto: p.titulo || '(sin título)' })]);
      if (ETIQUETAS[estado]) cabeza.appendChild(h('span', { class: 'etiqueta ' + estado, 'data-estado': estado, texto: ETIQUETAS[estado] }));
      if (fijo) return h('div', { class: 'punto fijo', 'data-punto': String(i) }, [cabeza, h('p', { class: 'suave', texto: 'Este punto lleva su texto fijo (lectura del acta anterior): se escribe solo al crear el acta.' })]);
      var area = h('textarea', { class: 'parrafo', rows: '5', 'data-parrafo': String(i), placeholder: estado === 'sinNotas' ? 'Sin notas: si no escribes nada, saldrá «' + R.TEXTO_PENDIENTE + '» en gris.' : 'El párrafo del acta' });
      area.value = p.parrafo || '';
      area.oninput = function () { R.editarParrafo(p, area.value); delete avisosNombres[i]; cambio(); };
      area.readOnly = ocupado;
      var acciones = h('div', { class: 'fila' });
      var puede = !ocupado && R.hayContenido(p);
      if (estado === 'cambiadas' || estado === 'sinRedactar') acciones.appendChild(h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'de-nuevo', texto: estado === 'cambiadas' ? 'Redactar de nuevo' : 'Redactar este punto', onclick: function () { pedirPunto(i, false, false); } }));
      Array.prototype.forEach.call(acciones.querySelectorAll('button'), function (x) { x.disabled = ocupado; });
      if ((estado === 'redactado' || estado === 'cambiadas') && puede) acciones.appendChild(h('button', { type: 'button', class: 'boton chico', 'data-accion': 'otra', texto: 'Otra versión', onclick: function () { pedirPunto(i, true, false); } }));
      var nodos = [cabeza, h('div', { class: 'dos' }, [
        h('div', { class: 'izq' }, [h('div', { class: 'suave', texto: 'Tus notas' }), h('div', { class: 'notas-vistas', 'data-vistas': String(i), texto: R.verContenido(p) || '(sin notas)' })]),
        h('div', { class: 'der' }, [h('div', { class: 'suave', texto: 'Párrafo del acta' }), area])
      ]), acciones];
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

    async function crear() {
      confirmando = false; ocupado = true; pintar();
      var bien = await redactarPuntos(b.puntos.map(function (p, i) { return R.estadoPunto(p) === 'sinRedactar' ? i : -1; }).filter(function (i) { return i >= 0; }), false);
      if (!bien) return;
      ocupado = true; pintar();
      try {
        await est.alSalir();
        var ficha = await g.Datos.leerFicha(est.raiz);
        var anterior = R.fechaActaAnterior(ficha && ficha.ultimaActa, await g.Envios.fechasEsperando(est.raiz));
        await g.Envios.enviar(est.raiz, R.armarEnvio(b, anterior, new Date()));
        est.alSalir = null; est.estadoGuardado.textContent = '';
        g.Dom.montar([h('section', { class: 'tarjeta ancha' }, [
          h('h2', { texto: 'Acta enviada' }),
          h('p', { id: 'actaEnviada', texto: 'Enviada. Aparecerá al final de tu documento de actas en uno o dos minutos, o al abrirlo.' }),
          h('button', { type: 'button', class: 'boton principal', id: 'volverInicio', texto: 'Volver al inicio', onclick: volverInicio })
        ])]);
      } catch (e) { ocupado = false; decirError(e); pintar(); }
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
          h('span', { texto: 'Se añadirá al final de tu documento de actas. ¿Crear? ' }),
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
      var boton = document.getElementById('redactarTodo'); if (boton) boton.disabled = ocupado;
    }

    g.Dom.montar([
      h('div', { class: 'barra-form' }, [
        h('button', { type: 'button', class: 'boton', id: 'volverFormulario', texto: '← Cambiar las notas', onclick: async function () { await est.alSalir(); volverFormulario(); } }),
        h('h2', { class: 'subtitulo', texto: 'Revisar el acta' }), estadoRedaccion,
        h('span', { class: 'derecha' }, [g.Ayuda.aviso('redactar-claude')]),
        h('button', { type: 'button', class: 'boton principal', id: 'redactarTodo', texto: 'Redactar con Claude', onclick: redactarTodo })
      ]),
      avisoClaude, contenedor, zonaCrear
    ]);
    pintar();
    if (redactarAlEntrar) redactarTodo();
  }

  g.PantallaRevision = { pintarRevision: pintarRevision };
})(window);
