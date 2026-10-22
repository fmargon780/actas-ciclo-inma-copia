/* Mi tutoría (fila 40): el grupo de tutoría y el nombre de la tutora. Sale la primera vez que se entra en «Entrevista con familia» y se cambia en Ajustes.
   El grupo se elige de los grupos de la lista de Rúbricas (carpeta RÚBRICAS abierta una vez); el nombre se propone con el de la coordinadora de la ficha. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  /* La tarjeta; `alGuardar()` se llama cuando queda guardado. Devuelve el elemento (la carga de la lista de alumnado es asíncrona). */
  async function tarjeta(est, alGuardar, repintar) {
    var actual = await g.Tutoria.leerTutoria(est.raiz);
    await g.Rubricas.cargar(est);
    var a = est.alumnado, grupos = a && a.estado === 'ok' && a.lista ? a.lista.grupos.slice() : [];
    if (actual && grupos.indexOf(actual.grupo) < 0) grupos.unshift(actual.grupo);
    var aviso = g.Dom.aviso(), hecho = h('div', { class: 'aviso ok', id: 'tutoriaGuardada', hidden: '' });
    var selector = h('select', { id: 'grupoTutoria' }, [h('option', { value: '', texto: 'Elige tu grupo' })].concat(grupos.map(function (n) {
      var o = h('option', { value: n, texto: n }); if (actual && actual.grupo === n) o.selected = true; return o;
    })));
    var nombre = h('input', { type: 'text', id: 'nombreTutora', placeholder: 'Tu nombre y apellidos', value: actual ? actual.tutora : g.Tutoria.proponerTutora(est.ficha) });
    var guardar = h('button', { type: 'button', class: 'boton principal', id: 'guardarTutoria', texto: 'Guardar mi tutoría', onclick: async function () {
      if (!selector.value) { g.Dom.decir(aviso, 'Elige primero tu grupo de tutoría.'); return; }
      try {
        await g.Tutoria.guardarTutoria(est.raiz, selector.value, nombre.value);
        g.Dom.decir(aviso, ''); hecho.textContent = 'Tutoría guardada.'; hecho.hidden = false;
        if (alGuardar) await alGuardar();
      } catch (e) { g.Dom.decir(aviso, e.message || String(e)); }
    } });
    var nodos = [
      h('h2', { texto: 'Mi tutoría' }),
      h('p', { class: 'suave', texto: 'El grupo del que eres tutora y tu nombre. Se guardan en tu carpeta ACTAS y los usan las entrevistas con las familias.' })
    ];
    var avisoRub = g.PantallaFichas && g.PantallaFichas.avisoRubricas(est, function () { (repintar || alGuardar || function () {})(); }, 'Para elegir tu grupo, abre una vez la carpeta RÚBRICAS (Mi unidad › RÚBRICAS). Solo la leo: no escribo nada en ella.');
    if (avisoRub) nodos.push(avisoRub);
    nodos.push(h('label', { class: 'campo' }, ['Grupo de tutoría', selector]), h('label', { class: 'campo' }, ['Tu nombre como tutora', nombre]), h('div', { class: 'fila' }, [guardar]), hecho, aviso);
    return h('section', { class: 'tarjeta ancha', id: 'tarjetaTutoria' }, nodos);
  }

  g.PantallaTutoria = { tarjeta: tarjeta };
})(window);
