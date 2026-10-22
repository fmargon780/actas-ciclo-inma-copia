/* Redacción de los puntos: en qué estado está cada párrafo, qué se le manda a Claude y qué hay que preguntar.
   Sin pantalla ni carpeta ni red: se prueba con node --test.
   Cada punto del borrador puede llevar: parrafo (el texto), notasRedactadas (las notas con las que se escribió) y
   manual (Inma ha escrito encima). */
(function (g) {
  'use strict';
  var TEXTO_PENDIENTE = 'Escribe aquí lo tratado.';

  function fijo(p) { return g.Borradores.esPuntoAnterior(p.titulo); }
  function hayNotas(p) { return String(p.notas || '').trim() !== ''; }
  function hayParrafo(p) { return String(p.parrafo || '').trim() !== ''; }

  /* 'fijo' | 'sinNotas' | 'sinRedactar' | 'cambiadas' | 'redactado' */
  function estadoPunto(p) {
    if (fijo(p)) return 'fijo';
    if (!hayParrafo(p)) return hayNotas(p) ? 'sinRedactar' : 'sinNotas';
    if (String(p.notasRedactadas == null ? p.notas : p.notasRedactadas) !== String(p.notas || '')) return 'cambiadas';
    return 'redactado';
  }

  /* Los puntos que «Redactar con Claude» (el de toda el acta) tiene que escribir: sin párrafo o con notas cambiadas. */
  function indicesPorRedactar(b) {
    var l = [];
    b.puntos.forEach(function (p, i) {
      var e = estadoPunto(p);
      if (e === 'sinRedactar' || (e === 'cambiadas' && hayNotas(p))) l.push(i);
    });
    return l;
  }

  /* ¿Hay que preguntar antes de sustituir el párrafo de este punto? Solo si Inma lo cambió a mano. */
  function hayQuePreguntar(p) { return !!p.manual && hayParrafo(p); }

  /* Lo único que sale hacia Claude: el número de punto, su título y sus notas, con el alumnado solo en iniciales («[M.S.P.]»).
     todos: todo el alumnado de Rúbricas (para la red de seguridad) o null. Devuelve { puntos, marcas, notasMarcadas, avisos } (ver alumnado-claude.js). */
  function prepararPeticion(b, indices, todos) {
    var crudos = indices.map(function (i) {
      return { n: i + 1, titulo: String(b.puntos[i].titulo || '').trim(), notas: String(b.puntos[i].notas || '').trim() };
    });
    return g.AlumnadoClaude.preparar(crudos, todos);
  }
  function peticion(b, indices, todos) { return prepararPeticion(b, indices, todos).puntos; }

  function ponerParrafo(p, texto) {
    p.parrafo = String(texto || '').trim();
    p.notasRedactadas = String(p.notas || '');
    p.manual = false;
    return p;
  }

  /* Inma escribe encima. Si borra todo el párrafo, el punto vuelve a no tener texto. */
  function editarParrafo(p, texto) {
    p.parrafo = String(texto || '');
    if (p.notasRedactadas == null) p.notasRedactadas = String(p.notas || '');
    p.manual = hayParrafo(p);
    if (!hayParrafo(p)) { p.parrafo = ''; p.notasRedactadas = undefined; p.manual = false; }
    return p;
  }

  /* Notas vacías y «Redactar de nuevo»: el párrafo se quita (no hay nada que mandar a Claude). */
  function quitarParrafo(p) { p.parrafo = ''; p.notasRedactadas = undefined; p.manual = false; return p; }

  /* Para «Crear acta»: '' si se puede, o el motivo en una frase. */
  function motivoQueImpide(b) {
    var cambiados = [];
    b.puntos.forEach(function (p, i) { if (estadoPunto(p) === 'cambiadas') cambiados.push(i + 1); });
    if (cambiados.length === 1) return 'Las notas del punto ' + cambiados[0] + ' han cambiado: redáctalo de nuevo antes de crear el acta.';
    if (cambiados.length) return 'Las notas de los puntos ' + cambiados.join(', ') + ' han cambiado: redáctalos de nuevo antes de crear el acta.';
    if (!b.fecha) return 'Falta la fecha de la reunión.';
    if (!/^\d{1,2}:\d{2}$/.test(String(b.inicio || '')) || !/^\d{1,2}:\d{2}$/.test(String(b.fin || ''))) return 'Faltan las horas de inicio y de fin.';
    if (!b.puntos.length) return 'Escribe al menos un punto del orden del día.';
    if (!b.asistentes || !b.asistentes.length) return 'Marca al menos una persona del profesorado.';
    return '';
  }

  /* El texto de la respuesta de Claude -> { n: párrafo }. Lanza si no es el JSON pedido. */
  function leerRespuesta(texto, indices) {
    var t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var ini = t.indexOf('{'), fin = t.lastIndexOf('}');
    if (ini < 0 || fin < ini) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    var o = JSON.parse(t.slice(ini, fin + 1));
    if (!o || !Array.isArray(o.puntos)) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    var res = {};
    o.puntos.forEach(function (x) {
      if (x && Number.isInteger(x.n) && typeof x.parrafo === 'string' && x.parrafo.trim()) res[x.n] = x.parrafo.trim();
    });
    indices.forEach(function (i) {
      if (!res[i + 1]) throw new Error('A la respuesta de Claude le falta el punto ' + (i + 1) + '.');
    });
    return res;
  }

  /* Los alumnos del punto (los de sus notas y los ya guardados en el borrador), sin repetir: [{ nombre, grupo, enLista }]. Con esto
     las fichas del alumnado saben de quién se habló aunque el párrafo no lleve el nombre. */
  function alumnadoDe(p) {
    var A = g.Alumnado, vistos = {}, res = [];
    if (!A) return res;
    (A.alumnosCitados(p.notas).concat(p.alumnado || [])).forEach(function (x) {
      if (!x || !String(x.nombre || '').trim()) return;
      var k = A.normalizar(x.nombre) + '|' + A.normalizar(x.grupo);
      if (!vistos[k]) { vistos[k] = 1; res.push({ nombre: String(x.nombre).trim(), grupo: String(x.grupo || ''), enLista: x.enLista !== false }); }
    });
    return res;
  }

  /* El acta terminada, tal como la recoge el documento (ACTAS/para-el-documento/<id>.json).
     fechaActaAnterior: fecha aaaa-mm-dd de la última acta (o null); se fija aquí, al enviar. */
  function armarEnvio(b, fechaActaAnteriorIso, ahora) {
    return {
      formato: 1, id: b.id, tipo: 'ciclo', enviado: ahora.toISOString(),
      fecha: b.fecha, horaInicio: b.inicio, horaFin: b.fin, evaluacion: b.evaluacion,
      asistentes: b.asistentes.slice(), fechaActaAnterior: fechaActaAnteriorIso || null,
      puntos: b.puntos.map(function (p) {
        if (fijo(p)) return { titulo: String(p.titulo).trim(), parrafo: null, fijo: true };
        return { titulo: String(p.titulo || '').trim(), parrafo: hayParrafo(p) ? String(p.parrafo).trim() : '', alumnado: alumnadoDe(p) };
      }).filter(function (p) { return p.titulo; })
    };
  }

  /* La fecha más reciente (aaaa-mm-dd) entre la última acta del documento (dd/mm/aaaa) y las que esperan en el documento. */
  function fechaActaAnterior(ultimaActaCorta, esperando) {
    var l = (esperando || []).filter(Boolean);
    if (ultimaActaCorta) { try { l.push(g.fechaDesdeCorta(ultimaActaCorta)); } catch (e) { /* fecha rara: se ignora */ } }
    l.sort();
    return l.length ? l[l.length - 1] : null;
  }

  g.Redaccion = {
    TEXTO_PENDIENTE: TEXTO_PENDIENTE, estadoPunto: estadoPunto, indicesPorRedactar: indicesPorRedactar, hayQuePreguntar: hayQuePreguntar,
    peticion: peticion, prepararPeticion: prepararPeticion, ponerParrafo: ponerParrafo, editarParrafo: editarParrafo, quitarParrafo: quitarParrafo,
    motivoQueImpide: motivoQueImpide, leerRespuesta: leerRespuesta, armarEnvio: armarEnvio, fechaActaAnterior: fechaActaAnterior
  };
})(typeof window !== 'undefined' ? window : globalThis);
