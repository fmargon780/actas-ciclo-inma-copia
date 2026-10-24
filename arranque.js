/* Arranque: recuerda la carpeta ACTAS entre visitas, la abre y pinta la pantalla de inicio. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var MODO = window.modoApp ? window.modoApp() : 'página web';
  $('versionPagina').textContent = window.VERSION_PAGINA + ' · ' + (window.COMMIT_PAGINA || 'sin-marca') + ' · ' + MODO;

  function hoyIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  var app = { est: null };
  function ctxAyuda() { return { est: app.est, elegirCarpeta: elegirYAbrir }; }
  /* El botón «?»: abre la página de ayuda en la sección de la pantalla donde estabas (antes se guarda lo que estuvieras escribiendo). */
  async function abrirAyuda() {
    var est = app.est;
    if (!est) { window.PantallaAyuda.pintarAyuda({ seccion: 'carpeta', alVolver: empezar, alGuia: function () { window.PantallaAyuda.abrirGuia(ctxAyuda()); } }); return; }
    await est.salir();
    if (est.paso !== 'ayuda') { est.pasoAnterior = est.paso; est.seccionAyuda = est.paso; est.paso = 'ayuda'; }
    est.refrescar();
  }
  $('botonAyuda').onclick = abrirAyuda;

  async function abrir(handle) {
    var raiz = window.Carpeta.adaptador(handle);
    raiz.alApartar = function (lista) { window.Dom.decir($('avisoApartados'), window.Carpeta.avisoApartados(lista)); };
    window.Dom.decir($('avisoApartados'), '');
    await window.Datos.comprobar(raiz);
    $('estadoCarpeta').textContent = 'Carpeta: ' + handle.name;
    try { await window.Colegio.alAbrir(raiz); } catch (e) { /* los datos del colegio se piden al sacar un documento; no impiden abrir la carpeta */ }
    var est = { raiz: raiz, ficha: await window.Datos.leerFicha(raiz), paso: 'inicio', borrador: null, estadoGuardado: $('estadoGuardado'), alSalir: null };
    var refrescar;
    var salir = async function () { if (est.alSalir) { var f = est.alSalir; est.alSalir = null; await f(); } };
    est.salir = salir; app.est = est;
    est.abrirBorrador = function (b) { est.borrador = b; est.paso = 'formulario'; refrescar(); };
    est.abrirFichas = function () { est.paso = 'fichas'; est.borrador = null; refrescar(); };
    est.abrirEntrevista = function (id) { est.paso = 'entrevista'; est.entrevistaId = id || null; est.entrevistaActual = null; est.borrador = null; refrescar(); };
    est.abrirReunion = function (id) { est.paso = 'reunion'; est.reunionId = id || null; est.reunionActual = null; est.borrador = null; refrescar(); };
    est.abrirEvaluacion = function (id) { est.paso = 'evaluacion'; est.evaluacionId = id || null; est.evaluacionActual = null; est.borrador = null; refrescar(); };
    est.abrirDiversidad = function () { est.paso = 'diversidad'; est.diversidad = null; est.praActual = null; est.peticionActual = null; est.borrador = null; refrescar(); };
    est.abrirMiTutoria = function () { est.paso = 'tutoria'; est.borrador = null; refrescar(); };
    est.abrirTraer = function () { est.paso = 'traer'; est.traer = null; est.borrador = null; refrescar(); };
    est.abrirLibro = function () { est.paso = 'libro'; est.libro = null; est.borrador = null; refrescar(); };
    est.abrirHabitual = function () { est.paso = 'habitual'; est.borrador = null; refrescar(); };
    est.abrirConvocatoria = function (fecha) { est.paso = 'convocatoria'; est.fechaConvocatoria = fecha || hoyIso(); est.borrador = null; refrescar(); };
    est.irAjustes = async function (destino) { await salir(); est.paso = 'ajustes'; est.borrador = null; est.destinoAjustes = destino || null; refrescar(); };
    est.nuevoBorrador = async function () {
      var b = window.Borradores.nuevo(est.ficha, hoyIso(), new Date()), conv = await window.Convocatoria.leer(raiz, b.fecha);
      /* Si hoy hay convocatoria, el acta ya trae sus puntos; si no, los de «Lo habitual» de este mes, con sus huecos. */
      if (!conv) conv = window.Convocatoria.proponer(await window.Habitual.leer(raiz), b.fecha, b.inicio, new Date());
      est.abrirBorrador(window.Convocatoria.borradorNuevo(conv, est.ficha, new Date()));
    };
    refrescar = async function () {
      $('estadoGuardado').textContent = '';
      $('pasoInicio').classList.toggle('activo', est.paso === 'inicio' || est.paso === 'formulario' || est.paso === 'revision' || est.paso === 'fichas' || est.paso === 'habitual' || est.paso === 'traer' || est.paso === 'libro' || est.paso === 'convocatoria' || est.paso === 'entrevista' || est.paso === 'tutoria' || est.paso === 'reunion' || est.paso === 'evaluacion' || est.paso === 'diversidad');
      $('pasoAjustes').classList.toggle('activo', est.paso === 'ajustes');
      est.ficha = await window.Datos.leerFicha(raiz);
      if (est.paso !== 'entrevista' && est.paso !== 'ayuda') { est.entrevistaId = null; est.entrevistaActual = null; }
      if (est.paso !== 'reunion' && est.paso !== 'ayuda') { est.reunionId = null; est.reunionActual = null; }
      if (est.paso !== 'evaluacion' && est.paso !== 'ayuda') { est.evaluacionId = null; est.evaluacionActual = null; }
      if (est.paso !== 'diversidad' && est.paso !== 'ayuda') { est.diversidad = null; est.praActual = null; est.peticionActual = null; }
      var alInicio = function () { est.paso = 'inicio'; est.borrador = null; refrescar(); };
      if (est.paso === 'ayuda') {
        await window.PantallaAyuda.pintarAyuda({ seccion: est.seccionAyuda, alVolver: function () { est.paso = est.pasoAnterior || 'inicio'; refrescar(); }, alGuia: function () { window.PantallaAyuda.abrirGuia(ctxAyuda()); } });
        return;
      }
      if (est.paso === 'formulario') { window.PantallaFormulario.pintarFormulario(est, est.borrador, alInicio, function () { est.paso = 'revision'; est.redactarAlEntrar = !est.borrador.puntos.some(function (p) { return p.parrafo; }); refrescar(); }); return; }
      if (est.paso === 'revision') {
        var redactar = est.redactarAlEntrar; est.redactarAlEntrar = false;
        window.PantallaRevision.pintarRevision(est, est.borrador, function () { est.paso = 'formulario'; refrescar(); }, alInicio, redactar); return;
      }
      if (est.paso === 'traer') { await window.PantallaTraer.pintarTraer(est, alInicio); return; }
      if (est.paso === 'libro') { await window.PantallaLibro.pintarLibro(est, alInicio); return; }
      if (est.paso === 'habitual') { await window.PantallaHabitual.pintarHabitual(est, alInicio); return; }
      if (est.paso === 'convocatoria') { await window.PantallaConvocatoria.pintarConvocatoria(est, alInicio, est.fechaConvocatoria || hoyIso()); return; }
      if (est.paso === 'tutoria') { await window.PantallaMiTutoria.pintarMiTutoria(est, alInicio); return; }
      if (est.paso === 'reunion') { await window.PantallaReunion.pintarReunion(est, alInicio); return; }
      if (est.paso === 'evaluacion') { await window.PantallaEvaluacion.pintarEvaluacion(est, alInicio); return; }
      if (est.paso === 'diversidad') { await window.PantallaDiversidad.pintarDiversidad(est, alInicio); return; }
      if (est.paso === 'entrevista') { await window.PantallaEntrevista.pintarEntrevista(est, alInicio); return; }
      if (est.paso === 'fichas') { await window.PantallaFichas.pintarFichas(est, alInicio); return; }
      if (est.paso === 'ajustes') { await window.PantallaAjustes.pintarAjustes(est, refrescar); return; }
      await window.PantallaInicio.pintarInicio(est, refrescar);
    };
    est.refrescar = refrescar;
    $('pasoInicio').onclick = async function () { await salir(); est.paso = 'inicio'; est.borrador = null; refrescar(); };
    $('pasoAjustes').onclick = async function () { await salir(); est.paso = 'ajustes'; est.borrador = null; refrescar(); };
    window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && est.alSalir) est.alSalir(); });
    await refrescar();
    await window.PantallaAyuda.guiaSiToca(ctxAyuda());
  }

  async function elegirYAbrir() {
    try { await abrir(await window.Carpeta.elegir()); }
    catch (e) { if (e && e.name === 'AbortError') return; window.Pantalla.pedirCarpeta(window.Carpeta.explicarError(e), elegirYAbrir); }
  }

  async function empezar() {
    /* En la app de internet hay que entrar con Google; con la sesión guardada no se pregunta nada al servicio. */
    if (!window.Entrada.pedir(empezar)) return;
    var h = await window.Carpeta.recordada();
    var texto = 'Elige la carpeta ACTAS de tu Drive (está en Mi unidad › ACTAS; la crea el documento de actas la primera vez que usas su menú «Actas»). Aquí guardaré tus borradores.';
    if (!h) { window.Pantalla.pedirCarpeta(texto, elegirYAbrir); await window.PantallaAyuda.guiaSiToca(ctxAyuda()); return; }
    if ((await window.Carpeta.permiso(h)) === 'granted') {
      try { await abrir(h); } catch (e) { window.Pantalla.pedirCarpeta(window.Carpeta.explicarError(e), elegirYAbrir); }
      return;
    }
    window.Pantalla.pedirCarpeta('Chrome pide confirmar el permiso sobre tu carpeta ' + h.name + '.', async function () {
      if (await window.Carpeta.pedirPermiso(h)) { try { await abrir(h); } catch (e) { window.Pantalla.pedirCarpeta(window.Carpeta.explicarError(e), elegirYAbrir); } }
      else window.Pantalla.pedirCarpeta('Sin permiso no puedo abrir la carpeta. Elígela otra vez.', elegirYAbrir);
    }, 'Dar permiso');
  }
  window.Ayuda.cargar().then(empezar, empezar);
})();
