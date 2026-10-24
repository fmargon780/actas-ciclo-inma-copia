/* Entrada con Google (solo en la app de internet): sin sesión, solo se ve el botón de Google; la cuenta ha de estar en la lista de invitados. */
(function (g) {
  'use strict';
  var h = g.Dom.h;
  var URL_GOOGLE = 'https://accounts.google.com/gsi/client';
  var FRASE_COLEGIO = 'Si tu cuenta del colegio no te deja entrar, prueba con tu cuenta personal de Google.';

  /* La copia sin internet (file:) y las pruebas en http no piden entrar: Google no funciona ahí. */
  function hayQueEntrar(loc) { return (loc || g.location).protocol === 'https:'; }

  function cargarGoogle() {
    if (g.google && g.google.accounts && g.google.accounts.id) return Promise.resolve();
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = URL_GOOGLE; s.async = true; s.onload = function () { ok(); }; s.onerror = function () { s.remove(); no(new Error('google')); };
      document.head.appendChild(s);
    });
  }

  function pintar(alEntrar, motivo) {
    document.body.classList.add('sin-entrar');
    var aviso = h('div', { class: 'aviso error', id: 'avisoEntrada', hidden: '' });
    var boton = h('div', { id: 'botonGoogle' });
    var otra = h('button', { type: 'button', class: 'boton', id: 'otraCuenta', texto: 'Entrar con otra cuenta', hidden: '', onclick: function () { pintar(alEntrar); } });
    var reintentar = h('button', { type: 'button', class: 'boton', id: 'reintentarEntrada', texto: 'Reintentar', hidden: '', onclick: function () { pintar(alEntrar); } });
    g.Dom.montar([h('div', { class: 'vacio', id: 'pantallaEntrada' }, [
      h('h2', { texto: 'Mis actas' }),
      h('p', { texto: 'Entra con tu cuenta de Google para usar la app.' }),
      boton, h('p', { class: 'suave', id: 'fraseColegio', texto: FRASE_COLEGIO }), aviso, otra, reintentar
    ])]);
    function decir(texto, conOtra) { g.Dom.decir(aviso, texto); otra.hidden = !conOtra; reintentar.hidden = !!conOtra; }
    if (motivo) decir(motivo, false);

    async function alCredencial(resp) {
      decir('', false);
      var r = await g.Servicio.llamar('entrar', { token: resp && resp.credential });
      if (r && r.ok) { g.Servicio.guardar(r); document.body.classList.remove('sin-entrar'); alEntrar(r); return; }
      if (r && r.motivo === 'no-invitado') decir('Esta app está en prueba con un grupo cerrado de docentes. La cuenta ' + (r.correo || '') + ' no está invitada.', true);
      else if (r && r.motivo === 'red') decir('El servicio no responde ahora mismo. Inténtalo otra vez en un momento.', false), reintentar.hidden = false;
      else decir('Google no ha podido confirmar tu cuenta. Inténtalo otra vez.', true);
    }
    cargarGoogle().then(function () {
      g.google.accounts.id.initialize({ client_id: g.Servicio.CLIENT_ID, callback: alCredencial, auto_select: false });
      g.google.accounts.id.renderButton(boton, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'es', type: 'standard' });
    }, function () { decir('No he podido cargar el acceso de Google. Comprueba tu conexión.', false); reintentar.hidden = false; });
  }

  /* Pide entrar si hace falta. Devuelve true si ya hay sesión; si no, pinta la entrada y llama a `alEntrar` cuando se consiga. */
  function pedir(alEntrar) {
    if (!hayQueEntrar() || g.Servicio.sesion()) return true;
    pintar(alEntrar);
    return false;
  }

  function salir() {
    g.Servicio.olvidar();
    try { g.google.accounts.id.disableAutoSelect(); } catch (e) { /* Google no estaba cargado */ }
    g.location.reload();
  }

  /* Ajustes, arriba: con quién has entrado y «Salir». Sin sesión (copia sin internet) no sale nada. */
  function tarjeta() {
    var s = g.Servicio.sesion();
    if (!s) return null;
    return h('section', { class: 'tarjeta ancha', id: 'tarjetaCuenta' }, [
      h('div', { class: 'fila' }, [
        h('p', { id: 'hasEntradoComo', texto: 'Has entrado como ' + s.correo }),
        h('button', { type: 'button', class: 'boton', id: 'salirCuenta', texto: 'Salir', onclick: salir })
      ])
    ]);
  }

  g.Entrada = { hayQueEntrar: hayQueEntrar, pedir: pedir, pintar: pintar, tarjeta: tarjeta, salir: salir, FRASE_COLEGIO: FRASE_COLEGIO };
})(window);
