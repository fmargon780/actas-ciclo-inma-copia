/* Lo de Claude en pantalla: la caja «Pedir a Claude» de la actividad, con su rúbrica al aceptar.
   Textos siempre con textContent. A Claude solo van criterio, área, curso e ideas de Inma, nunca nombres de alumnos. */
(function (g) {
  'use strict';
  var Cl = g.RubClaude, R = g.Rubrica, T = g.Trabajo, D = g.RubDatos, Dm = g.RubDom, h = Dm.h;
  var ETIQUETA = 'Propuesta de la IA · revísala';

  async function nombresAlumnado(est) {
    var todos = [];
    for (var i = 0; i < est.grupos.length; i++) todos = todos.concat(await D.leerAlumnado(est.carpeta, est.grupos[i].id));
    return todos;
  }
  function nombreArea(est) { var a = g.Criterios.areas().filter(function (x) { return x.id === est.areaCrit; })[0]; return a ? a.nombre : est.areaCrit; }

  /* La caja de la pantalla de actividad. ctx: { criterios(), actual(), rellenar(propuesta), aceptar() -> actividad guardada }. */
  function cajaActividad(est, ctx, refrescar) {
    var aviso = Dm.aviso(), propuesta = null;
    var idea = h('textarea', { id: 'claudeIdea', placeholder: 'Tu idea en una o dos frases. Por ejemplo: una carta a un compañero sobre la excursión; tengo dos sesiones.' });
    var estado = h('p', { class: 'suave', id: 'claudeEstado' });
    var cambios = h('textarea', { id: 'claudeCambios', placeholder: 'Qué quieres que cambie' });
    var resultado = h('div', { class: 'propuesta-ia', id: 'propuestaIA', hidden: '' });

    var ocupado = function (texto) { estado.textContent = texto || ''; Array.prototype.forEach.call(caja.querySelectorAll('button'), function (b) { b.disabled = !!texto; }); };
    var contexto = function () {
      var criterios = ctx.criterios();
      if (!criterios.length) throw new Error('Marca antes al menos un criterio (abajo) para que Claude sepa qué evaluar.');
      return { area: nombreArea(est), curso: est.cursoCrit, criterios: criterios };
    };
    var conClave = async function (fn) {
      Dm.decir(aviso, '');
      try {
        var clave = await Cl.claveDe(est.raizActas);
        if (!clave) throw Object.assign(new Error('Falta la clave de Claude. Pégala una vez en «Ajustes».'), { codigo: 'sin-clave' });
        await fn(clave, await nombresAlumnado(est));
      } catch (e) { ocupado(''); Dm.decir(aviso, e.message || String(e)); if (e.codigo === 'sin-clave' || e.codigo === 'clave') mostrarAjustes(); }
    };
    var mostrarAjustes = function () {
      aviso.appendChild(document.createTextNode(' '));
      aviso.appendChild(h('button', { type: 'button', class: 'boton', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes(); } }));
    };
    var proponer = function (anterior, textoCambios) {
      return conClave(async function (clave, nombres) {
        var c = contexto(); c.idea = idea.value.trim(); c.anterior = anterior; c.cambios = textoCambios;
        if (!c.idea) throw new Error('Escribe tu idea en una o dos frases.');
        ocupado('Claude está pensando…');
        propuesta = await Cl.proponerActividad(clave, c, nombres);
        ctx.rellenar(propuesta); ocupado('');
        resultado.hidden = false; cambios.value = '';
        porque.textContent = 'Por qué encaja: ' + propuesta.porque + ' · ' + propuesta.duracion;
      });
    };
    var porque = h('p', { class: 'suave', id: 'claudePorque' });
    resultado.appendChild(h('p', { class: 'etiqueta-ia', texto: ETIQUETA }));
    resultado.appendChild(porque);
    resultado.appendChild(h('p', { class: 'suave', texto: 'Ya está escrita en los campos de abajo: puedes editarla.' }));
    resultado.appendChild(h('label', { class: 'campo' }, ['Pedir cambios', cambios]));
    resultado.appendChild(h('div', { class: 'fila' }, [
      h('button', { type: 'button', class: 'boton', id: 'pedirCambios', texto: 'Pedir cambios', onclick: function () {
        if (!cambios.value.trim()) { Dm.decir(aviso, 'Escribe qué quieres que cambie.'); return; }
        proponer(ctx.actual(), cambios.value.trim());
      } }),
      h('button', { type: 'button', class: 'boton principal', id: 'aceptarClaude', texto: 'Aceptar y crear la rúbrica', onclick: function () {
        conClave(async function (clave, nombres) {
          var c = contexto(); c.actividad = await ctx.aceptar();
          ocupado('Claude está preparando la rúbrica…');
          var filas = await Cl.proponerRubrica(clave, c, nombres);
          var r = R.rubricaNueva(c.actividad.id, c.actividad.titulo, 0);
          r.filas = filas.map(function (f) { var x = R.filaNueva(f.texto); x.peso = f.peso; x.celdas = f.celdas; if (f.criterio) x.criterio = f.criterio; return x; });
          r.porIA = true;
          /* Si a algún criterio no le ha salido ninguna fila, la rúbrica se abre sin guardar (con el aviso de siempre) hasta que Inma la complete. */
          if (!filas.faltan || !filas.faltan.length) await T.guardarRubrica(est.carpeta, r);
          est.actividad = c.actividad; est.rubrica = r; est.paso = 'rubrica'; await refrescar();
        });
      } })
    ]));

    var caja = h('div', { class: 'caja-ia', id: 'cajaClaude' }, [
      h('h3', { texto: 'Pedir a Claude' }),
      h('p', { class: 'suave', texto: 'Cuéntale tu idea y te propone la actividad y su rúbrica. No escribas nombres de alumnos.' }),
      idea,
      h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton principal', id: 'pedirClaude', texto: 'Proponer con Claude', onclick: function () { proponer(null, null); } })]),
      estado, aviso, resultado
    ]);
    return caja;
  }

  g.PantallaClaude = { cajaActividad: cajaActividad, nombresAlumnado: nombresAlumnado, ETIQUETA: ETIQUETA };
})(window);
