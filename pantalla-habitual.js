/* «Lo habitual» (fila 17): los puntos de cada mes aprendidos de las actas, retocables por Inma, y «Aprender de actas antiguas». */
(function (g) {
  'use strict';
  var h = g.Dom.h, H = g.Habitual;
  var MESES_VISIBLES = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
  var PEGA_GOOGLE = 'Si tu documento es de Google Docs, ábrelo y usa Archivo › Descargar › Microsoft Word (.docx); después elige ese fichero.';

  function mayus(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  /* Los ficheros que elige Inma -> [{ nombre, texto }]. Solo Word (.docx) o texto (.txt). */
  async function elegirDocumentos() {
    if (typeof g.showOpenFilePicker !== 'function') throw new Error('Este navegador no puede abrir ficheros. Hace falta Google Chrome en el ordenador.');
    var manejadores;
    try {
      manejadores = await g.showOpenFilePicker({ multiple: true, id: 'actas-antiguas', types: [{ description: 'Actas (Word o texto)', accept: {
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'text/plain': ['.txt'] } }] });
    } catch (e) { if (e && e.name === 'AbortError') return []; throw e; }
    var res = [];
    for (var i = 0; i < manejadores.length; i++) {
      var f = await manejadores[i].getFile(), nombre = manejadores[i].name || f.name || 'documento';
      if (/\.gdoc$/i.test(nombre)) throw new Error('«' + nombre + '» es un acceso directo de Google Docs, no tiene el texto dentro. ' + PEGA_GOOGLE);
      res.push({ nombre: nombre, texto: /\.docx$/i.test(nombre) ? await g.Docx.leerTexto(await f.arrayBuffer()) : await f.text() });
    }
    return res;
  }

  async function aprenderDeDocumentos(est, habitual, avisar) {
    var docs = await elegirDocumentos();
    if (!docs.length) return null;
    var aprender = [], hechas = 0, vistas = {};
    docs.forEach(function (d) {
      var actas = g.ActasAntiguas.leer(d.texto);
      d.encontradas = actas.length;
      actas.forEach(function (a) { if (habitual.actas.indexOf(a.fecha) < 0 && !vistas[a.fecha]) { vistas[a.fecha] = true; aprender.push(a); } });
    });
    var sinActas = docs.filter(function (d) { return !d.encontradas; });
    if (sinActas.length === docs.length) throw new Error('No he encontrado actas en ' + (docs.length > 1 ? 'esos documentos' : '«' + docs[0].nombre + '»') + '. Busco la línea «Celebrada el día dd/mm/aaaa» y la lista numerada del orden del día.');
    if (aprender.length) {
      await g.Rubricas.cargar(est);
      var lista = est.alumnado && est.alumnado.estado === 'ok' ? est.alumnado.lista.todos : null;
      var clave = await g.Datos.leerClave(est.raiz);
      var res = await g.HabitualClaude.aprenderDe(clave, aprender, lista, { progreso: function (n, t) { avisar('Aprendiendo de tus actas… (' + n + ' de ' + t + ')'); } });
      res.forEach(function (a) { hechas += H.aprender(habitual, a) ? 1 : 0; });
    }
    docs.forEach(function (d) {
      var f = habitual.fuentes.filter(function (x) { return x.nombre === d.nombre; })[0];
      if (f) { f.actas = d.encontradas; f.aprendido = new Date().toISOString(); } else habitual.fuentes.push({ nombre: d.nombre, actas: d.encontradas, aprendido: new Date().toISOString() });
    });
    await H.guardar(est.raiz, habitual);
    return { documentos: docs.length, actas: aprender.length };
  }

  function bloqueMes(est, habitual, m, repintar) {
    var mm = habitual.meses[m] || { puntos: [] }, guardar = async function () { await H.guardar(est.raiz, habitual); };
    var lista = h('ul', { class: 'borradores lista-mes', 'data-mes-lista': String(m) }, mm.puntos.map(function (p) {
      var titulo = h('input', { type: 'text', class: 'titulo-habitual', value: p.titulo, 'aria-label': 'Punto' });
      titulo.onchange = async function () { H.cambiarTitulo(habitual, m, p.id, titulo.value); await guardar(); repintar(); };
      var huecos = h('input', { type: 'text', class: 'huecos-habitual', value: (p.huecos || []).join('; '), placeholder: 'Huecos (separados por «;»)', 'aria-label': 'Huecos' });
      huecos.onchange = async function () { H.cambiarHuecos(habitual, m, p.id, huecos.value.split(';')); await guardar(); };
      var confirmar = h('span', { class: 'confirmar', hidden: '' }, [
        h('span', { texto: '¿Quitarlo de ' + H.nombreMes(m) + '? ' }),
        h('button', { type: 'button', class: 'boton peligro chico', 'data-accion': 'si-quitar', texto: 'Sí', onclick: async function () { H.quitar(habitual, m, p.id); await guardar(); repintar(); } }),
        h('button', { type: 'button', class: 'boton chico', 'data-accion': 'no-quitar', texto: 'No', onclick: function () { confirmar.hidden = true; botones.hidden = false; } })
      ]);
      var botones = h('span', { class: 'botones' }, [
        h('button', { type: 'button', class: 'boton chico', 'data-accion': 'subir', texto: '↑', 'aria-label': 'Subir', onclick: async function () { H.mover(habitual, m, p.id, -1); await guardar(); repintar(); } }),
        h('button', { type: 'button', class: 'boton chico', 'data-accion': 'bajar', texto: '↓', 'aria-label': 'Bajar', onclick: async function () { H.mover(habitual, m, p.id, 1); await guardar(); repintar(); } }),
        h('button', { type: 'button', class: 'boton chico peligro', 'data-accion': 'quitar', texto: 'Quitar', onclick: function () { botones.hidden = true; confirmar.hidden = false; } })
      ]);
      var detalle = p.porGrupo && p.porGrupo.length ? h('div', { class: 'suave', texto: 'Un bloque por grupo: ' + p.porGrupo.join(', ') + '.' }) : null;
      return h('li', { class: 'habitual-punto', 'data-id': p.id }, [h('div', { class: 'datos' }, [titulo, huecos, detalle]), botones, confirmar]);
    }));
    var nuevo = h('input', { type: 'text', class: 'nuevo-habitual', placeholder: 'Añadir un punto a ' + H.nombreMes(m), 'aria-label': 'Nuevo punto' });
    var anadir = async function () { if (H.anadir(habitual, m, nuevo.value)) { await guardar(); repintar(); } };
    nuevo.onkeydown = function (e) { if (e.key === 'Enter') anadir(); };
    var d = h('details', { class: 'mes-habitual', 'data-mes': String(m) }, [
      h('summary', { texto: mayus(H.nombreMes(m)) + (mm.puntos.length ? ' (' + mm.puntos.length + ')' : '') }),
      mm.puntos.length ? lista : h('p', { class: 'suave', texto: 'Aún no hay nada aprendido de ' + H.nombreMes(m) + '.' }),
      h('div', { class: 'fila' }, [nuevo, h('button', { type: 'button', class: 'boton chico', 'data-accion': 'anadir-habitual', texto: 'Añadir', onclick: anadir })])
    ]);
    if (mm.puntos.length) d.setAttribute('open', '');
    return d;
  }

  async function pintarHabitual(est, alInicio) {
    var habitual = await H.leer(est.raiz);
    if (await H.sumarCreadas(est.raiz, habitual, est.ficha)) await H.guardar(est.raiz, habitual);
    var repintar = function () { pintarHabitual(est, alInicio); };
    await g.Rubricas.cargar(est);
    var avisoRub = g.PantallaFichas.avisoRubricas(est, repintar, 'Para que Claude aprenda también de lo que se dijo en cada punto, abre una vez la carpeta RÚBRICAS (Mi unidad › RÚBRICAS). Solo la leo. Sin ella, a Claude solo le mando los títulos.');
    var estado = h('div', { class: 'aviso', id: 'estadoAprender', hidden: '', 'aria-live': 'polite' });
    var boton = h('button', { type: 'button', class: 'boton principal', id: 'aprenderActas', texto: 'Aprender de actas antiguas', onclick: async function () {
      var avisar = function (t) { estado.className = 'aviso'; estado.textContent = t; estado.hidden = !t; };
      if (g.navigator && g.navigator.onLine === false) { avisar('Para aprender de las actas hace falta internet: Claude trabaja desde la red.'); return; }
      boton.disabled = true;
      try {
        avisar('Elige el documento de actas…');
        var r = await aprenderDeDocumentos(est, habitual, avisar);
        if (r === null) { avisar(''); boton.disabled = false; return; }
        await repintar();
      } catch (e) {
        boton.disabled = false; estado.className = 'aviso error'; estado.textContent = (e && e.message) || String(e); estado.hidden = false;
      }
    } });
    var fuentes = habitual.fuentes.length ? h('p', { class: 'suave', id: 'fuentesLeidas', texto: 'Ya he leído: ' + habitual.fuentes.map(function (f) { return f.nombre + ' (' + f.actas + (f.actas === 1 ? ' acta)' : ' actas)'); }).join('; ') + '.' }) : null;
    var meses = MESES_VISIBLES.concat([7, 8].filter(function (m) { return habitual.meses[m] && habitual.meses[m].puntos.length; }));
    g.Dom.montar([
      h('div', { class: 'barra-form' }, [h('h2', { class: 'subtitulo', texto: 'Lo habitual' }), h('button', { type: 'button', class: 'boton derecha', id: 'volverInicio', texto: 'Volver al inicio', onclick: alInicio })]),
      h('p', { class: 'suave', texto: 'Los puntos que se repiten en las reuniones de cada mes, aprendidos de tus actas. Lo que cambies aquí manda: un punto que quites no vuelve. «' + H.PUNTO_ANTERIOR + '» va siempre el primero de cada convocatoria.' }),
      h('div', { class: 'fila' }, [boton, h('button', { type: 'button', class: 'boton', id: 'traerDesdeHabitual', texto: 'Traer actas del documento antiguo', onclick: function () { est.abrirTraer(); } })]), avisoRub, h('p', { class: 'suave', texto: PEGA_GOOGLE }), estado, fuentes
    ].concat(meses.map(function (m) { return bloqueMes(est, habitual, m, repintar); })).filter(Boolean));
  }

  g.PantallaHabitual = { pintarHabitual: pintarHabitual, elegirDocumentos: elegirDocumentos };
})(window);
