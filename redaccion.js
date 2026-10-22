/* Redacción de los puntos: en qué estado está cada párrafo, qué se le manda a Claude y qué hay que preguntar.
   Sin pantalla ni carpeta ni red: se prueba con node --test.
   Cada punto del borrador puede llevar: parrafo (el texto), notasRedactadas (las notas con las que se escribió) y
   manual (Inma ha escrito encima). */
(function (g) {
  'use strict';
  var TEXTO_PENDIENTE = 'Escribe aquí lo tratado.';

  function fijo(p) { return g.Borradores.esPuntoAnterior(p.titulo); }
  function hayNotas(p) { return String(p.notas || '').trim() !== '' || (g.Huecos ? g.Huecos.hayTexto(p) : false); }
  /* Lo escrito en el punto (notas y huecos) como un solo texto: con él se sabe si cambió desde que se redactó. Sin huecos es solo las notas. */
  function contenido(p) { var f = g.Huecos ? g.Huecos.firma(p) : ''; return String(p.notas || '') + (f ? '\u0001' + f : ''); }
  function hayParrafo(p) { return String(p.parrafo || '').trim() !== ''; }

  /* 'fijo' | 'sinNotas' | 'sinRedactar' | 'cambiadas' | 'redactado' */
  function estadoPunto(p) {
    if (fijo(p)) return 'fijo';
    if (!hayParrafo(p)) return hayNotas(p) ? 'sinRedactar' : 'sinNotas';
    if (String(p.notasRedactadas == null ? contenido(p) : p.notasRedactadas) !== contenido(p)) return 'cambiadas';
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

  /* Lo escrito en el punto tal como lo ve Inma en la revisión: las notas y, debajo, cada hueco con algo escrito («Título: texto»). */
  function verContenido(p) {
    var A = g.Alumnado, l = [];
    if (String(p.notas || '').trim()) l.push(A.aVisible(p.notas));
    if (g.Huecos) g.Huecos.cajas(p).forEach(function (c) { if (g.Huecos.rellena(c.hueco)) l.push((c.grupo ? c.grupo + ' · ' : '') + c.hueco.titulo + ': ' + A.aVisible(c.hueco.notas)); });
    return l.join('\n');
  }

  /* ¿Hay que preguntar antes de sustituir el párrafo de este punto? Solo si Inma lo cambió a mano. */
  function hayQuePreguntar(p) { return !!p.manual && hayParrafo(p); }

  /* Lo único que sale hacia Claude: el número de punto, su título, los huecos con algo escrito (con su título) y sus notas, con el alumnado solo en iniciales («[M.S.P.]»).
     todos: todo el alumnado de Rúbricas (para la red de seguridad) o null. Devuelve { puntos, marcas, notasMarcadas, marcados, avisos } (ver alumnado-claude.js).
     marcados[n] = { notas, cajas: { k: texto } }: lo escrito con los nombres sueltos ya marcados (cajas: la posición en Huecos.cajas). */
  function prepararPeticion(b, indices, todos) {
    var H = g.Huecos, crudos = [];
    indices.forEach(function (i) {
      var p = b.puntos[i];
      crudos.push({ n: i + 1, titulo: String(p.titulo || '').trim(), notas: String(p.notas || '').trim() });
      if (H) H.cajas(p).forEach(function (c, k) { if (H.rellena(c.hueco)) crudos.push({ n: 'h' + (i + 1) + '.' + k, titulo: '', notas: String(c.hueco.notas).trim() }); });
    });
    var prep = g.AlumnadoClaude.preparar(crudos, todos), porN = {};
    prep.puntos.forEach(function (x) { porN[x.n] = x; });
    var res = { puntos: [], marcas: {}, notasMarcadas: {}, marcados: {}, avisos: {} };
    indices.forEach(function (i) {
      var n = i + 1, p = b.puntos[i], base = porN[n], salida = { n: n, titulo: base.titulo, notas: base.notas };
      var marcas = Object.assign({}, prep.marcas[n]), aviso = prep.avisos[n] || '', marcados = {}, sueltos = [], grupos = [], porGrupo = {};
      if (H) H.cajas(p).forEach(function (c, k) {
        var x = porN['h' + n + '.' + k];
        if (!x) return;
        Object.assign(marcas, prep.marcas['h' + n + '.' + k]);
        if (prep.avisos['h' + n + '.' + k] && !aviso) aviso = prep.avisos['h' + n + '.' + k];
        marcados[k] = prep.notasMarcadas['h' + n + '.' + k];
        var item = { titulo: c.hueco.titulo, notas: x.notas };
        if (c.grupo == null) sueltos.push(item);
        else {
          if (!porGrupo[c.grupo]) { porGrupo[c.grupo] = { grupo: c.grupo, huecos: [] }; grupos.push(porGrupo[c.grupo]); }
          porGrupo[c.grupo].huecos.push(item);
        }
      });
      if (sueltos.length) salida.huecos = sueltos;
      if (grupos.length) salida.grupos = grupos;
      if (p.porGrupo && p.porGrupo.length) salida.bloques = true; /* sesión de evaluación: la respuesta va en bloques, uno por grupo */
      res.puntos.push(salida); res.marcas[n] = marcas; res.notasMarcadas[n] = prep.notasMarcadas[n];
      res.marcados[n] = { notas: prep.notasMarcadas[n], cajas: marcados };
      if (aviso) res.avisos[n] = aviso;
    });
    return res;
  }
  function peticion(b, indices, todos) { return prepararPeticion(b, indices, todos).puntos; }

  /* Pone en el punto lo escrito con los nombres sueltos ya marcados (ver prepararPeticion). */
  function ponerMarcados(p, m) {
    if (!m) return p;
    if (m.notas != null) p.notas = String(m.notas);
    if (g.Huecos) g.Huecos.cajas(p).forEach(function (c, k) { if (m.cajas && m.cajas[k] != null) c.hueco.notas = String(m.cajas[k]); });
    return p;
  }

  function ponerParrafo(p, texto) {
    p.parrafo = String(texto || '').trim();
    p.notasRedactadas = contenido(p);
    p.manual = false;
    return p;
  }

  /* Inma escribe encima. Si borra todo el párrafo, el punto vuelve a no tener texto. */
  function editarParrafo(p, texto) {
    p.parrafo = String(texto || '');
    if (p.notasRedactadas == null) p.notasRedactadas = contenido(p);
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

  /* ¿Está «Lectura y aprobación del acta anterior» (el único punto obligatorio)? Vale otra redacción parecida: «Lectura del acta anterior». */
  function tieneActaAnterior(b) {
    return b.puntos.some(function (p) {
      if (fijo(p)) return true;
      var t = g.Alumnado.normalizar(p.titulo).replace(/\s+/g, ' ');
      return /acta anterior/.test(t) && /(lectura|aprobacion|leer|aprobar)/.test(t);
    });
  }
  /* «Añadirlo»: lo pone el primero. */
  function anadirActaAnterior(b) { b.puntos.unshift({ titulo: g.Borradores.PUNTO_ANTERIOR, notas: '' }); return b; }

  /* El texto de la respuesta de Claude -> { n: párrafo }. Lanza si no es el JSON pedido. */
  function leerRespuesta(texto, indices) {
    var t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var ini = t.indexOf('{'), fin = t.lastIndexOf('}');
    if (ini < 0 || fin < ini) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    var o = JSON.parse(t.slice(ini, fin + 1));
    if (!o || !Array.isArray(o.puntos)) throw new Error('La respuesta de Claude no tiene el formato pedido.');
    var res = {};
    o.puntos.forEach(function (x) {
      if (!x || !Number.isInteger(x.n)) return;
      if (Array.isArray(x.bloques)) { /* sesión de evaluación: «3.º A» y su párrafo debajo, y así con cada grupo */
        var t = x.bloques.filter(function (y) { return y && typeof y.parrafo === 'string' && y.parrafo.trim(); }).map(function (y) {
          return (typeof y.titulo === 'string' && y.titulo.trim() ? y.titulo.trim() + '\n' : '') + y.parrafo.trim();
        }).join('\n');
        if (t) { res[x.n] = t; return; }
      }
      if (typeof x.parrafo === 'string' && x.parrafo.trim()) res[x.n] = x.parrafo.trim();
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
    var todo = String(p.notas || '') + (g.Huecos ? g.Huecos.cajas(p).map(function (c) { return '\n' + c.hueco.notas; }).join('') : '');
    (A.alumnosCitados(todo).concat(p.alumnado || [])).forEach(function (x) {
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
        var o = { titulo: String(p.titulo || '').trim(), parrafo: hayParrafo(p) ? String(p.parrafo).trim() : '', alumnado: alumnadoDe(p) };
        var huecos = g.Huecos ? g.Huecos.titulosRellenos(p) : [];
        if (huecos.length) o.huecos = huecos; /* los títulos de los huecos con algo escrito, para que «Lo habitual» siga aprendiendo */
        return o;
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
    contenido: contenido, hayContenido: hayNotas, verContenido: verContenido, tieneActaAnterior: tieneActaAnterior, anadirActaAnterior: anadirActaAnterior, ponerMarcados: ponerMarcados,
    peticion: peticion, prepararPeticion: prepararPeticion, ponerParrafo: ponerParrafo, editarParrafo: editarParrafo, quitarParrafo: quitarParrafo,
    motivoQueImpide: motivoQueImpide, leerRespuesta: leerRespuesta, armarEnvio: armarEnvio, fechaActaAnterior: fechaActaAnterior
  };
})(typeof window !== 'undefined' ? window : globalThis);
