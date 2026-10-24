/* Lo que Claude redacta del acta de evaluación (fila 59): «Para Séneca» (cinco cajas, cada una con «Copiar») y «Anexo» (I-IV), los dos editables,
   y «Crear anexo», que guarda el PDF y el Word en ACTAS › documentos › curso. Lo usa pantalla-evaluacion.js. */
(function (g) {
  'use strict';
  var h = g.Dom.h, E = g.Evaluacion;

  function fechaDe(iso) { try { return g.fechaLarga(iso); } catch (x) { return iso; } }

  /* ctx: { cambio, tut, todos, alInicio }. Devuelve { nodo, notasCambiaron } (lo segundo se llama cada vez que cambian las notas). */
  function crear(est, e, ctx) {
    var cambio = ctx.cambio, ocupado = false, preguntando = null, avisoNombres = '', pestana = 'seneca';
    var avisoClaude = g.Dom.aviso(), avisoCrear = g.Dom.aviso(), estado = h('span', { class: 'suave', id: 'estadoRedaccion' });
    var avisoNotas = h('div', { class: 'aviso', id: 'avisoNotasCambiadas', hidden: '', texto: 'Las notas han cambiado desde que Claude redactó los textos.' });
    var zonaAcciones = h('div', { class: 'fila', id: 'accionesRedaccion' }), zonaPregunta = h('div', { id: 'preguntaRedaccion' });
    var zonaTextos = h('div', { id: 'textosEvaluacion' }), zonaFin = h('div', { class: 'zona-crear', id: 'zonaFin' });

    function decirError(x) {
      g.Dom.decir(avisoClaude, x && x.message ? x.message : String(x));
      if (x && x.tipo === 'clave') avisoClaude.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    }

    /* Todas las cajas con su clave: 'seneca-1'… 'seneca-5' y 'anexo-IA'… (las claves de las versiones para «Deshacer»). */
    function todosLosTextos() {
      var t = {};
      E.CAJAS_SENECA.forEach(function (x, i) { t['seneca-' + (i + 1)] = (e.textos.seneca || [])[i] || ''; });
      E.PARTES_ANEXO.forEach(function (p) { t['anexo-' + p.id] = (e.textos.anexo || {})[p.id] || ''; });
      return t;
    }
    /* «Más escueto», «Desarrolla más»… junto a cada caja (fila 64): Claude parte del texto tal como está, con las correcciones a mano. */
    function barraRetoque(clave, leer, poner, limite) {
      return g.PantallaRetoque.barra({
        est: est, id: clave, almacen: e, clave: clave, ocupado: ocupado, limite: limite, todos: function () { return ctx.todos; },
        leer: leer, escribir: function (t, aviso) { poner(t); avisoNombres = aviso || ''; },
        ocupar: function (si) { ocupado = si; if (si) g.Dom.decir(avisoClaude, ''); estado.textContent = si ? 'Claude está cambiando el texto…' : ''; pintarRedaccion(); },
        alCambiar: function () { cambio(); pintarTextos(); pintarFinSinReprintar(); notasCambiaron(); }, error: decirError
      });
    }

    async function redactar(otra) {
      preguntando = null; ocupado = true; g.Dom.decir(avisoClaude, ''); estado.textContent = 'Claude está redactando…'; pintarRedaccion();
      try {
        var clave = await g.Datos.leerClave(est.raiz);
        var res = await g.EvaluacionClaude.redactar(clave, e, ctx.todos, { otraVersion: !!otra, estilo: await g.Estilo.paraClaude(est.raiz, ctx.todos) });
        var antes = todosLosTextos();
        E.ponerRedaccion(e, res.textos); avisoNombres = res.aviso || '';
        var ahora = todosLosTextos();
        Object.keys(ahora).forEach(function (k) { g.Retoque.cambiar(e, k, antes[k], ahora[k]); }); /* «Deshacer» de cada caja recoge también este cambio */
        cambio();
      } catch (x) { decirError(x); }
      finally { ocupado = false; estado.textContent = ''; pintarRedaccion(); notasCambiaron(); }
    }
    function pedir(otra) {
      if (e.editado && E.hayTextos(e)) { preguntando = otra ? 'otra' : 'nueva'; pintarRedaccion(); return; }
      redactar(otra);
    }
    function notasCambiaron() {
      Array.prototype.forEach.call(zonaAcciones.querySelectorAll('button'), function (b) { b.disabled = ocupado || !E.hayNotas(e); });
      avisoNotas.hidden = !(E.hayTextos(e) && E.firmaNotas(e) !== e.notasRedactadas);
    }
    function pintarRedaccion() {
      zonaAcciones.textContent = ''; zonaPregunta.textContent = '';
      var hay = E.hayTextos(e);
      zonaAcciones.appendChild(h('button', { type: 'button', class: 'boton principal', id: 'redactarEvaluacion', texto: hay ? 'Redactar de nuevo' : 'Redactar con Claude', onclick: function () { pedir(false); } }));
      if (hay) zonaAcciones.appendChild(h('button', { type: 'button', class: 'boton', 'data-accion': 'otra-version', texto: 'Otra versión', onclick: function () { pedir(true); } }));
      if (preguntando) {
        var otraV = preguntando === 'otra';
        zonaPregunta.appendChild(h('div', { class: 'aviso pregunta', id: 'preguntaSustituir' }, [
          h('span', { texto: 'Has cambiado algún texto a mano. ¿Sustituirlo por uno nuevo? ' }),
          h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'si-sustituir', texto: 'Sí, sustituir', onclick: function () { redactar(otraV); } }),
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'no-sustituir', texto: 'No', onclick: function () { preguntando = null; pintarRedaccion(); } })
        ]));
      }
      pintarTextos(); pintarFin(); notasCambiaron();
    }

    /* Las dos pestañas */
    function area(valor, clave, alCambiar) {
      var a = h('textarea', { rows: '8', 'data-texto': clave, placeholder: '(vacía)' });
      a.value = valor || ''; a.readOnly = ocupado;
      a.oninput = function () { alCambiar(a.value); e.editado = true; cambio(); pintarFinSinReprintar(); notasCambiaron(); };
      return a;
    }
    function pintarTextos() {
      zonaTextos.textContent = '';
      if (!E.hayTextos(e)) return;
      if (avisoNombres) zonaTextos.appendChild(h('div', { class: 'aviso', 'data-aviso-nombres': '1', texto: avisoNombres }));
      if (String(e.resumenCiclo || '').trim() && g.EvaluacionCiclo) {
        var enviado = h('span', { class: 'suave', id: 'resumenEnviado', 'aria-live': 'polite' });
        zonaTextos.appendChild(h('div', { class: 'fila', id: 'enviarResumen' }, [
          h('button', { type: 'button', class: 'boton', 'data-accion': 'enviar-resumen', texto: 'Enviar resumen al ciclo', onclick: async function () {
            enviado.textContent = (await g.PantallaEntrevista.copiarTexto(g.EvaluacionCiclo.textoParaEnviar(e), true))
              ? 'Copiado. Pégalo en un correo o mensaje a quien escribe el acta de ciclo' : 'No he podido copiar';
          } }), g.Ayuda.aviso('enviar-resumen-ciclo'), enviado
        ]));
      }
      var seneca = h('div', { id: 'panelSeneca', 'data-panel': 'seneca' }), anexo = h('div', { id: 'panelAnexo', 'data-panel': 'anexo' });
      if (pestana !== 'seneca') seneca.setAttribute('hidden', ''); else seneca.removeAttribute('hidden');
      if (pestana !== 'anexo') anexo.setAttribute('hidden', ''); else anexo.removeAttribute('hidden');
      E.CAJAS_SENECA.forEach(function (titulo, i) {
        var a = area(e.textos.seneca[i], 'seneca-' + (i + 1), function (v) { e.textos.seneca[i] = v; });
        var dicho = h('span', { class: 'suave', 'data-copiado': 'seneca-' + (i + 1), 'aria-live': 'polite' });
        var copiar = h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'copiar', 'data-copiar': 'seneca-' + (i + 1), texto: 'Copiar', onclick: async function () {
          dicho.textContent = (await g.PantallaEntrevista.copiarTexto(a.value)) ? 'Copiado' : 'No he podido copiar';
        } });
        a.addEventListener('input', function () { dicho.textContent = ''; });
        var partes = [h('div', { class: 'cabeza-hueco' }, [h('strong', { texto: titulo }), h('span', { class: 'fila' }, [dicho, copiar])]), a];
        if (String(e.textos.seneca[i] || '').trim()) partes.push(barraRetoque('seneca-' + (i + 1), function () { return e.textos.seneca[i] || ''; }, function (t) { e.textos.seneca[i] = t; }, g.Retoque.LIMITE_SENECA));
        seneca.appendChild(h('div', { class: 'texto-seneca', 'data-seneca': String(i + 1) }, partes));
      });
      E.PARTES_ANEXO.forEach(function (p) {
        if (p.soloInicial && e.sesion !== 'inicial') return;
        var a = area(e.textos.anexo[p.id], 'anexo-' + p.id, function (v) { e.textos.anexo[p.id] = v; });
        var partesA = [h('div', { class: 'cabeza-hueco' }, [h('strong', { texto: p.titulo })]), a];
        if (String(e.textos.anexo[p.id] || '').trim()) partesA.push(barraRetoque('anexo-' + p.id, function () { return e.textos.anexo[p.id] || ''; }, function (t) { e.textos.anexo[p.id] = t; }));
        anexo.appendChild(h('div', { class: 'texto-seneca', 'data-anexo': p.id }, partesA));
      });
      function boton(id, texto) {
        return h('button', { type: 'button', class: 'boton' + (pestana === id ? ' principal' : ''), 'data-pestana': id, texto: texto, onclick: function () { pestana = id; pintarTextos(); } });
      }
      zonaTextos.appendChild(h('div', { class: 'fila pestanas', role: 'tablist' }, [boton('seneca', 'Para Séneca'), boton('anexo', 'Anexo')]));
      zonaTextos.appendChild(seneca); zonaTextos.appendChild(anexo);
    }

    /* Crear anexo */
    var creado = null;
    function pintarFinSinReprintar() { if (creado) { creado = null; pintarFin(); } }
    function pintarFin() {
      zonaFin.textContent = '';
      if (!E.hayTextos(e)) return;
      if (creado) {
        var aviso = g.Dom.aviso();
        zonaFin.appendChild(h('div', { class: 'aviso ok', id: 'anexoCreado' }, [h('span', { texto: 'El anexo del ' + fechaDe(e.fecha) + ' está en PDF y en Word, en la carpeta ACTAS › documentos › ' + creado.curso + '. ' })]));
        zonaFin.appendChild(h('div', { class: 'fila' }, ['pdf', 'docx'].map(function (t) {
          return h('button', { type: 'button', class: 'boton principal', 'data-accion': 'abrir-' + t, texto: t === 'pdf' ? 'Abrir PDF' : 'Abrir Word', onclick: async function () {
            g.Dom.decir(aviso, (await g.Envios.abrir(est.raiz, e, t)) === 'falta' ? 'No encuentro el fichero en la carpeta ACTAS.' : '');
          } });
        }).concat([h('button', { type: 'button', class: 'boton', id: 'volverALista', texto: 'Volver a las actas', onclick: async function () { await est.alSalir(); est.evaluacionActual = null; est.refrescar(); } })])));
        zonaFin.appendChild(aviso);
        return;
      }
      zonaFin.appendChild(h('button', { type: 'button', class: 'boton principal grande', id: 'crearAnexo', texto: e.estado === 'creada' ? 'Crear el anexo otra vez' : 'Crear anexo', onclick: crearAnexo }));
      zonaFin.appendChild(avisoCrear);
    }
    async function crearAnexo() {
      g.Dom.decir(avisoCrear, '');
      var pr = E.problema(e);
      if (pr) { g.Dom.decir(avisoCrear, pr); return; }
      try {
        await est.alSalir();
        await g.EvaluacionDocs.crear(est.raiz, e, est.ficha, ctx.tut, new Date());
      } catch (x) { g.Dom.decir(avisoCrear, 'No he podido crear el anexo: ' + (x && x.message ? x.message : x)); return; }
      creado = e.documentos; pintarFin();
    }

    var nodo = h('section', { class: 'tarjeta ancha', id: 'redaccionEvaluacion' }, [
      h('h3', { texto: 'Los textos del acta' }, [g.Ayuda.aviso('evaluacion-seneca')]), estado, zonaAcciones, zonaPregunta, avisoNotas, avisoClaude, zonaTextos, zonaFin
    ]);
    pintarRedaccion();
    return { nodo: nodo, notasCambiaron: notasCambiaron };
  }

  g.PantallaEvaluacionTextos = { crear: crear };
})(window);
