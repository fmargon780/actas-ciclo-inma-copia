/* Ajustes: los datos del colegio (colegio.json), los datos del curso (ficha.json), las redacciones de Claude (en la app de internet, cuántas quedan este mes; en la copia sin internet, la clave de clave.json o copiada de la carpeta RÚBRICAS) y Mi tutoría. */
(function (g) {
  'use strict';
  var h = g.Dom.h;

  /* La línea de las redacciones de este mes, a partir de lo que dice el servicio ('yo'). */
  function fraseRedacciones(r) {
    if (r.tope === 'sin tope') return 'Redacciones de Claude: sin tope (' + r.redacciones + ' este mes).';
    return 'Redacciones de Claude este mes: te quedan ' + Math.max(Number(r.tope) - r.redacciones, 0) + ' de ' + r.tope + '.';
  }
  async function tarjetaRedacciones() {
    var texto = h('p', { id: 'redaccionesMes', texto: 'Mirando cuántas redacciones te quedan…' });
    var r = await g.Servicio.llamar('yo');
    if (r && r.ok) { g.Servicio.recordarSaldo({ tope: r.tope, redacciones: r.redacciones }); texto.textContent = fraseRedacciones(r); }
    else texto.textContent = 'No he podido mirar cuántas redacciones te quedan. Inténtalo más tarde.';
    return h('section', { class: 'tarjeta ancha', id: 'tarjetaRedacciones' }, [h('h2', { texto: 'Redacciones de Claude' }), texto]);
  }

  async function pintarAjustes(est, refrescar) {
    var enServicio = g.Claude.enServicio();
    var actual = enServicio ? '' : await g.Datos.leerClave(est.raiz);
    var aviso = g.Dom.aviso();
    var dicho = h('div', { class: 'aviso ok', id: 'clavePuesta', hidden: '' });
    var campo = h('input', { type: 'password', id: 'campoClave', autocomplete: 'off', placeholder: 'Pega aquí la clave de Claude', value: actual });
    function ok(texto) { dicho.textContent = texto; dicho.hidden = false; g.Dom.decir(aviso, ''); }

    var guardar = h('button', { type: 'button', class: 'boton principal', id: 'guardarClave', texto: 'Guardar la clave', onclick: async function () {
      var v = campo.value.trim();
      if (!v) { g.Dom.decir(aviso, 'Escribe o pega la clave primero.'); return; }
      try { await g.Datos.guardarClave(est.raiz, v); ok('Clave guardada.'); } catch (e) { g.Dom.decir(aviso, e.message || String(e)); }
    } });
    var deRubricas = h('button', { type: 'button', class: 'boton', id: 'claveDeRubricas', texto: 'Usar la de Rúbricas', onclick: async function () {
      try {
        var otra = await g.Carpeta.elegirRubricas();
        var raiz = g.Carpeta.adaptador(otra);
        var marca = await raiz.leerJSON('rubricas.json');
        if (!marca) { g.Dom.decir(aviso, g.Rubricas.FRASE_NO_ES); return; }
        await g.Carpeta.guardarRubricas(otra); est.alumnado = null; /* la lista de alumnado usa esta misma carpeta */
        var c = await g.Datos.leerClave(raiz);
        if (!c) { g.Dom.decir(aviso, 'En Rúbricas todavía no hay ninguna clave guardada.'); return; }
        await g.Datos.guardarClave(est.raiz, c); campo.value = c; ok('Clave copiada de Rúbricas.');
      } catch (e) { if (e && e.name === 'AbortError') return; g.Dom.decir(aviso, e.message || String(e)); }
    } });
    var tutoria = await g.PantallaTutoria.tarjeta(est, function () { refrescar(); });
    var colegio = await g.PantallaColegio.tarjeta(est, function () { est.colegioGuardado = true; est.destinoAjustes = 'colegio'; return refrescar(); });
    var datosCurso = await g.PantallaDatosCurso.tarjeta(est);
    var estilo = await g.PantallaEstilo.tarjeta(est);
    var traer = h('section', { class: 'tarjeta ancha' }, [
      h('h2', { texto: 'Actas del documento antiguo ' }, [g.Ayuda.aviso('traer-actas')]),
      h('p', { class: 'suave', texto: 'Trae a la carpeta ACTAS, con su PDF y su Word, las actas de este curso que tengas en un documento de Word.' }),
      h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton', id: 'traerDesdeAjustes', texto: 'Traer actas del documento antiguo', onclick: function () { est.abrirTraer(); } })])
    ]);
    var cuenta = g.Entrada.tarjeta(), invitados = await g.PantallaInvitados.tarjeta();
    var claude = enServicio ? await tarjetaRedacciones() : h('section', { class: 'tarjeta ancha' }, [
      h('h2', { texto: 'Clave de Claude ' }, [g.Ayuda.aviso('clave-claude')]),
      h('p', { class: 'suave', texto: 'Se guarda en tu carpeta ACTAS. La usará Claude para redactar las actas.' }),
      campo, h('div', { class: 'fila' }, [guardar, deRubricas, g.Ayuda.aviso('clave-rubricas')]), dicho, aviso
    ]);
    g.Dom.montar([cuenta, invitados, colegio, datosCurso, claude, estilo, traer, tutoria].filter(Boolean));
    /* «Ir a Ajustes» desde un aviso de falta de datos del colegio: baja hasta su tarjeta */
    if (est.destinoAjustes) { var d = est.destinoAjustes; est.destinoAjustes = null; var t = document.getElementById(d === 'colegio' ? 'tarjetaColegio' : d); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); }
  }
  g.PantallaAjustes = { pintarAjustes: pintarAjustes };
})(window);
