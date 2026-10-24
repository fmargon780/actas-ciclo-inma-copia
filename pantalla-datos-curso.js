/* Tarjeta «Datos del curso» de Ajustes (fila 43): curso, ciclo, localidad, coordinadora y tabla del profesorado. Se guarda en ACTAS/ficha.json
   y el documento de Google la recoge solo. La tabla ocupa todo el ancho; el orden de las filas es el de los asistentes del acta. */
(function (g) {
  'use strict';
  var h = g.Dom.h, F = g.FichaCurso;

  function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  async function tarjeta(est, alGuardar) {
    var colegio = await g.Colegio.leer(est.raiz), datos = F.datosIniciales(await g.Datos.leerFicha(est.raiz), hoyIso(), colegio ? g.Colegio.localidadDeCurso(colegio.cpLocalidad) : '');
    var a = est.alumnado, grupos = a && a.estado === 'ok' && a.lista ? a.lista.grupos.slice() : [];
    var aviso = g.Dom.aviso(), hecho = h('div', { class: 'aviso ok', id: 'datosCursoGuardados', hidden: '' });
    var lista = h('datalist', { id: 'cargosSugeridos' }, F.sugerencias(grupos).map(function (c) { return h('option', { value: c }); }));
    function campo(id, etiqueta, valor) {
      var i = h('input', { type: 'text', id: id, value: valor });
      return { caja: h('label', { class: 'campo' }, [etiqueta, i]), input: i };
    }
    var curso = campo('datoCurso', 'Curso', datos.curso), ciclo = campo('datoCiclo', 'Ciclo', datos.ciclo), localidad = campo('datoLocalidad', 'Localidad', datos.localidad);
    var cCargo = campo('datoCoordinadoraCargo', 'Coordinadora: cargo', datos.coordinadoraCargo), cNombre = campo('datoCoordinadoraNombre', 'Coordinadora: nombre', datos.coordinadoraNombre);
    var filas = datos.filas.length ? datos.filas : [], tabla = h('div', { class: 'tabla-docentes', id: 'tablaDocentes' });

    /* Lo escrito en la tabla se recoge antes de subir, bajar o borrar para no perderlo. */
    function recoger() {
      filas = Array.prototype.map.call(tabla.querySelectorAll('.docente'), function (f) {
        return { cargo: f.querySelector('.docente-cargo').value, nombre: f.querySelector('.docente-nombre').value };
      });
    }
    function pintarTabla(enfocar) {
      tabla.textContent = '';
      filas.forEach(function (f, i) {
        var cargo = h('input', { type: 'text', class: 'docente-cargo', list: 'cargosSugeridos', placeholder: 'Cargo', value: f.cargo, 'aria-label': 'Cargo del docente ' + (i + 1) });
        var nombre = h('input', { type: 'text', class: 'docente-nombre', placeholder: 'Nombre y apellidos', value: f.nombre, 'aria-label': 'Nombre del docente ' + (i + 1) });
        var sube = h('button', { type: 'button', class: 'boton', 'data-accion': 'subir', title: 'Subir', texto: '↑', onclick: function () { recoger(); filas = F.mover(filas, i, -1); pintarTabla(); } });
        var baja = h('button', { type: 'button', class: 'boton', 'data-accion': 'bajar', title: 'Bajar', texto: '↓', onclick: function () { recoger(); filas = F.mover(filas, i, 1); pintarTabla(); } });
        var borra = h('button', { type: 'button', class: 'boton', 'data-accion': 'borrar', title: 'Borrar esta fila', texto: 'Borrar', onclick: function () { recoger(); filas.splice(i, 1); pintarTabla(); } });
        if (i === 0) sube.disabled = true;
        if (i === filas.length - 1) baja.disabled = true;
        tabla.appendChild(h('div', { class: 'docente' }, [cargo, nombre, sube, baja, borra]));
        if (enfocar && i === filas.length - 1) setTimeout(function () { cargo.focus(); }, 0);
      });
    }
    pintarTabla();
    var anadir = h('button', { type: 'button', class: 'boton', id: 'anadirDocente', texto: '+ Añadir docente', onclick: function () { recoger(); filas.push({ cargo: '', nombre: '' }); pintarTabla(true); } });
    var guardar = h('button', { type: 'button', class: 'boton principal', id: 'guardarDatosCurso', texto: 'Guardar datos del curso', onclick: async function () {
      recoger(); hecho.hidden = true;
      try {
        await F.guardar(est.raiz, { curso: curso.input.value, ciclo: ciclo.input.value, localidad: localidad.input.value,
          coordinadoraCargo: cCargo.input.value, coordinadoraNombre: cNombre.input.value, filas: filas });
        g.Dom.decir(aviso, ''); hecho.textContent = 'Datos del curso guardados.'; hecho.hidden = false;
        est.ficha = await g.Datos.leerFicha(est.raiz);
        if (alGuardar) await alGuardar();
      } catch (e) { g.Dom.decir(aviso, e.message || String(e)); }
    } });
    return h('section', { class: 'tarjeta ancha', id: 'tarjetaDatosCurso' }, [
      h('h2', { texto: 'Datos del curso' }),
      h('p', { class: 'suave', texto: 'Se guardan en tu carpeta ACTAS. Las actas nuevas traen como asistentes al profesorado de esta tabla, en este orden, y el documento de Google Docs los recoge solo.' }),
      h('div', { class: 'cuatro' }, [curso.caja, ciclo.caja, localidad.caja]),
      h('div', { class: 'cuatro' }, [cCargo.caja, cNombre.caja]),
      h('h3', { texto: 'Profesorado ' }, [g.Ayuda.aviso('tabla-profesorado')]), lista, tabla,
      h('div', { class: 'fila' }, [anadir, guardar]), hecho, aviso
    ]);
  }

  g.PantallaDatosCurso = { tarjeta: tarjeta };
})(window);
