/* El buscador de alumnado («+ Alumno» y «Cambiar alumno»): escribes y eliges de la lista; si no está, «Usar «lo escrito» igualmente» con un grupo.
   `lista()` da el estado de est.alumnado; `elegido(alumno)` recibe { nombre, grupo, enLista }; `cerrar()` lo cierra sin elegir. */
(function (g) {
  'use strict';
  var h = g.Dom.h, A = g.Alumnado;
  var MAXIMO = 8;

  function crear(inicial, lista, elegido, cerrar) {
    var estado = lista() || {}, datos = estado.lista;
    var campo = h('input', { type: 'text', class: 'buscar-alumno', 'data-buscador': 'campo', placeholder: 'Escribe el nombre o un apellido', value: inicial || '', autocomplete: 'off' });
    var resultados = h('div', { class: 'resultados', 'data-buscador': 'resultados' });
    var caja = h('div', { class: 'buscador-alumno', 'data-buscador': 'caja' }, [
      campo, resultados,
      h('button', { type: 'button', class: 'boton chico', 'data-accion': 'cerrar-buscador', texto: 'Cancelar', onclick: cerrar })
    ]);

    function pintar() {
      resultados.textContent = '';
      var texto = campo.value.trim();
      if (!datos) { resultados.appendChild(h('p', { class: 'suave', texto: 'No hay lista de alumnado: abre la carpeta RÚBRICAS.' })); return; }
      if (Array.from(A.normalizar(texto)).length < 3) { resultados.appendChild(h('p', { class: 'suave', texto: 'Escribe al menos 3 letras.' })); return; }
      var encontrados = A.sugerir(datos.delCiclo, texto, MAXIMO);
      encontrados.forEach(function (a) {
        resultados.appendChild(h('button', { type: 'button', class: 'sugerencia', 'data-alumno': a.nombre, texto: A.etiqueta(a),
          onclick: function () { elegido({ nombre: a.nombre, grupo: a.grupo, enLista: true }); } }));
      });
      if (encontrados.length) return;
      var grupo = h('select', { class: 'grupo-fuera', 'data-buscador': 'grupo' }, [h('option', { value: '', texto: 'Sin grupo' })].concat(datos.grupos.map(function (n) { return h('option', { value: n, texto: n }); })));
      resultados.appendChild(h('div', { class: 'fuera-de-lista' }, [
        h('button', { type: 'button', class: 'boton chico', 'data-accion': 'usar-igualmente', texto: 'Usar «' + texto + '» igualmente',
          onclick: function () { elegido({ nombre: texto, grupo: grupo.value, enLista: false }); } }),
        grupo
      ]));
    }
    campo.oninput = pintar;
    campo.onkeydown = function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); cerrar(); } };
    pintar();
    return { elemento: caja, enfocar: function () { campo.focus(); campo.select(); } };
  }

  g.BuscadorAlumno = { crear: crear };
})(window);
