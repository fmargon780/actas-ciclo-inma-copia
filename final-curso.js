/* Informes de final de curso (fila 101), la parte que calcula: qué informe toca según el curso del grupo, los apartados de cada informe, el estado de cada alumno,
   lo que la app ya sabe de él y cómo se guarda. Sin pantalla ni red: se prueba con node --test.
   Cada informe se guarda en ACTAS/final-curso/<id>.json (uno por alumno, curso escolar y tipo):
   { formato, id, curso ('2026-2027'), tipo ('curso' | 'ciclo' | 'etapa'), alumno: { nombre, grupo, enLista, genero ('a' | 'o' | '' si no se sabe) }, notas (con marcas de alumnado), notasRedactadas,
     textos: { <id del apartado>: texto }, fecha, documentos?: { curso, base, pdf, docx, firma }, versiones?, actualizado, creado }.
   TIPOS es lo único que habría que tocar para cambiar un informe (nombre, apartados o la guía que lee Claude de cada apartado). */
(function (g) {
  'use strict';
  var A = g.Alumnado, DIR = 'final-curso';
  var TIPOS = {
    curso: {
      id: 'curso', nombre: 'Informe de final de curso', nota: 'Papel del colegio: no es un documento oficial.', oficial: false,
      apartados: [
        { id: 'marcha', titulo: 'Cómo ha ido el curso', guia: 'una valoración general del curso: clima, participación, actitud y trabajo diario' },
        { id: 'logros', titulo: 'Lo que ha conseguido', guia: 'los avances y logros del curso en los aprendizajes' },
        { id: 'refuerzo', titulo: 'Qué conviene reforzar el curso que viene', guia: 'lo que conviene seguir reforzando o cuidar el curso siguiente' }
      ]
    },
    ciclo: {
      id: 'ciclo', nombre: 'Informe final de ciclo', nota: 'Documento oficial.', oficial: true,
      apartados: [
        { id: 'competencias', titulo: 'Grado de adquisición de las competencias clave', guia: 'el grado de adquisición de las competencias clave al acabar el ciclo' },
        { id: 'medidas', titulo: 'Medidas de refuerzo necesarias', guia: 'las medidas de refuerzo que necesita el alumno al empezar el ciclo siguiente, o que no se proponen medidas si no las necesita' }
      ]
    },
    etapa: {
      id: 'etapa', nombre: 'Informe final de etapa', nota: 'Documento oficial. Las notas y lo que escribe la dirección no van aquí: están en Séneca.', oficial: true,
      apartados: [
        { id: 'aplicadas', titulo: 'Medidas aplicadas y cómo han ido', guia: 'las medidas de atención a la diversidad aplicadas en la etapa y cómo han funcionado, o que no han sido necesarias' },
        { id: 'secundaria', titulo: 'Medidas que se proponen para Secundaria', guia: 'las medidas que se proponen para el paso a Secundaria, o que no se proponen medidas complementarias' },
        { id: 'valoracion', titulo: 'Valoración global del aprendizaje', guia: 'una valoración global del aprendizaje y de la progresión en la etapa' },
        { id: 'integracion', titulo: 'Tránsito: integración y adaptación', guia: 'tránsito a Secundaria: la integración en el grupo, la relación con compañeros y compañeras y la adaptación' },
        { id: 'habitos', titulo: 'Tránsito: hábitos de trabajo y forma de aprender', guia: 'tránsito a Secundaria: atención, organización, hábitos de trabajo y forma de aprender' },
        { id: 'familia', titulo: 'Tránsito: relación con la familia', guia: 'tránsito a Secundaria: la relación de la familia con el centro y su colaboración' }
      ]
    }
  };
  var ESTADOS = { nada: 'Sin empezar', notas: 'Con notas', redactado: 'Redactado', hecho: 'Hecho' };
  var FRASE_NADA = 'Escribe alguna nota: de este alumno no hay nada guardado.';

  function lleno(t) { return !!String(t || '').trim(); }
  function marcaTiempo(ahora) { return (ahora || new Date()).toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6); }

  /* --- qué informe toca --- */
  /* El curso (1 a 6) que dice el nombre del grupo («6º A», «6.º B»…); null si no empieza por un curso reconocible. */
  function cursoDeGrupo(grupo) { var m = /^\s*([1-6])(?!\d)/.exec(String(grupo || '')); return m ? Number(m[1]) : null; }
  function tipoDeCurso(n) { return n === 6 ? TIPOS.etapa : n === 2 || n === 4 ? TIPOS.ciclo : n === 1 || n === 3 || n === 5 ? TIPOS.curso : null; }
  function tipoDeGrupo(grupo) { return tipoDeCurso(cursoDeGrupo(grupo)); }
  function tipo(f) { return TIPOS[f.tipo] || null; }

  function nueva(alumno, tipoId, fecha, ahora) {
    var t = (ahora || new Date()).toISOString();
    return {
      formato: 1, id: 'final-' + marcaTiempo(ahora), curso: g.cursoEscolar(fecha), tipo: tipoId,
      alumno: { nombre: alumno.nombre, grupo: alumno.grupo || '', enLista: alumno.enLista !== false, genero: alumno.genero === 'a' || alumno.genero === 'o' ? alumno.genero : '' },
      notas: '', notasRedactadas: '', textos: {}, fecha: fecha, documentos: null, actualizado: t, creado: t
    };
  }

  /* --- textos y estado --- */
  function texto(f, id) { return String((f.textos || {})[id] || ''); }
  function hayTextos(f) { return !!f && !!tipo(f) && tipo(f).apartados.some(function (a) { return lleno(texto(f, a.id)); }); }
  function hayNotas(f) { return !!f && lleno(f.notas); }
  function firmaNotas(f) { return String(f.notas || ''); }
  /* ¿Cambiaron las notas desde la última redacción y hay algo redactado? */
  function notasCambiaron(f) { return hayTextos(f) && firmaNotas(f) !== (f.notasRedactadas || ''); }
  /* Todo lo que sale en el papel: si cambia después de crear PDF y Word, el informe deja de estar «Hecho». */
  function firmaTextos(f) { return JSON.stringify([f.tipo, f.fecha, tipo(f) ? tipo(f).apartados.map(function (a) { return texto(f, a.id); }) : []]); }
  function creado(f) { return !!f && !!f.documentos && f.documentos.firma === firmaTextos(f); }
  /* 'nada' | 'notas' | 'redactado' | 'hecho' */
  function estado(f) {
    if (!f) return 'nada';
    if (hayTextos(f)) return creado(f) ? 'hecho' : 'redactado';
    return hayNotas(f) ? 'notas' : 'nada';
  }
  function etiqueta(f) { return ESTADOS[estado(f)]; }
  function contarHechos(fs) { return fs.filter(function (f) { return estado(f) === 'hecho'; }).length; }

  /* Pone lo redactado por Claude ({ id: texto }); cada texto anterior queda para «Deshacer» (Retoque). Si el informe estaba creado, deja de estarlo solo. */
  function ponerRedaccion(f, res) {
    if (!f.textos) f.textos = {};
    tipo(f).apartados.forEach(function (a) {
      var antes = texto(f, a.id), ahora = String(res[a.id] == null ? '' : res[a.id]);
      f.textos[a.id] = ahora; g.Retoque.cambiar(f, a.id, antes, ahora);
    });
    f.notasRedactadas = firmaNotas(f);
  }
  /* ¿Se puede redactar? Hace falta alguna nota o algo guardado del alumno. */
  function problema(f, sabe) { return hayNotas(f) || (sabe && sabe.length) ? '' : FRASE_NADA; }

  /* --- guardado --- */
  async function guardar(raiz, f, ahora) {
    f.actualizado = (ahora || new Date()).toISOString();
    await raiz.escribirJSON(DIR + '/' + f.id + '.json', f);
    return f;
  }
  async function leer(raiz, id) { return raiz.leerJSON(DIR + '/' + id + '.json'); }
  async function borrar(raiz, id) { await raiz.borrar(DIR + '/' + id + '.json', false); }
  /* Todos los informes legibles. Un fichero roto se salta. */
  async function listar(raiz) {
    var nombres = await raiz.listarJSON(DIR), lista = [];
    for (var i = 0; i < nombres.length; i++) {
      try {
        var f = await raiz.leerJSON(DIR + '/' + nombres[i]);
        if (f && f.id && f.alumno && f.alumno.nombre && TIPOS[f.tipo]) lista.push(f);
      } catch (x) { /* fichero a medias: no se enseña */ }
    }
    return lista;
  }
  function delCurso(lista, curso) { return (lista || []).filter(function (f) { return !curso || f.curso === curso; }); }
  /* El informe de ese alumno en ese curso y tipo, o null. */
  function existente(lista, alumno, curso, tipoId) {
    return delCurso(lista, curso).filter(function (f) { return f.tipo === tipoId && g.Tutoria.mismoAlumno(f.alumno, alumno); })[0] || null;
  }

  g.FinalCurso = {
    DIR: DIR, TIPOS: TIPOS, ESTADOS: ESTADOS, FRASE_NADA: FRASE_NADA, cursoDeGrupo: cursoDeGrupo, tipoDeCurso: tipoDeCurso, tipoDeGrupo: tipoDeGrupo, tipo: tipo,
    nueva: nueva, texto: texto, hayTextos: hayTextos, hayNotas: hayNotas, firmaNotas: firmaNotas, notasCambiaron: notasCambiaron, firmaTextos: firmaTextos,
    creado: creado, estado: estado, etiqueta: etiqueta, contarHechos: contarHechos, ponerRedaccion: ponerRedaccion, problema: problema,
    guardar: guardar, leer: leer, borrar: borrar, listar: listar, delCurso: delCurso, existente: existente
  };
})(typeof window !== 'undefined' ? window : globalThis);
