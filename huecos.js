/* Los huecos de un punto del acta (fila 18): cajas cortas con título (por ejemplo «Propuestas», «Fechas», «Responsables») que se rellenan
   además de las notas libres. Sin pantalla: se prueba con node --test.
   En el punto del borrador: huecos: [{ titulo, notas }] (los de todo el punto) y, en las sesiones de evaluación, porGrupo: [títulos] con
   grupos: [{ nombre, huecos: [{ titulo, notas }] }] (un bloque por grupo, se arma cuando se conoce la lista de grupos de Rúbricas).
   Un punto sin `huecos` ni `grupos` (borrador antiguo) se comporta como siempre. Lo que Inma cambia vale solo para esa acta. */
(function (g) {
  'use strict';

  function limpio(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }
  function hueco(titulo) { return { titulo: limpio(titulo), notas: '' }; }
  function copia(l) { return (l || []).map(function (x) { return { titulo: limpio(x.titulo), notas: String(x.notas || '') }; }); }
  function rellena(x) { return String(x.notas || '').trim() !== ''; }

  /* Un punto de la convocatoria ({ titulo, huecos, porGrupo? }) -> los campos de hueco del punto del borrador. */
  function deConvocatoria(punto, cp) {
    var huecos = (cp && cp.huecos || []).map(limpio).filter(Boolean), grupo = (cp && cp.porGrupo || []).map(limpio).filter(Boolean);
    if (huecos.length) punto.huecos = huecos.map(hueco);
    if (grupo.length) punto.porGrupo = grupo;
    return punto;
  }

  /* Los bloques por grupo, una sola vez por punto: cuando se conoce la lista de grupos. Devuelve si cambió algo. */
  function completarGrupos(b, nombres) {
    var cambiado = false, lista = (nombres || []).map(limpio).filter(Boolean);
    if (!lista.length) return false;
    b.puntos.forEach(function (p) {
      if (p.porGrupo && p.porGrupo.length && !Array.isArray(p.grupos)) {
        p.grupos = lista.map(function (n) { return { nombre: n, huecos: p.porGrupo.map(hueco) }; });
        cambiado = true;
      }
    });
    return cambiado;
  }

  /* Todas las cajas del punto en orden: [{ hueco, grupo (nombre del grupo o null) }]. */
  function cajas(p) {
    var l = [];
    (p.huecos || []).forEach(function (x) { l.push({ hueco: x, grupo: null }); });
    (p.grupos || []).forEach(function (gr) { (gr.huecos || []).forEach(function (x) { l.push({ hueco: x, grupo: gr.nombre }); }); });
    return l;
  }

  function tiene(p) { return !!((p.huecos && p.huecos.length) || (p.grupos && p.grupos.length) || (p.porGrupo && p.porGrupo.length)); }
  function hayTexto(p) { return cajas(p).some(function (c) { return rellena(c.hueco); }); }

  /* Para saber si lo escrito cambió desde que se redactó: '' si el punto no tiene huecos (así un borrador antiguo no cambia). */
  function firma(p) {
    if (!tiene(p)) return '';
    return cajas(p).filter(function (c) { return rellena(c.hueco); }).map(function (c) { return (c.grupo || '') + '\u0002' + c.hueco.titulo + '\u0002' + c.hueco.notas; }).join('\u0003');
  }

  function anadir(lista, titulo) { var t = limpio(titulo); if (!t) return null; var x = hueco(t); lista.push(x); return x; }
  function quitar(lista, i) { lista.splice(i, 1); return lista; }

  /* Lo que se guarda en el borrador. */
  function paraGuardar(p, o) {
    if (p.huecos && p.huecos.length) o.huecos = copia(p.huecos);
    if (p.porGrupo && p.porGrupo.length) o.porGrupo = p.porGrupo.slice();
    if (Array.isArray(p.grupos)) o.grupos = p.grupos.map(function (gr) { return { nombre: limpio(gr.nombre), huecos: copia(gr.huecos) }; });
    return o;
  }

  /* Los títulos de los huecos de todo el punto con algo escrito (para «Lo habitual»). */
  function titulosRellenos(p) { return (p.huecos || []).filter(rellena).map(function (x) { return x.titulo; }); }

  g.Huecos = { deConvocatoria: deConvocatoria, completarGrupos: completarGrupos, cajas: cajas, tiene: tiene, hayTexto: hayTexto, firma: firma,
    anadir: anadir, quitar: quitar, paraGuardar: paraGuardar, titulosRellenos: titulosRellenos, rellena: rellena };
})(typeof window !== 'undefined' ? window : globalThis);
