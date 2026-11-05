/* «Subir o pegar» en cada bloque de clase del punto de evaluación del acta de ciclo (fila 106, sustituye a «Pegar resumen de otra clase» de la fila 61).
   La caja se abre dentro del bloque. Paso 1: subir un fichero (Word, PDF, texto, foto) o pegar el texto; paso 2 (solo «Resumir con Claude»): ver qué va a Claude,
   con los nombres tapados; paso 3: revisar el resumen de Claude. La lógica está en evaluacion-ciclo.js, resumen-claude.js y leer-fichero.js.
   ctx: { b (borrador), est, todos (alumnado del ciclo o null), cambio(), repintar() }; gr: el bloque de la clase.
   Devuelve { boton, tarjeta }: el botón va en la fila del hueco «Resumen de la sesión de evaluación» y la tarjeta debajo. */
(function (g) {
  'use strict';
  var h = g.Dom.h, EC = g.EvaluacionCiclo, RC = g.ResumenClaude, LF = g.LeerFichero, AC = g.AlumnadoClaude;
  var ACEPTA = '.docx,.pdf,.txt,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,text/plain';

  function crear(ctx, gr) {
    var clase = gr.nombre, s = null, mio = 0;
    var boton = h('button', { type: 'button', class: 'boton chico', 'data-accion': 'abrir-subir-pegar', 'data-abrir': clase, texto: 'Subir o pegar', onclick: abrir });
    var tarjeta = h('div', { class: 'tarjeta-pegar', 'data-resumen-ciclo': clase, hidden: '' });

    function nuevo() { return { paso: 1, txt: '', fichero: '', mensaje: null, trozos: [], resumen: '', preguntar: null, ocupado: '' }; }
    function abrir() { s = nuevo(); mio++; boton.disabled = true; tarjeta.hidden = false; dibujar(); }
    function cerrar() { s = null; mio++; boton.disabled = false; tarjeta.hidden = true; tarjeta.textContent = ''; }
    /* Un botón; `inactivo` lo deja sin pulsar (h() pone todo atributo que se le pase, así que `disabled` solo va si hace falta). */
    function boton2(atributos, inactivo) { if (inactivo) atributos.disabled = ''; return h('button', atributos); }
    function lleno(t) { return !!String(t || '').trim(); }
    function mensaje(texto, error, extra) { return h('div', { class: 'aviso' + (error ? ' error' : ''), 'data-mensaje-resumen': clase }, [texto, extra || null]); }
    function irAjustes() { return h('button', { type: 'button', class: 'boton chico', 'data-accion': 'ir-ajustes', texto: 'Ir a Ajustes', onclick: function () { ctx.est.irAjustes(); } }); }

    /* Poner el texto en el bloque. Si ya tenía resumen, pregunta qué hacer. */
    function colocar(cuerpo, op) {
      var r = EC.ponerPegado(ctx.b, clase, cuerpo, ctx.todos, op);
      if (r.estado === 'pregunta') { s.preguntar = { cuerpo: cuerpo, op: op }; s.mensaje = null; refrescar(); return; }
      if (r.estado !== 'puesto') { s.mensaje = { texto: r.estado === 'vacio' ? 'No hay texto que poner.' : 'No encuentro el bloque de ' + clase + '.', error: true }; refrescar(); return; }
      ctx.cambio(); cerrar(); ctx.repintar();
    }
    function pregunta() {
      var p = s.preguntar;
      function con(extra) { return function () { colocar(p.cuerpo, Object.assign({}, p.op, extra)); }; }
      return h('div', { class: 'aviso pregunta fila', 'data-accion': 'pregunta-bloque' }, [
        h('span', { texto: 'Ese bloque ya tiene un resumen. ¿Qué hago? ' }),
        h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'sustituir-resumen', texto: 'Sustituir', onclick: con({ sustituir: true }) }),
        h('button', { type: 'button', class: 'boton chico principal', 'data-accion': 'anadir-resumen', texto: 'Añadir debajo', onclick: con({ anadir: true }) }),
        h('button', { type: 'button', class: 'boton chico', 'data-accion': 'dejar-resumen', texto: 'Dejar lo que hay', onclick: function () { s.preguntar = null; refrescar(); } })
      ]);
    }

    /* El texto dice ser de otra clase u otra evaluación: avisos en rojo y botones bloqueados. */
    function bloqueos() {
      var o = EC.origenDe(s.txt);
      return { origen: o, clase: EC.motivoClase(o, clase), evaluacion: EC.motivoEvaluacion(o, ctx.b.evaluacion) };
    }

    var dinamico = null, lectura = null, cuenta = null;

    /* --- Paso 1 --- */
    async function subir(archivo) {
      var yo = mio, quien = s;
      quien.ocupado = 'Leyendo «' + archivo.name + '»…'; quien.mensaje = null; quien.preguntar = null; refrescar();
      try {
        var r = await LF.leer(archivo, { progreso: function (t) { if (s === quien && yo === mio) { quien.ocupado = t; refrescar(); } } });
        if (s !== quien || yo !== mio) return;
        quien.txt = r.texto; quien.fichero = archivo.name;
        quien.mensaje = r.imagen ? { texto: LF.AVISO_IMAGEN + (r.aviso ? ' ' + r.aviso : '') } : r.aviso ? { texto: r.aviso } : null;
      } catch (e) {
        if (s !== quien || yo !== mio) return;
        quien.mensaje = { texto: e && e.message ? e.message : 'No he podido leer «' + archivo.name + '».', error: true };
      }
      quien.ocupado = ''; dibujar();
    }

    function botones1() {
      var o = bloqueos(), sin = !lleno(s.txt) || !!s.ocupado || !!o.clase || !!o.evaluacion, cuerpo = EC.leerPegado(s.txt).cuerpo, l = [];
      if (o.origen.linea) {
        l.push(boton2({ type: 'button', class: 'boton principal chico', 'data-accion': 'poner-en-bloque', texto: 'Poner en este bloque', onclick: function () { colocar(cuerpo, { sinRevisar: true }); } }, sin));
      } else {
        l.push(boton2({ type: 'button', class: 'boton principal chico', 'data-accion': 'resumir-claude', texto: 'Resumir con Claude', onclick: function () {
          s.trozos = RC.trocear(cuerpo, ctx.todos); s.paso = 2; s.mensaje = null; s.preguntar = null; dibujar();
        } }, sin));
        l.push(boton2({ type: 'button', class: 'boton chico', 'data-accion': 'poner-tal-cual', texto: 'Poner tal cual', onclick: function () { colocar(cuerpo, {}); } }, sin));
      }
      l.push(h('button', { type: 'button', class: 'boton chico', 'data-accion': 'cancelar-resumen', texto: 'Cancelar', onclick: cerrar }));
      return { nodos: o, botones: l };
    }

    function refrescar() {
      if (!dinamico) return;
      dinamico.textContent = '';
      if (s.paso === 1) {
        var b = botones1();
        if (b.nodos.clase) dinamico.appendChild(mensaje(b.nodos.clase, true));
        if (b.nodos.evaluacion) dinamico.appendChild(mensaje(b.nodos.evaluacion, true));
        if (s.ocupado) dinamico.appendChild(h('div', { class: 'suave', role: 'status', 'data-leyendo': clase, texto: s.ocupado }));
        if (s.mensaje) dinamico.appendChild(mensaje(s.mensaje.texto, s.mensaje.error));
        if (s.preguntar) dinamico.appendChild(pregunta());
        dinamico.appendChild(h('div', { class: 'fila' }, b.botones));
      } else if (s.paso === 3) {
        if (s.mensaje) dinamico.appendChild(mensaje(s.mensaje.texto, s.mensaje.error));
        if (s.preguntar) dinamico.appendChild(pregunta());
        dinamico.appendChild(h('div', { class: 'fila' }, [
          h('button', { type: 'button', class: 'boton principal chico', 'data-accion': 'poner-en-bloque', texto: 'Poner en este bloque', onclick: function () { colocar(s.resumen, { sinRevisar: true }); } }),
          h('button', { type: 'button', class: 'boton chico', 'data-accion': 'cancelar-resumen', texto: 'Cancelar', onclick: cerrar })
        ]));
      }
    }

    function zona1() {
      var entrada = h('input', { type: 'file', accept: ACEPTA, hidden: '', 'data-subir': clase });
      entrada.onchange = function () { var f = entrada.files && entrada.files[0]; entrada.value = ''; if (f) subir(f); };
      var caja = h('textarea', { rows: '6', 'data-pegado': clase, 'aria-label': 'Acta, notas o resumen de ' + clase, placeholder: 'Pega aquí (Ctrl+V) el resumen, el acta o tus notas, o sube el fichero.' });
      caja.value = s.txt;
      caja.oninput = function () { s.txt = caja.value; s.fichero = ''; s.mensaje = null; s.preguntar = null; leida.textContent = ''; refrescar(); };
      var leida = h('span', { class: 'suave', texto: s.fichero ? 'Leída: ' + s.fichero : '' });
      dinamico = h('div', { class: 'dinamico-resumen' });
      refrescar();
      return [h('strong', { texto: 'Subir o pegar para ' + clase }),
        h('div', { class: 'fila' }, [h('button', { type: 'button', class: 'boton chico', 'data-accion': 'subir-acta', texto: 'Subir acta o notas', onclick: function () { entrada.click(); } }), entrada, leida]),
        caja, dinamico];
    }

    /* --- Paso 2: lo que va a Claude --- */
    function pintarLectura() {
      var y = lectura.scrollTop;
      lectura.textContent = '';
      s.trozos.forEach(function (k) {
        if (!k.palabra) { lectura.appendChild(document.createTextNode(k.t)); return; }
        lectura.appendChild(h('button', { type: 'button', class: k.tapado ? 'palabra tapado' : 'palabra', 'data-tapado': k.tapado ? '1' : '0',
          title: k.tapado ? 'Pulsa para destapar: ' + k.t : 'Pulsa para tapar', texto: k.tapado ? '[' + (AC.iniciales(k.t) || 'X.') + ']' : k.t,
          onclick: function () { k.tapado = !k.tapado; pintarLectura(); } }));
      });
      lectura.scrollTop = y;
      var n = Object.keys(RC.armar(s.trozos).marcas).length;
      cuenta.textContent = ' va tapado: ' + n + (n === 1 ? ' nombre' : ' nombres') + '. Un nombre suelto al empezar una frase puede escaparse. Pulsa cualquier palabra para taparla o destaparla.';
    }
    async function enviar() {
      var yo = mio, quien = s;
      quien.ocupado = 'Claude está resumiendo…'; quien.mensaje = null; dibujar();
      try {
        var clave = await g.Claude.claveDe(ctx.est.raiz), r = await RC.resumir(clave, quien.trozos, clase);
        if (s !== quien || yo !== mio) return;
        quien.resumen = r.texto; quien.paso = 3; quien.mensaje = r.aviso ? { texto: r.aviso } : null;
      } catch (x) {
        if (s !== quien || yo !== mio) return;
        quien.mensaje = { texto: x && x.message ? x.message : String(x), error: true, clave: !!(x && x.tipo === 'clave') };
      }
      quien.ocupado = ''; dibujar();
    }
    function zona2() {
      lectura = h('div', { class: 'lectura', 'data-lectura': clase }); cuenta = h('span');
      var nodos = [h('strong', { texto: 'Esto es lo que va a Claude' }),
        h('div', { class: 'aviso' }, ['Léelo antes de enviar. Lo marcado ', h('span', { class: 'leyenda', texto: '[P.R.]' }), cuenta]), lectura];
      if (s.ocupado) nodos.push(h('div', { class: 'suave', role: 'status', texto: s.ocupado }));
      if (s.mensaje) nodos.push(mensaje(s.mensaje.texto, true, s.mensaje.clave ? irAjustes() : null));
      nodos.push(h('div', { class: 'fila' }, [
        boton2({ type: 'button', class: 'boton principal chico', 'data-accion': 'enviar-claude', texto: 'Enviar a Claude (gasta 1 redacción)', onclick: enviar }, !!s.ocupado),
        boton2({ type: 'button', class: 'boton chico', 'data-accion': 'volver-resumen', texto: 'Volver', onclick: function () { s.paso = 1; s.mensaje = null; dibujar(); } }, !!s.ocupado),
        h('button', { type: 'button', class: 'boton chico', 'data-accion': 'cancelar-resumen', texto: 'Cancelar', onclick: cerrar })
      ]));
      pintarLectura();
      return nodos;
    }

    /* --- Paso 3: el resumen de Claude --- */
    function zona3() {
      var caja = h('textarea', { rows: '6', 'data-resumen-claude': clase, 'aria-label': 'Resumen de Claude para ' + clase });
      caja.value = s.resumen; caja.oninput = function () { s.resumen = caja.value; s.preguntar = null; refrescar(); };
      dinamico = h('div', { class: 'dinamico-resumen' });
      refrescar();
      return [h('strong', { texto: 'Resumen de Claude para ' + clase + ': revísalo' }),
        h('p', { class: 'suave', texto: 'Los nombres tapados ya han vuelto a su sitio. Cámbialo aquí lo que quieras. El acta que subiste no se guarda.' }), caja, dinamico];
    }

    function dibujar() {
      if (!s) return;
      tarjeta.textContent = ''; dinamico = null;
      (s.paso === 1 ? zona1() : s.paso === 2 ? zona2() : zona3()).forEach(function (n) { tarjeta.appendChild(n); });
    }
    return { boton: boton, tarjeta: tarjeta };
  }

  g.PantallaResumenCiclo = { crear: crear };
})(window);
