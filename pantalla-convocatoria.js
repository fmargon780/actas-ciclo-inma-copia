/* «Nueva convocatoria» (fila 17): Inma elige la fecha, ajusta los puntos que propone «Lo habitual», prepara el correo y abre el acta de esa reunión.
   Todo cambio se guarda solo en ACTAS/convocatorias/<fecha>.json. */
(function (g) {
  'use strict';
  var h = g.Dom.h, C = g.Convocatoria, H = g.Habitual;

  function fechaBuena(iso) { try { g.fechaCorta(iso); return true; } catch (e) { return false; } }
  function fechaDe(iso) { try { return g.fechaLarga(iso); } catch (e) { return iso; } }

  async function copiarTexto(t) { try { await g.navigator.clipboard.writeText(t); return true; } catch (e) { return false; } }

  async function pintarConvocatoria(est, alInicio, fechaInicial) {
    var habitual = await H.leer(est.raiz), guardadas = await C.listar(est.raiz);
    var fecha = fechaInicial, conv = null, existe = false;
    var campoFecha = h('input', { type: 'date', id: 'campoFechaConv', value: fecha });
    var campoHora = h('input', { type: 'time', id: 'campoHoraConv', value: '13:00' });
    var origen = h('p', { class: 'suave', id: 'origenConv' });
    var estadoGuardado = h('span', { class: 'suave', id: 'guardadoConv', 'aria-live': 'polite' });
    var lista = h('ol', { class: 'puntos-conv', id: 'puntosConv' });
    var correo = h('a', { class: 'boton principal enlace-boton', id: 'prepararCorreo', texto: 'Preparar correo', href: '#' });
    var avisoCopiar = h('span', { class: 'suave', id: 'avisoCopiado', 'aria-live': 'polite' });
    var nuevo = h('input', { type: 'text', id: 'nuevoPuntoConv', placeholder: 'Añadir un punto', 'aria-label': 'Nuevo punto' });

    async function guardar() {
      if (!conv) return;
      await C.guardar(est.raiz, conv, est.ficha, new Date());
      existe = true; estadoGuardado.textContent = 'Guardado';
    }
    function repintarPuntos() {
      lista.textContent = '';
      conv.puntos.forEach(function (p, i) {
        var t = h('input', { type: 'text', class: 'titulo-conv', value: p.titulo, 'aria-label': 'Punto ' + (i + 1) });
        t.onchange = async function () { if (t.value.trim()) p.titulo = t.value.trim(); else t.value = p.titulo; await guardar(); correo.href = C.mailto(conv, est.ficha); };
        var mover = function (d) { return async function () {
          var j = i + d; if (j < 0 || j >= conv.puntos.length) return;
          var x = conv.puntos[i]; conv.puntos[i] = conv.puntos[j]; conv.puntos[j] = x; repintarPuntos(); await guardar();
        }; };
        lista.appendChild(h('li', { class: 'punto-conv', 'data-punto': String(i) }, [t, h('span', { class: 'botones' }, [
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'subir', texto: '↑', 'aria-label': 'Subir', onclick: mover(-1) }),
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'bajar', texto: '↓', 'aria-label': 'Bajar', onclick: mover(1) }),
          h('button', { type: 'button', class: 'boton chico peligro', 'data-accion': 'quitar', texto: 'Quitar', onclick: async function () { conv.puntos.splice(i, 1); repintarPuntos(); await guardar(); } })
        ])]));
      });
      correo.href = C.mailto(conv, est.ficha);
    }
    async function cargar(f) {
      fecha = f; estadoGuardado.textContent = '';
      if (!fechaBuena(f)) { conv = null; lista.textContent = ''; origen.textContent = 'Elige una fecha para la reunión.'; return; }
      var hecha = await C.leer(est.raiz, f);
      existe = !!hecha;
      conv = hecha || C.proponer(habitual, f, campoHora.value, new Date());
      campoHora.value = conv.hora || '13:00';
      origen.textContent = hecha ? 'Ya tenías una convocatoria para el ' + fechaDe(f) + ': es la que se abre.' : 'Propuesta de «Lo habitual» de ' + H.nombreMes(H.mesDe(f)) + ' para el ' + fechaDe(f) + '. Quita, cambia, añade u ordena lo que quieras.';
      repintarPuntos();
    }
    campoFecha.onchange = function () { cargar(campoFecha.value); };
    campoHora.onchange = async function () { if (conv && g.horaValida(campoHora.value)) { conv.hora = campoHora.value; await guardar(); correo.href = C.mailto(conv, est.ficha); } };
    var anadir = async function () {
      if (!conv || !nuevo.value.trim()) return;
      conv.puntos.push({ titulo: nuevo.value.trim(), huecos: [] }); nuevo.value = ''; repintarPuntos(); await guardar();
    };
    nuevo.onkeydown = function (e) { if (e.key === 'Enter') anadir(); };
    correo.onclick = function () { guardar(); }; /* el enlace abre el correo; el guardado va en paralelo */

    var anteriores = guardadas.length ? h('div', {}, [h('h3', { class: 'subtitulo', texto: 'Convocatorias guardadas' }), h('ul', { class: 'borradores', id: 'convocatoriasGuardadas' }, guardadas.map(function (c) {
      return h('li', { class: 'borrador', 'data-fecha': c.fecha }, [h('div', { class: 'datos' }, [h('strong', { texto: 'Reunión del ' + fechaDe(c.fecha) }), h('span', { class: 'suave', texto: c.puntos.length + ' puntos' })]),
        h('button', { type: 'button', class: 'boton', 'data-accion': 'abrir-convocatoria', texto: 'Abrir', onclick: function () { pintarConvocatoria(est, alInicio, c.fecha); } })]);
    }))]) : null;

    g.Dom.montar([
      h('div', { class: 'barra-form' }, [h('h2', { class: 'subtitulo', texto: 'Nueva convocatoria' }), h('button', { type: 'button', class: 'boton derecha', id: 'volverInicio', texto: 'Volver al inicio', onclick: alInicio })]),
      h('section', { class: 'tarjeta' }, [
        h('div', { class: 'fila' }, [h('label', { class: 'campo' }, ['Fecha de la reunión', campoFecha]), h('label', { class: 'campo' }, ['Hora', campoHora])]),
        origen, h('h3', { texto: 'Orden del día' }), lista,
        h('div', { class: 'fila' }, [nuevo, h('button', { type: 'button', class: 'boton chico', id: 'anadirPuntoConv', texto: 'Añadir', onclick: anadir })]),
        h('div', { class: 'fila' }, [correo,
          h('button', { type: 'button', class: 'boton', id: 'copiarConv', texto: 'Copiar texto', onclick: async function () {
            if (!conv) return; await guardar(); avisoCopiar.textContent = (await copiarTexto(C.texto(conv, est.ficha))) ? 'Texto copiado' : 'No he podido copiar el texto';
          } }),
          h('button', { type: 'button', class: 'boton', id: 'abrirActaConv', texto: 'Abrir el acta de esta reunión', onclick: async function () {
            if (!conv) return; await guardar(); est.abrirBorrador(await C.borradorDe(est.raiz, conv, est.ficha, new Date()));
          } }), estadoGuardado, avisoCopiar])
      ]), anteriores
    ].filter(Boolean));
    await cargar(fecha);
  }

  g.PantallaConvocatoria = { pintarConvocatoria: pintarConvocatoria };
})(window);
