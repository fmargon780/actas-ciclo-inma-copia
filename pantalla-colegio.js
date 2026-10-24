/* Tarjeta «Datos del colegio» de Ajustes (fila 79): nombre, dirección, código postal y localidad, teléfono, correo, código de centro, logo y la casilla «Sin logo de la Junta».
   Se guarda en ACTAS/colegio.json y el logo en un fichero aparte (colegio.js). Lleva también el aviso que sale cuando se pide un documento sin los datos del colegio. */
(function (g) {
  'use strict';
  var h = g.Dom.h, C = g.Colegio;

  /* El aviso «Antes de sacar documentos, rellena los datos de tu colegio.» con «Ir a Ajustes». true si falta el colegio (y entonces no hay que sacar el documento). */
  async function avisoSiFalta(est, caja) {
    var frase = await C.falta(est.raiz);
    if (!frase) return false;
    g.Dom.decir(caja, frase);
    caja.appendChild(h('button', { type: 'button', class: 'boton chico', id: 'irAjustes', texto: 'Ir a Ajustes', onclick: function () { est.irAjustes('colegio'); } }));
    return true;
  }

  function aTexto(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return g.btoa(s); }
  function vista(img) { return 'data:image/' + (img.tipo === 'png' ? 'png' : 'jpeg') + ';base64,' + aTexto(img.bytes); }

  async function tarjeta(est, alGuardar) {
    var c = (await C.alAbrir(est.raiz)) || { nombre: '', direccion: '', cpLocalidad: '', telefono: '', correo: '', codigo: '', logo: '', sinLogoJunta: false };
    var aviso = g.Dom.aviso(), hecho = h('div', { class: 'aviso ok', id: 'colegioGuardado', hidden: '' });
    function campo(id, etiqueta, valor, ayuda) {
      var i = h('input', { type: 'text', id: id, value: valor });
      return { caja: h('label', { class: 'campo' }, [etiqueta, i]), input: i };
    }
    var nombre = campo('colegioNombre', 'Nombre del colegio', c.nombre), direccion = campo('colegioDireccion', 'Dirección', c.direccion);
    var cpLoc = campo('colegioCpLocalidad', 'Código postal y localidad', c.cpLocalidad), telefono = campo('colegioTelefono', 'Teléfono', c.telefono);
    var correo = campo('colegioCorreo', 'Correo', c.correo), codigo = campo('colegioCodigo', 'Código de centro', c.codigo);
    var sinJunta = h('input', { type: 'checkbox', id: 'colegioSinJunta' }); sinJunta.checked = !!c.sinLogoJunta;

    /* el logo: lo guardado, o el que se acaba de elegir y todavía no se ha guardado */
    var nuevo = null, hayGuardado = !!c.logo, previa = h('img', { id: 'colegioLogoVista', alt: 'Logo del colegio', class: 'logo-vista', hidden: '' });
    var entrada = h('input', { type: 'file', id: 'colegioLogoArchivo', accept: 'image/png,image/jpeg', hidden: '' });
    var subir = h('button', { type: 'button', class: 'boton', id: 'colegioSubirLogo', texto: 'Subir logo', onclick: function () { entrada.click(); } });
    var quitar = h('button', { type: 'button', class: 'boton', id: 'colegioQuitarLogo', texto: 'Quitar logo', onclick: async function () {
      g.Dom.decir(aviso, ''); hecho.hidden = true;
      try {
        if (!nuevo && hayGuardado) { await C.quitarLogo(est.raiz); hayGuardado = false; }
        nuevo = null; pintarLogo();
      } catch (e) { g.Dom.decir(aviso, e.message || String(e)); }
    } });
    function pintarLogo() {
      var hay = !!nuevo || hayGuardado;
      quitar.hidden = !hay; previa.hidden = !hay;
      if (nuevo) previa.src = vista(nuevo);
      else if (hayGuardado) {
        previa.removeAttribute('src');
        C.leerLogo(est.raiz, { logo: c.logo }).then(function (img) { if (img && !nuevo && hayGuardado) previa.src = vista(img); });
      }
    }
    entrada.onchange = async function () {
      g.Dom.decir(aviso, ''); hecho.hidden = true;
      var f = entrada.files && entrada.files[0];
      entrada.value = '';
      if (!f) return;
      try { nuevo = C.logoDeBytes(new Uint8Array(await f.arrayBuffer())); pintarLogo(); }
      catch (e) { g.Dom.decir(aviso, e.message || String(e)); }
    };
    pintarLogo();

    var guardar = h('button', { type: 'button', class: 'boton principal', id: 'guardarColegio', texto: 'Guardar', onclick: async function () {
      hecho.hidden = true;
      try {
        var res = await C.guardar(est.raiz, { nombre: nombre.input.value, direccion: direccion.input.value, cpLocalidad: cpLoc.input.value, telefono: telefono.input.value,
          correo: correo.input.value, codigo: codigo.input.value, sinLogoJunta: sinJunta.checked }, { logoNuevo: nuevo });
        c = res; nuevo = null; hayGuardado = !!res.logo; telefono.input.value = res.telefono; pintarLogo();
        g.Dom.decir(aviso, ''); hecho.textContent = 'Datos del colegio guardados.'; hecho.hidden = false;
        est.ficha = await g.Datos.leerFicha(est.raiz);
        if (alGuardar) await alGuardar(); /* se repinta Ajustes para que «Datos del curso» traiga la localidad; el aviso de guardado vuelve a salir (est.colegioGuardado) */
      } catch (e) { g.Dom.decir(aviso, e.message || String(e)); }
    } });
    if (est.colegioGuardado) { est.colegioGuardado = false; hecho.textContent = 'Datos del colegio guardados.'; hecho.hidden = false; }
    return h('section', { class: 'tarjeta ancha', id: 'tarjetaColegio' }, [
      h('h2', { texto: 'Datos del colegio' }),
      h('p', { class: 'suave', texto: 'Salen en la cabecera y en el pie de todos los PDF y Word que saca la app. Se guardan en tu carpeta ACTAS.' }),
      h('div', { class: 'cuatro' }, [nombre.caja, direccion.caja]),
      h('div', { class: 'cuatro' }, [cpLoc.caja, telefono.caja, correo.caja, codigo.caja]),
      h('div', { class: 'fila' }, [subir, quitar, previa, entrada]),
      h('div', { class: 'fila' }, [h('label', { class: 'campo-casilla' }, [sinJunta, ' Sin logo de la Junta ']), g.Ayuda.aviso('colegio-sin-junta')]),
      h('div', { class: 'fila' }, [guardar]), hecho, aviso
    ]);
  }

  g.PantallaColegio = { tarjeta: tarjeta, avisoSiFalta: avisoSiFalta };
})(window);
