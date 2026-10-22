/* Aprender «lo habitual» de las actas antiguas con Claude (fila 17). A Claude no llega ningún nombre completo: antes de mandar nada, cada acta
   pasa por anonimizar.js. Sin lista de alumnado (Rúbricas) no se manda el texto de los puntos, solo los títulos. Sin pantalla ni red real:
   la llamada entra por parámetro (`opciones.buscar`) y se prueba con node --test. Usa claude.js, anonimizar.js y habitual.js. */
(function (g) {
  'use strict';
  var POR_PETICION = 4;
  var INSTRUCCIONES = [
    'Ayudas a una maestra coordinadora de ciclo de un colegio público de Primaria de Andalucía (España) a preparar las convocatorias de sus reuniones.',
    'Recibes una lista JSON de actas pasadas: cada una con n (número), mes y puntos del orden del día (p, titulo y, a veces, texto abreviado).',
    'Para cada punto devuelve cómo se escribiría en una convocatoria de cualquier año y qué huecos suele tener para rellenar.',
    'Reglas:',
    '- titulo: versión general del punto, sin fechas, años, nombres de personas ni nombres de efemérides o actividades concretas. Ejemplo: «Planificación de actividades complementarias: Constitución, Día de la Lectura y Flamenco» -> «Planificación de actividades complementarias del mes».',
    '- huecos: de 0 a 4 frases cortas (3-6 palabras) con lo que suele rellenarse en ese punto, por ejemplo «Qué se ha trabajado», «Dificultades encontradas», «Acuerdos». Si el punto es solo informativo o no se sabe, una lista vacía.',
    '- Los nombres de personas aparecen ya como iniciales entre corchetes, por ejemplo [M.S.P.]. No las copies ni las uses.',
    '- Devuelve un elemento por cada punto recibido, con los mismos n y p, sin añadir ni quitar ninguno.',
    'Responde SOLO con un JSON, sin nada más, con esta forma exacta: {"actas":[{"n":1,"puntos":[{"p":1,"titulo":"…","huecos":["…"]}]}]}'
  ].join('\n');

  /* actas: [{ fecha, puntos: [{ titulo, texto }] }] -> la parte que viaja a Claude (anonimizada). */
  function paraClaude(actas, anon, conTexto) {
    return actas.map(function (a, i) {
      return { n: i + 1, mes: g.Habitual.nombreMes(g.Habitual.mesDe(a.fecha)), puntos: a.puntos.map(function (p, k) {
        var o = { p: k + 1, titulo: anon.texto(p.titulo, true) };
        if (conTexto && p.texto) o.texto = anon.texto(p.texto, false);
        return o;
      }) };
    });
  }

  function cuerpo(enviar) {
    return { model: g.Claude.MODELO, max_tokens: 8000, system: INSTRUCCIONES, messages: [{ role: 'user', content: JSON.stringify({ actas: enviar }) }] };
  }

  /* Lee la respuesta: { 'n|p': { titulo, huecos } }. Lanza si no tiene el formato pedido. */
  function leerRespuesta(texto) {
    var t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var ini = t.indexOf('{'), fin = t.lastIndexOf('}');
    if (ini < 0 || fin < ini) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    var o = JSON.parse(t.slice(ini, fin + 1)), res = {};
    if (!o || !Array.isArray(o.actas)) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    o.actas.forEach(function (a) {
      ((a && a.puntos) || []).forEach(function (p) {
        if (p && Number.isInteger(a.n) && Number.isInteger(p.p) && typeof p.titulo === 'string' && p.titulo.trim()) {
          res[a.n + '|' + p.p] = { titulo: p.titulo.trim(), huecos: Array.isArray(p.huecos) ? p.huecos.filter(function (x) { return typeof x === 'string'; }) : [] };
        }
      });
    });
    return res;
  }

  /* Pide a Claude el orden del día general de cada acta. Devuelve [{ fecha, puntos: [{ titulo, huecos }] }].
     todos: todo el alumnado de Rúbricas (o null: entonces solo viajan los títulos). opciones.buscar: para las pruebas; opciones.progreso(hechas, total). */
  async function aprenderDe(clave, actas, todos, opciones) {
    opciones = opciones || {};
    if (!clave) { var e = new Error(g.Claude.FRASE_SIN_CLAVE); e.tipo = 'clave'; throw e; }
    var anon = g.Anonimizar.crear(todos), conTexto = !!(todos && todos.length), res = [];
    for (var d = 0; d < actas.length; d += POR_PETICION) {
      var lote = actas.slice(d, d + POR_PETICION), enviar = paraClaude(lote, anon, conTexto), hallado = null, ultimo = null;
      for (var intento = 0; intento < 2 && !hallado; intento++) {
        var texto = await g.Claude.llamar(clave, cuerpo(enviar), opciones.buscar);
        try { hallado = leerRespuesta(texto); } catch (err) { ultimo = err; }
      }
      if (!hallado) { var f = new Error('Claude ha contestado algo que no he podido leer. Vuelve a intentarlo.'); f.tipo = 'formato'; f.detalle = ultimo; throw f; }
      lote.forEach(function (a, i) {
        res.push({ fecha: a.fecha, puntos: enviar[i].puntos.map(function (p) {
          var r = hallado[(i + 1) + '|' + p.p];
          /* Si Claude se salta un punto, vale el título que se le mandó (ya sin nombres) y sin huecos. */
          return r ? { titulo: anon.texto(r.titulo, true), huecos: r.huecos.map(function (x) { return anon.texto(x, false); }) } : { titulo: p.titulo, huecos: [] };
        }) });
      });
      if (opciones.progreso) opciones.progreso(Math.min(d + POR_PETICION, actas.length), actas.length);
    }
    return res;
  }

  g.HabitualClaude = { INSTRUCCIONES: INSTRUCCIONES, paraClaude: paraClaude, cuerpo: cuerpo, leerRespuesta: leerRespuesta, aprenderDe: aprenderDe };
})(typeof window !== 'undefined' ? window : globalThis);
