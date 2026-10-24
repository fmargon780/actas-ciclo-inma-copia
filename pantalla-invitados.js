/* Tarjeta «Invitados» de Ajustes (solo para quien administra): quién puede entrar y cuántas redacciones lleva este mes. */
(function (g) {
  'use strict';
  var h = g.Dom.h;
  var FALLOS = { correo: 'Eso no parece un correo. Revisa que lleve la arroba y el dominio.', 'ya-esta': 'Ese correo ya está invitado.', 'no-esta': 'Ese correo ya no está en la lista.',
    sesion: 'La sesión ha caducado. Pulsa «Salir» y vuelve a entrar.', 'no-admin': 'Solo quien administra la app puede cambiar la lista.', red: 'El servicio no responde ahora mismo. Inténtalo otra vez.' };
  function fraseFallo(r) { return FALLOS[r && r.motivo] || 'No he podido hacerlo. Inténtalo otra vez.'; }
  function cuenta(i) { return i.tope === 'sin tope' ? 'sin tope · ' + i.redacciones : i.redacciones + ' de ' + i.tope; }
  function fecha(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function hoyMes() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }

  async function tarjeta() {
    var s = g.Servicio.sesion();
    if (!s || !s.admin) return null;
    var aviso = g.Dom.aviso(), caja = h('div', { id: 'listaInvitados' }), saldo = h('p', { class: 'aviso', id: 'avisoSaldo', hidden: '' });
    var campo = h('input', { type: 'text', id: 'campoInvitado', autocomplete: 'off', inputmode: 'email', placeholder: 'Correo de Google' });

    async function pedir(accion, datos) {
      var r = await g.Servicio.llamar(accion, datos);
      if (!r || !r.ok) { g.Dom.decir(aviso, fraseFallo(r)); return null; }
      g.Dom.decir(aviso, ''); return r;
    }
    async function recargar() {
      var r = await pedir('invitados');
      if (!r) return;
      var cuando = r.ultimoSinSaldo && String(r.ultimoSinSaldo).slice(0, 7) === hoyMes() ? r.ultimoSinSaldo : '';
      saldo.textContent = cuando ? 'El saldo de Claude se acabó el ' + fecha(cuando) + '.' : ''; saldo.hidden = !cuando;
      caja.textContent = '';
      if (!r.invitados.length) caja.appendChild(h('p', { class: 'suave', texto: 'Todavía no hay invitados.' }));
      r.invitados.forEach(function (i) { caja.appendChild(fila(i)); });
    }
    function fila(i) {
      var zona = h('div', { class: 'fila' });
      var cuerpo = h('div', { class: 'invitado' }, [h('span', { class: 'invitado-correo', texto: i.correo }), h('span', { class: 'suave', texto: cuenta(i) }), zona]);
      function botones() {
        zona.textContent = '';
        zona.appendChild(h('button', { type: 'button', class: 'boton', texto: 'Cambiar tope', onclick: tope }));
        zona.appendChild(h('button', { type: 'button', class: 'boton', texto: 'Quitar', onclick: quitar }));
      }
      function tope() {
        zona.textContent = '';
        var c = h('input', { type: 'text', 'aria-label': 'Tope al mes', placeholder: 'Un número o «sin tope»', value: i.tope === 'sin tope' ? 'sin tope' : String(i.tope) });
        zona.appendChild(c);
        zona.appendChild(h('button', { type: 'button', class: 'boton principal', texto: 'Guardar', onclick: async function () { if (await pedir('cambiar-tope', { correo: i.correo, tope: c.value.trim() })) recargar(); } }));
        zona.appendChild(h('button', { type: 'button', class: 'boton', texto: 'Cancelar', onclick: botones }));
      }
      function quitar() {
        zona.textContent = '';
        zona.appendChild(h('span', { texto: '¿Quitar a ' + i.correo + '? No podrá entrar.' }));
        zona.appendChild(h('button', { type: 'button', class: 'boton principal', texto: 'Sí, quitar', onclick: async function () { if (await pedir('quitar', { correo: i.correo })) recargar(); } }));
        zona.appendChild(h('button', { type: 'button', class: 'boton', texto: 'No', onclick: botones }));
      }
      botones();
      return cuerpo;
    }
    var invitar = h('button', { type: 'button', class: 'boton principal', id: 'invitar', texto: 'Invitar', onclick: async function () {
      var correo = campo.value.trim().toLowerCase().replace(/\s+/g, '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { g.Dom.decir(aviso, FALLOS.correo); return; }
      if (await pedir('invitar', { correo: correo })) { campo.value = ''; recargar(); }
    } });
    var el = h('section', { class: 'tarjeta ancha', id: 'tarjetaInvitados' }, [
      h('h2', { texto: 'Invitados ' }, [g.Ayuda.aviso('invitados')]),
      h('p', { class: 'suave', texto: 'Solo pueden entrar en la app las cuentas de esta lista. Un invitado nuevo puede pedir 25 redacciones a Claude al mes.' }),
      saldo, h('div', { class: 'fila' }, [campo, invitar]), aviso, caja
    ]);
    recargar();
    return el;
  }
  g.PantallaInvitados = { tarjeta: tarjeta, cuenta: cuenta };
})(window);
