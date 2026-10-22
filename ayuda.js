/* Ayuda (fila 44): los textos de pagina/ayuda.json, los avisos «i», qué pasos de «Primeros pasos» están hechos y si la guía se cerró.
   Los pasos se calculan mirando el estado real (carpeta, alumnado, ficha, clave, actas), nunca porque se pulse «Ir». */
(function (g) {
  'use strict';
  var CLAVE_LOCAL = 'actas.guiaCerrada', FICHERO = 'ayuda.json';

  /* Carga los textos. En la copia sin internet (file:) fetch no puede leer ficheros: ahí valen los de window.AYUDA_DATOS (ayuda-datos.js). */
  async function cargar() {
    if (g.Ayuda.datos) return g.Ayuda.datos;
    var d = null;
    try { var r = await fetch('ayuda.json'); if (r.ok) d = await r.json(); } catch (e) { d = null; }
    if (!d && g.AYUDA_DATOS) d = g.AYUDA_DATOS;
    if (!d && typeof document !== 'undefined' && g.location && g.location.protocol === 'file:') {
      await new Promise(function (ok) { var s = document.createElement('script'); s.src = 'ayuda-datos.js'; s.onload = s.onerror = ok; document.head.appendChild(s); });
      d = g.AYUDA_DATOS || null;
    }
    g.Ayuda.datos = d;
    return d;
  }

  function hoyIso() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  /* [carpeta, alumnado, datos del curso, clave, primera acta] -> true/false. Sin carpeta (est nulo) solo puede faltar todo. */
  async function pasosHechos(est) {
    var r = [!!est, false, false, false, false];
    if (!est) return r;
    try { var a = est.alumnado && est.alumnado.estado ? est.alumnado : await g.Rubricas.cargar(est); r[1] = a.estado === 'ok'; } catch (e) { r[1] = false; }
    try { r[2] = !g.FichaCurso.problema(g.FichaCurso.datosIniciales(await g.Datos.leerFicha(est.raiz), hoyIso())); } catch (e) { r[2] = false; }
    try { r[3] = !!(await g.Datos.leerClave(est.raiz)); } catch (e) { r[3] = false; }
    try { r[4] = (await g.Datos.listarBorradores(est.raiz)).length > 0 || (await g.Envios.listar(est.raiz)).length > 0; } catch (e) { r[4] = false; }
    return r;
  }

  /* «Cerrar la guía» se recuerda en la carpeta ACTAS (vale en todos los equipos); antes de elegir carpeta, en el navegador. */
  async function guiaCerrada(est) {
    if (est) { try { var f = await est.raiz.leerJSON(FICHERO); return !!(f && f.guiaCerrada); } catch (e) { return false; } }
    try { return g.localStorage.getItem(CLAVE_LOCAL) === '1'; } catch (e) { return false; }
  }
  async function cerrarGuia(est) {
    if (est) { try { await est.raiz.escribirJSON(FICHERO, { formato: 1, guiaCerrada: true, cerrada: new Date().toISOString() }); } catch (e) { /* si no se puede escribir, vuelve a salir otro día */ } return; }
    try { g.localStorage.setItem(CLAVE_LOCAL, '1'); } catch (e) { /* sin almacenamiento del navegador */ }
  }

  /* El id de la sección de ayuda de una pantalla (est.paso); lo desconocido cae en «Primeros pasos». */
  function seccionDe(paso) {
    var d = g.Ayuda.datos;
    var hay = d && d.pantallas.some(function (p) { return p.id === paso; });
    return hay ? paso : 'primeros-pasos';
  }

  /* Un texto con direcciones https:// -> nodos (las direcciones son enlaces que abren pestaña nueva). */
  function nodosDeTexto(texto) {
    return String(texto).split(/(https?:\/\/[^\s)»]+)/).map(function (t, i) {
      if (i % 2 === 0) return document.createTextNode(t);
      var a = document.createElement('a'); a.href = t; a.target = '_blank'; a.rel = 'noopener'; a.textContent = t; return a;
    });
  }

  var escuchando = false;
  function cerrarBurbujas(salvo) {
    Array.prototype.forEach.call(document.querySelectorAll('.info-caja.abierta'), function (c) { if (c !== salvo) c.classList.remove('abierta'); });
  }

  /* El círculo «i» con su burbuja. Devuelve null si los textos no se cargaron: la pantalla sigue igual, sin «i». */
  function aviso(id) {
    var d = g.Ayuda.datos, texto = d && d.avisos && d.avisos[id];
    if (!texto) return null;
    if (!escuchando) {
      escuchando = true;
      document.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('.info-caja'); cerrarBurbujas(c); });
    }
    var burbuja = document.createElement('span'); burbuja.className = 'burbuja'; burbuja.setAttribute('role', 'tooltip');
    nodosDeTexto(texto).forEach(function (n) { burbuja.appendChild(n); });
    var boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'info'; boton.textContent = 'i'; boton.setAttribute('aria-label', 'Más información'); boton.setAttribute('data-aviso', id);
    var caja = document.createElement('span'); caja.className = 'info-caja';
    boton.onclick = function () { caja.classList.toggle('abierta'); };
    caja.appendChild(boton); caja.appendChild(burbuja);
    return caja;
  }

  g.Ayuda = { datos: null, cargar: cargar, pasosHechos: pasosHechos, guiaCerrada: guiaCerrada, cerrarGuia: cerrarGuia, seccionDe: seccionDe, nodosDeTexto: nodosDeTexto, aviso: aviso };
})(typeof window !== 'undefined' ? window : globalThis);
