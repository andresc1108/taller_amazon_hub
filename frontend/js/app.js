/**
 * app.js
 * Controlador principal de la aplicación.
 * Conecta la API (api.js) con la interfaz (ui.js) y maneja los eventos del usuario.
 */

const App = (() => {

  // ── Estado local ──────────────────────────────────────────────────
  let _pkgParaEntregar = null;    // Paquete activo en el modal de entrega
  let _firmaCtx        = null;    // Contexto del canvas de firma
  let _firmaPintando   = false;
  let _histFilter      = "todos"; // Filtro activo del historial
  let _activePanel     = "recibir";

  // ── Inicialización ────────────────────────────────────────────────

  function init() {
    _bindNav();
    _bindForm();
    _bindCola();
    _bindCamion();
    _bindTracking();
    _bindHistorial();
    _bindModal();
    _bindLog();
    _startClock();

    UI.log("[SISTEMA] Amazon Hub iniciado — Centro de distribución Pasto, Nariño", "ok");
    _refreshStats();
  }

  // ── Navegación ────────────────────────────────────────────────────

  function _bindNav() {
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const panel = btn.dataset.panel;
        document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`panel-${panel}`).classList.add("active");
        _activePanel = panel;
        _onPanelOpen(panel);
      });
    });
  }

  async function _onPanelOpen(panel) {
    if (panel === "cola")      await _loadCola();
    if (panel === "camion")    await _loadCamion();
    if (panel === "almacen")   await _loadAlmacen();
    if (panel === "historial") await _loadHistorial();
  }

  function goTrack(id) {
    document.querySelector('[data-panel="tracking"]').click();
    // Esperar a que el panel sea visible antes de buscar
    setTimeout(() => {
      document.getElementById("inp-track").value = id;
      _trackPkg();
    }, 50);
  }

  // ── Formulario — Recibir pedido ───────────────────────────────────

  function _bindForm() {
    document.getElementById("btn-recibir").addEventListener("click", _recibirPedido);
    document.getElementById("btn-limpiar").addEventListener("click", _limpiarForm);
    document.getElementById("f-dest").addEventListener("keydown", e => { if (e.key === "Enter") _recibirPedido(); });
  }

  async function _recibirPedido() {
    const fields = {
      recipient:   _val("f-dest"),
      phone:       _val("f-tel"),
      address:     _val("f-dir"),
      category:    _val("f-cat"),
      weight:      _val("f-peso"),
      description: _val("f-desc"),
      priority:    _val("f-prio"),
    };

    if (!fields.recipient || !fields.phone || !fields.address || !fields.description || !fields.weight) {
      UI.toast("Completa todos los campos", "warn");
      return;
    }

    const res = await API.recibirPaquete(fields);
    if (!res.ok) { UI.toast(res.error, "err"); return; }

    const pkg = res.package;
    UI.log(`[RECEPCIÓN] ${pkg.id} registrado — ${pkg.recipient} — ${pkg.category} ${pkg.weight}kg`, "ok");
    UI.toast(`${pkg.id} registrado exitosamente`, "ok");
    _limpiarForm();
    _refreshStats();
  }

  function _limpiarForm() {
    ["f-dest", "f-tel", "f-dir", "f-peso", "f-desc"].forEach(id => {
      document.getElementById(id).value = "";
    });
  }

  // ── Cola ─────────────────────────────────────────────────────────

  function _bindCola() {
    document.getElementById("btn-cargar-camion").addEventListener("click",  _cargarAlCamion);
    document.getElementById("btn-vaciar-cola").addEventListener("click",    _vaciarCola);
  }

  async function _loadCola() {
    const res = await API.getCola();
    if (res.ok) UI.renderCola(res.queue);
  }

  async function _cargarAlCamion() {
    const res = await API.despacharDeCola();
    if (!res.ok) { UI.toast(res.error, "warn"); return; }

    const pkg = res.package;
    UI.log(`[CARGA] ${pkg.id} → camión (tope de la pila)`, "info");
    UI.toast(`${pkg.id} cargado al camión`, "ok");
    _refreshStats();
    if (_activePanel === "cola")   await _loadCola();
    if (_activePanel === "camion") await _loadCamion();
  }

  async function _vaciarCola() {
    const res = await API.vaciarCola();
    if (!res.ok) { UI.toast(res.error, "err"); return; }
    UI.log(`[COLA] Vaciada manualmente (${res.deleted} paquetes)`, "warn");
    UI.toast("Cola vaciada", "warn");
    _refreshStats();
    await _loadCola();
  }

  // ── Camión ───────────────────────────────────────────────────────

  function _bindCamion() {
    document.getElementById("btn-salir-ruta").addEventListener("click",       _salirRuta);
    document.getElementById("btn-cargar-desde-cola").addEventListener("click", _cargarAlCamion);
  }

  async function _loadCamion() {
    const [camionRes, rutaRes] = await Promise.all([API.getCamion(), API.getEnCamino()]);
    if (camionRes.ok) UI.renderCamion(camionRes);
    if (rutaRes.ok)   UI.renderEnCamino(rutaRes.on_route);
  }

  async function _salirRuta() {
    const res = await API.salirRuta();
    if (!res.ok) { UI.toast(res.error, "warn"); return; }

    UI.log(`[RUTA] Camión salió con ${res.count} paquete(s)`, "ship");
    UI.toast(`Camión en ruta con ${res.count} paquetes`, "ok");
    _refreshStats();
    await _loadCamion();
  }

  // ── Entrega ───────────────────────────────────────────────────────

  async function abrirModalEntrega(pkgId) {
    const res = await API.getPaquete(pkgId);
    if (!res.ok) { UI.toast("No se pudo cargar el paquete", "err"); return; }

    _pkgParaEntregar = res.package;
    UI.renderModalPkg(_pkgParaEntregar);
    document.getElementById("modal").setAttribute("aria-hidden", "false");
    _initFirma();
  }

  function _bindModal() {
    document.getElementById("btn-confirmar-entrega").addEventListener("click", _confirmarEntrega);
    document.getElementById("btn-cancelar-modal").addEventListener("click",   _cerrarModal);
    document.getElementById("btn-clear-firma").addEventListener("click",      () => _clearFirma());
    document.getElementById("modal").addEventListener("click", e => {
      if (e.target === e.currentTarget) _cerrarModal();
    });
  }

  async function _confirmarEntrega() {
    if (!_pkgParaEntregar) return;

    // Verificar que la firma no esté vacía
    if (!_firmaValida()) {
      UI.toast("Por favor, el destinatario debe firmar antes de confirmar", "warn");
      // Resaltar el canvas para llamar la atención
      const c = document.getElementById("firma-canvas");
      c.style.borderColor = "var(--red)";
      setTimeout(() => (c.style.borderColor = ""), 2000);
      return;
    }

    const res = await API.confirmarEntrega(_pkgParaEntregar.id);
    if (!res.ok) { UI.toast(res.error, "err"); return; }

    const pkg = res.package;
    UI.log(`[ENTREGA] ✓ ${pkg.id} entregado a ${pkg.recipient}`, "ok");
    UI.toast(`¡${pkg.id} entregado exitosamente!`, "ok");
    _cerrarModal();
    _refreshStats();
    if (_activePanel === "camion")    await _loadCamion();
    if (_activePanel === "historial") await _loadHistorial();
    if (_activePanel === "tracking")  _trackPkg();
  }

  function _firmaValida() {
    const c = document.getElementById("firma-canvas");
    if (!c || !_firmaCtx) return false;

    // Revisar si algún pixel del canvas tiene contenido (alpha > 0)
    const pixels = _firmaCtx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) return true; // encontró un pixel dibujado
    }
    return false;
  }

  function _cerrarModal() {
    document.getElementById("modal").setAttribute("aria-hidden", "true");
    _pkgParaEntregar = null;
  }

  // ── Firma digital ─────────────────────────────────────────────────

  function _initFirma() {
    const c = document.getElementById("firma-canvas");

    // Esperar un frame para que el modal esté completamente visible
    // y getBoundingClientRect() devuelva dimensiones reales
    requestAnimationFrame(() => {
      const dpr  = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();

      // Evitar inicializar con dimensiones 0 si el modal aún no es visible
      if (rect.width === 0) return;

      c.width  = rect.width  * dpr;
      c.height = rect.height * dpr;

      _firmaCtx = c.getContext("2d");
      _firmaCtx.scale(dpr, dpr);
      _firmaCtx.strokeStyle = "#ff9900";
      _firmaCtx.lineWidth   = 2.5;
      _firmaCtx.lineCap     = "round";
      _firmaCtx.lineJoin    = "round";
      _clearFirma();

      // Calcula la posición correcta del toque/click relativa al canvas
      const getPos = (ev) => {
        const r = c.getBoundingClientRect();
        const s = ev.touches ? ev.touches[0] : ev;
        return [s.clientX - r.left, s.clientY - r.top];
      };

      // Eventos de mouse (PC)
      c.onmousedown  = e => { _firmaPintando = true; _firmaCtx.beginPath(); _firmaCtx.moveTo(...getPos(e)); };
      c.onmousemove  = e => { if (!_firmaPintando) return; _firmaCtx.lineTo(...getPos(e)); _firmaCtx.stroke(); };
      c.onmouseup    = () => (_firmaPintando = false);
      c.onmouseleave = () => (_firmaPintando = false);

      // Eventos de toque (móvil/tablet)
      // Se usa addEventListener con { passive: false } para poder llamar preventDefault()
      // y evitar que el scroll de la página interfiera con la firma
      c.addEventListener("touchstart", e => {
        e.preventDefault();
        _firmaPintando = true;
        _firmaCtx.beginPath();
        _firmaCtx.moveTo(...getPos(e));
      }, { passive: false });

      c.addEventListener("touchmove", e => {
        e.preventDefault();
        if (!_firmaPintando) return;
        _firmaCtx.lineTo(...getPos(e));
        _firmaCtx.stroke();
      }, { passive: false });

      c.addEventListener("touchend",    () => (_firmaPintando = false), { passive: true });
      c.addEventListener("touchcancel", () => (_firmaPintando = false), { passive: true });
    });
  }

  function _clearFirma() {
    if (_firmaCtx) {
      const c = document.getElementById("firma-canvas");
      // Limpiar en coordenadas lógicas (sin multiplicar por dpr)
      const dpr = window.devicePixelRatio || 1;
      _firmaCtx.clearRect(0, 0, c.width / dpr, c.height / dpr);
    }
  }

  // ── Tracking ─────────────────────────────────────────────────────

  function _bindTracking() {
    document.getElementById("btn-rastrear").addEventListener("click", _trackPkg);
    document.getElementById("inp-track").addEventListener("keydown", e => { if (e.key === "Enter") _trackPkg(); });
  }

  async function _trackPkg() {
    const id = document.getElementById("inp-track").value.trim().toUpperCase();
    if (!id) return;

    const res = await API.getPaquete(id);
    if (!res.ok) {
      document.getElementById("track-result").innerHTML =
        `<div class="empty-state"><span class="empty-ico">❌</span><span class="empty-txt">Paquete "${id}" no encontrado</span></div>`;
      return;
    }

    UI.renderTracking(res.package);
    UI.log(`[RASTREO] ${id} consultado — estado: ${res.package.status}`, "info");
  }

  // ── Historial ─────────────────────────────────────────────────────

  function _bindHistorial() {
    document.getElementById("hist-filters").addEventListener("click", e => {
      if (!e.target.classList.contains("filter-btn")) return;
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      _histFilter = e.target.dataset.filter;
      _loadHistorial();
    });
  }

  async function _loadHistorial() {
    const estado = _histFilter === "todos" ? null : _histFilter;
    const res    = await API.listarPaquetes(estado);
    if (res.ok) UI.renderHistorial(res.packages);
  }

  // ── Almacén ───────────────────────────────────────────────────────

  async function _loadAlmacen() {
    const res = await API.getAlmacen();
    if (res.ok) UI.renderAlmacen(res.warehouse);
  }

  // ── Stats ─────────────────────────────────────────────────────────

  async function _refreshStats() {
    const res = await API.getStats();
    if (res.ok) UI.updateStats(res);
  }

  // ── Log ───────────────────────────────────────────────────────────

  function _bindLog() {
    document.getElementById("btn-clear-log").addEventListener("click", UI.clearLog);
  }

  // ── Reloj ─────────────────────────────────────────────────────────

  function _startClock() {
    const tick = () => {
      document.getElementById("clock").textContent = new Date().toLocaleTimeString();
    };
    setInterval(tick, 1000);
    tick();

    // Refrescar stats automáticamente cada 30 segundos
    setInterval(_refreshStats, 30000);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  function _val(id) { return document.getElementById(id)?.value?.trim() || ""; }

  // ── API pública del módulo ────────────────────────────────────────
  return { init, goTrack, abrirModalEntrega };

})();

// Iniciar aplicación cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", App.init);