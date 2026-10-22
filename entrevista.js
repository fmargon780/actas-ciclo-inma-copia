/* La entrevista con la familia (fila 40), la parte que calcula: los compromisos que salen del texto final, el texto listo para pegar en Séneca
   y qué cajas de notas hay que mandar a Claude. Sin pantalla ni red: se prueba con node --test. */
(function (g) {
  'use strict';
  var A = g.Alumnado;
  var LARGO_CORTO = 110;
  var RE_TUTORA = /^\s*compromisos\s+de\s+la\s+tutora\s*:?\s*/i;
  var RE_FAMILIA = /^\s*compromisos\s+de\s+la\s+familia\s*:?\s*/i;

  function parrafos(texto) { return String(texto || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }

  /* La etiqueta antes de los dos puntos o, si no la hay, la primera frase (acortada si es muy larga). */
  function textoCorto(parrafo) {
    var t = String(parrafo).trim(), m = /^([^:.]{2,80}):\s/.exec(t);
    var corto = m ? m[1].trim() : (/^[^.!?]*[.!?]?/.exec(t)[0] || t).trim().replace(/[.!?]$/, '');
    if (corto.length > LARGO_CORTO) corto = corto.slice(0, LARGO_CORTO).replace(/\s+\S*$/, '') + '…';
    return corto;
  }

  /* Los compromisos del texto de «Decisiones y acuerdos»: cada párrafo bajo «Compromisos de la tutora:» o «Compromisos de la familia:».
     Un párrafo final sin etiqueta sigue en el último grupo (la familia en el ejemplo). Lo anterior al primer rótulo no es compromiso.
     `anteriores` (la lista de antes) conserva la casilla de los que siguen igual: [{ quien, texto, hecho }]. Uno nuevo nace sin marcar. */
  function sacarCompromisos(texto, anteriores) {
    var quien = '', res = [];
    parrafos(texto).forEach(function (p) {
      var resto = p;
      if (RE_TUTORA.test(p)) { quien = 'tutora'; resto = p.replace(RE_TUTORA, '').trim(); }
      else if (RE_FAMILIA.test(p)) { quien = 'familia'; resto = p.replace(RE_FAMILIA, '').trim(); }
      if (!quien || !resto) return;
      res.push({ quien: quien, texto: textoCorto(resto), hecho: false });
    });
    var libres = (anteriores || []).slice();
    res.forEach(function (c) {
      for (var i = 0; i < libres.length; i++) {
        if (libres[i].quien === c.quien && A.normalizar(libres[i].texto) === A.normalizar(c.texto)) { c.hecho = !!libres[i].hecho; libres.splice(i, 1); break; }
      }
    });
    return res;
  }

  /* Texto plano para el formulario de Séneca: párrafos separados por una línea en blanco, sin viñetas, negritas ni títulos de formato. */
  function textoParaSeneca(texto) {
    return String(texto == null ? '' : texto).replace(/\r/g, '').replace(/ /g, ' ').split('\n').map(function (l) {
      return l.replace(/^\s*(?:[•·▪●◦*\-–—]|\d+[.)])\s+/, '').replace(/^#+\s+/, '').replace(/\*\*|__/g, '').replace(/[ \t]+/g, ' ').trim();
    }).filter(Boolean).join('\n\n');
  }

  /* ¿Hay algo escrito en las notas de cada caja? */
  function cajasConNotas(notas) {
    var n = notas || {}, lleno = function (t) { return !!String(t || '').trim(); };
    return { temas: lleno(n.temas), decisiones: lleno(n.tutora) || lleno(n.familia), otros: lleno(n.otros) };
  }
  function hayNotas(notas) { var c = cajasConNotas(notas); return c.temas || c.decisiones || c.otros; }
  /* Las notas como una sola cadena: sirve para saber si cambiaron desde la última redacción. */
  function firmaNotas(notas) { var n = notas || {}; return JSON.stringify([n.temas || '', n.tutora || '', n.familia || '', n.otros || '']); }
  function hayTextos(textos) { var t = textos || {}; return !!(String(t.temas || '').trim() || String(t.decisiones || '').trim() || String(t.otros || '').trim()); }

  /* Pone los textos redactados y vuelve a sacar los compromisos (conservando las casillas). */
  function ponerTextos(e, textos) {
    ['temas', 'decisiones', 'otros'].forEach(function (k) { if (textos[k] != null) e.textos[k] = String(textos[k]); });
    e.compromisos = sacarCompromisos(e.textos.decisiones, e.compromisos);
  }
  /* Inma escribe encima de un texto: se vuelven a sacar los compromisos si era el de decisiones. */
  function editarTexto(e, clave, valor) {
    e.textos[clave] = valor;
    if (clave === 'decisiones') e.compromisos = sacarCompromisos(valor, e.compromisos);
  }

  g.Entrevista = {
    textoCorto: textoCorto, sacarCompromisos: sacarCompromisos, textoParaSeneca: textoParaSeneca, cajasConNotas: cajasConNotas, hayNotas: hayNotas,
    firmaNotas: firmaNotas, hayTextos: hayTextos, ponerTextos: ponerTextos, editarTexto: editarTexto
  };
})(typeof window !== 'undefined' ? window : globalThis);
