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

  async function abrir(handle) {
    var raiz = window.Carpeta.adaptador(handle);
    raiz.alApartar = function (lista) { window.Dom.decir($('avisoApartados'), window.Carpeta.avisoApartados(lista)); };
    window.Dom.decir($('avisoApartados'), '');
    await window.Datos.comprobar(raiz);
    $('estadoCarpeta').textContent = 'Carpeta: ' + handle.name;
    var est = { raiz: raiz, ficha: await window.Datos.leerFicha(raiz), paso: 'inicio', borrador: null, estadoGuardado: $('estadoGuardado'), alSalir: null };
    var refrescar;
    var salir = async function () { if (est.alSalir) { var f = est.alSalir; est.alSalir = null; await f(); } };
    est.abrirBorrador = function (b) { est.borrador = b; est.paso = 'formulario'; refrescar(); };
    est.abrirFichas = function () { est.paso = 'fichas'; est.borrador = null; refrescar(); };
    est.abrirEntrevista = function (id) { est.paso = 'entrevista'; est.entrevistaId = id || null; est.entrevistaActual = null; est.borrador = null; refrescar(); };
    est.abrirHabitual = function () { est.paso = 'habitual'; est.borrador = null; refrescar(); };
    est.abrirConvocatoria = function (fecha) { est.paso = 'convocatoria'; est.fechaConvocatoria = fecha || hoyIso(); est.borrador = null; refrescar(); };
    est.irAjustes = async function () { await salir(); est.paso = 'ajustes'; est.borrador = null; refrescar(); };
    est.nuevoBorrador = async function () {
      var b = window.Borradores.nuevo(est.ficha, hoyIso(), new Date()), conv = await window.Convocatoria.leer(raiz, b.fecha);
      /* Si hoy hay convocatoria, el acta ya trae sus puntos; si no, los de «Lo habitual» de este mes, con sus huecos. */
      if (!conv) conv = window.Convocatoria.proponer(await window.Habitual.leer(raiz), b.fecha, b.inicio, new Date());
      est.abrirBorrador(window.Convocatoria.borradorNuevo(conv, est.ficha, new Date()));
    };
    refrescar = async function () {
      $('estadoGuardado').textContent = '';
      $('pasoInicio').classList.toggle('activo', est.paso === 'inicio' || est.paso === 'formulario' || est.paso === 'revision' || est.paso === 'fichas' || est.paso === 'habitual' || est.paso === 'convocatoria' || est.paso === 'entrevista');
      $('pasoAjustes').classList.toggle('activo', est.paso === 'ajustes');
      est.ficha = await window.Datos.leerFicha(raiz);
      if (est.paso !== 'entrevista') { est.entrevistaId = null; est.entrevistaActual = null; }
      var alInicio = function () { est.paso = 'inicio'; est.borrador = null; refrescar(); };
      if (est.paso === 'formulario') { window.PantallaFormulario.pintarFormulario(est, est.borrador, alInicio, function () { est.paso = 'revision'; est.redactarAlEntrar = !est.borrador.puntos.some(function (p) { return p.parrafo; }); refrescar(); }); return; }
      if (est.paso === 'revision') {
        var redactar = est.redactarAlEntrar; est.redactarAlEntrar = false;
        window.PantallaRevision.pintarRevision(est, est.borrador, function () { est.paso = 'formulario'; refrescar(); }, alInicio, redactar); return;
      }
      if (est.paso === 'habitual') { await window.PantallaHabitual.pintarHabitual(est, alInicio); return; }
      if (est.paso === 'convocatoria') { await window.PantallaConvocatoria.pintarConvocatoria(est, alInicio, est.fechaConvocatoria || hoyIso()); return; }
      if (est.paso === 'entrevista') { await window.PantallaEntrevista.pintarEntrevista(est, alInicio); return; }
      if (est.paso === 'fichas') { await window.PantallaFichas.pintarFichas(est, alInicio); return; }
      if (est.paso === 'ajustes') { await window.PantallaAjustes.pintarAjustes(est, refrescar); return; }
      await window.PantallaInicio.pintarInicio(est, refrescar);
    };
    $('pasoInicio').onclick = async function () { await salir(); est.paso = 'inicio'; est.borrador = null; refrescar(); };
    $('pasoAjustes').onclick = async function () { await salir(); est.paso = 'ajustes'; est.borrador = null; refrescar(); };
    window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && est.alSalir) est.alSalir(); });
    await refrescar();
  }

  async function elegirYAbrir() {
    try { await abrir(await window.Carpeta.elegir()); }
    catch (e) { if (e && e.name === 'AbortError') return; window.Pantalla.pedirCarpeta(window.Carpeta.explicarError(e), elegirYAbrir); }
  }

  async function empezar() {
    var h = await window.Carpeta.recordada();
    var texto = 'Elige la carpeta ACTAS de tu Drive (está en Mi unidad › ACTAS; la crea el documento de actas la primera vez que usas su menú «Actas»). Aquí guardaré tus borradores.';
    if (!h) { window.Pantalla.pedirCarpeta(texto, elegirYAbrir); return; }
    if ((await window.Carpeta.permiso(h)) === 'granted') {
      try { await abrir(h); } catch (e) { window.Pantalla.pedirCarpeta(window.Carpeta.explicarError(e), elegirYAbrir); }
      return;
    }
    window.Pantalla.pedirCarpeta('Chrome pide confirmar el permiso sobre tu carpeta ' + h.name + '.', async function () {
      if (await window.Carpeta.pedirPermiso(h)) { try { await abrir(h); } catch (e) { window.Pantalla.pedirCarpeta(window.Carpeta.explicarError(e), elegirYAbrir); } }
      else window.Pantalla.pedirCarpeta('Sin permiso no puedo abrir la carpeta. Elígela otra vez.', elegirYAbrir);
    }, 'Dar permiso');
  }
  empezar();
})();
