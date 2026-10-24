/* Estilo de redacción (tema 58, fila 63): cómo quiere el docente los textos que redacta Claude. Un solo estilo para todo.
   Se guarda en ACTAS/estilo.json: { formato, extension: escueto|normal|desarrollado, lenguaje: sencillo|normal|tecnico, instrucciones }.
   `paraClaude` devuelve las líneas que se añaden al final de las instrucciones de cada redacción ('' si todo está en «normal» y la caja vacía),
   con la caja de instrucciones propias pasada por el filtro de nombres: a Claude solo llegan iniciales. Sin pantalla ni red. */
(function (g) {
  'use strict';
  var EXTENSIONES = [['escueto', 'Escueto'], ['normal', 'Normal'], ['desarrollado', 'Desarrollado']];
  var LENGUAJES = [['sencillo', 'Sencillo'], ['normal', 'Normal'], ['tecnico', 'Técnico']];
  var MAX_INSTRUCCIONES = 600;

  var FRASE_EXTENSION = {
    escueto: 'Extensión: escueta. Lo esencial, con frases cortas y sin fórmulas de relleno.',
    desarrollado: 'Extensión: desarrollada. Da más contexto y usa frases completas, sin inventar nada que no esté en las notas.'
  };
  var FRASE_LENGUAJE = {
    sencillo: 'Lenguaje: sencillo. Palabras corrientes, sin tecnicismos.',
    tecnico: 'Lenguaje: técnico. Usa el vocabulario propio de la normativa educativa andaluza.'
  };
  var SIEMPRE = 'Con este estilo, sigue igual: no inventes datos, copia las marcas de alumnado tal cual, respeta los límites de caracteres que se hayan indicado y contesta con la misma forma (JSON) que se pidió.';

  function normal() { return { formato: 1, extension: 'normal', lenguaje: 'normal', instrucciones: '' }; }
  function valida(lista, v, porDefecto) { return lista.some(function (x) { return x[0] === v; }) ? v : porDefecto; }
  function limpiar(e) {
    e = e || {};
    return { formato: 1, extension: valida(EXTENSIONES, e.extension, 'normal'), lenguaje: valida(LENGUAJES, e.lenguaje, 'normal'), instrucciones: String(e.instrucciones || '').trim().slice(0, MAX_INSTRUCCIONES) };
  }
  function esNormal(e) { e = limpiar(e); return e.extension === 'normal' && e.lenguaje === 'normal' && !e.instrucciones; }

  async function leer(raiz) {
    try { return limpiar(await raiz.leerJSON('estilo.json')); } catch (x) { return normal(); }
  }
  async function guardar(raiz, e) { var l = limpiar(e); await raiz.escribirJSON('estilo.json', l); return l; }

  /* Las líneas para Claude. `todos`: el alumnado de Rúbricas (o null) para taparle los nombres a la caja de instrucciones propias. */
  function instrucciones(e, todos) {
    e = limpiar(e);
    if (esNormal(e)) return '';
    var l = ['Estilo de redacción que pide el docente (vale para todo lo que redactes):'];
    if (FRASE_EXTENSION[e.extension]) l.push(FRASE_EXTENSION[e.extension]);
    if (FRASE_LENGUAJE[e.lenguaje]) l.push(FRASE_LENGUAJE[e.lenguaje]);
    if (e.instrucciones) {
      var t = g.Anonimizar ? g.Anonimizar.crear(todos || []).texto(e.instrucciones) : e.instrucciones;
      l.push('Instrucciones propias del docente: ' + t);
    }
    l.push(SIEMPRE);
    return l.join('\n');
  }
  async function paraClaude(raiz, todos) { return instrucciones(await leer(raiz), todos); }

  g.Estilo = { EXTENSIONES: EXTENSIONES, LENGUAJES: LENGUAJES, MAX_INSTRUCCIONES: MAX_INSTRUCCIONES, normal: normal, limpiar: limpiar, esNormal: esNormal, leer: leer, guardar: guardar, instrucciones: instrucciones, paraClaude: paraClaude };
})(typeof window !== 'undefined' ? window : globalThis);
