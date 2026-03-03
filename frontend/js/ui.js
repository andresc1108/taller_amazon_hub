/**
 * ui.js
 * Módulo de renderizado: construye y actualiza todos los componentes visuales.
 * No hace llamadas a la API directamente; recibe datos ya procesados.
 */

const CAT_ICONS = {
  electronica: "📱",
  ropa:        "👕",
  alimentos:   "🥦",
  juguetes:    "🧸",
  libros:      "📚",
};

const PRIO_ICONS = { normal: "", express: "⚡", fragil: "🔴" };

const ESTADO_LABELS = {
  en_cola:    "En Cola",
  en_camion:  "En Camión",
  en_camino:  "En Camino",
  entregado:  "Entregado",
};

const EVENT_COLORS = {
  ok:   "var(--green)",
  ship: "var(--purple)",
  warn: "var(--amz)",
  info: "var(--cyan)",
};

const UI = {

  // ── Cola ─────────────────────────────────────────────────────────

  renderCola(packages) {
    const el = _el("lista-cola");
    if (!packages.length) { el.innerHTML = _empty("📭", "Cola vacía"); return; }

    el.innerHTML = packages.map((p, i) => `
      <div class="pkg-card status-${p.status}">
        <div class="pkg-num">${i + 1}</div>
        <div class="pkg-info">
          <div class="pkg-id">${p.id} ${PRIO_ICONS[p.priority] || ""}</div>
          <div class="pkg-name">${p.recipient}</div>
          <div class="pkg-meta">${p.description} · ${p.address} · ${p.weight}kg</div>
        </div>
        <div class="pkg-right">
          <span class="cat-badge cat-${p.category}">${CAT_ICONS[p.category]} ${p.category}</span>
          <span class="estado-badge eb-${p.status}">${ESTADO_LABELS[p.status]}</span>
        </div>
      </div>`).join("");
  },

  // ── Camión ───────────────────────────────────────────────────────

  renderCamion({ truck, size, max, pct }) {
    // Slots visuales
    _el("truck-slots").innerHTML = Array.from({ length: 5 }, (_, i) => {
      const p   = truck[i];
      const cls = !p ? "truck-slot" : i === 0 ? "truck-slot tope" : "truck-slot filled";
      return p
        ? `<div class="${cls}"><div class="slot-ico">${CAT_ICONS[p.category]}</div><div class="slot-id">${p.id}${i === 0 ? " ▲" : ""}</div></div>`
        : `<div class="${cls}"><div class="slot-ico" style="opacity:.2">📦</div><div class="slot-id" style="opacity:.2">Vacío</div></div>`;
    }).join("");

    // Barra de capacidad
    const fill = _el("cap-fill");
    fill.style.width = (pct * 100) + "%";
    fill.className   = "cap-fill " + (pct < .4 ? "low" : pct < .8 ? "mid" : pct < 1 ? "high" : "full");
    _el("truck-cap-txt").textContent = `${size} / ${max} paquetes`;

    // Lista detallada
    const el = _el("lista-camion");
    if (!truck.length) { el.innerHTML = _empty("🚛", "Camión vacío"); return; }

    el.innerHTML = truck.map((p, i) => `
      <div class="pkg-card status-${p.status}">
        <div style="font-family:var(--mono);font-size:10px;min-width:46px;text-align:center;color:${i === 0 ? "var(--amz)" : "var(--t3)"}">
          ${i === 0 ? "TOPE" : `▼ ${i + 1}`}
        </div>
        <div class="pkg-info">
          <div class="pkg-id">${p.id}</div>
          <div class="pkg-name">${p.recipient}</div>
          <div class="pkg-meta">${p.description} · ${p.weight}kg</div>
        </div>
        <div class="pkg-right">
          <span class="cat-badge cat-${p.category}">${CAT_ICONS[p.category]} ${p.category}</span>
          <span class="estado-badge eb-${p.status}">${ESTADO_LABELS[p.status]}</span>
        </div>
      </div>`).join("");
  },

  // ── En camino ────────────────────────────────────────────────────

  renderEnCamino(packages) {
    const divider = _el("div-en-camino");
    const el      = _el("lista-en-camino");

    if (!packages.length) {
      divider.style.display = "none";
      el.innerHTML = "";
      return;
    }

    divider.style.display = "flex";
    el.innerHTML = packages.map(p => `
      <div class="pkg-card status-${p.status}">
        <div class="pkg-info">
          <div class="pkg-id">${p.id}</div>
          <div class="pkg-name">${p.recipient}</div>
          <div class="pkg-meta">${p.description} · ${p.address} · Tel: ${p.phone}</div>
        </div>
        <div class="pkg-right">
          <span class="estado-badge eb-${p.status}">🚚 En camino</span>
          <button class="btn btn-green btn-sm" onclick="App.abrirModalEntrega('${p.id}')">✓ Entregar</button>
        </div>
      </div>`).join("");
  },

  // ── Almacén ──────────────────────────────────────────────────────

  renderAlmacen(warehouse) {
    const cats = ["electronica", "ropa", "alimentos", "juguetes", "libros"];
    _el("almacen-grid").innerHTML = cats.map((cat, idx) => {
      const items = warehouse[cat] || [];
      return `
        <div class="pasillo">
          <div class="pasillo-head">
            <span class="cat-badge cat-${cat}">${CAT_ICONS[cat]} ${cat}</span>
            <span class="pasillo-count">Pasillo [${idx}] · ${items.length}</span>
          </div>
          <div class="pasillo-body">
            ${items.length === 0
              ? '<div class="pasillo-empty">— vacío —</div>'
              : items.map(p => `
                  <div class="pasillo-pkg">
                    <span style="color:var(--amz)">${p.id}</span>
                    <span style="color:var(--t2)">${p.recipient.split(" ")[0]}</span>
                    <span class="estado-badge eb-${p.status}" style="font-size:8px">${ESTADO_LABELS[p.status]}</span>
                  </div>`).join("")}
          </div>
        </div>`;
    }).join("");
  },

  // ── Tracking ─────────────────────────────────────────────────────

  renderTracking(pkg) {
    const el    = _el("track-result");
    const steps = ["en_cola", "en_camion", "en_camino", "entregado"];
    const cur   = steps.indexOf(pkg.status);
    const stepIcons = { en_cola: "📥", en_camion: "🚛", en_camino: "📍", entregado: "✅" };

    const tlHTML = steps.map((s, i) => `
      ${i > 0 ? `<div class="tl-line ${i <= cur ? "done" : ""}"></div>` : ""}
      <div class="tl-step">
        <div class="tl-dot ${i < cur ? "done" : i === cur ? "active" : ""}">${stepIcons[s]}</div>
        <div class="tl-label">${ESTADO_LABELS[s]}</div>
      </div>`).join("");

    const deliverBtn = pkg.status === "en_camino"
      ? `<button class="btn btn-green btn-sm" style="margin-top:10px" onclick="App.abrirModalEntrega('${pkg.id}')">✓ Confirmar entrega</button>`
      : "";

    el.innerHTML = `
      <div class="tracking-result">
        <div class="tr-header">
          <div>
            <div class="tr-id">${pkg.id}</div>
            <div class="tr-dest">${pkg.recipient}</div>
            <div class="tr-sub">${pkg.description} · ${pkg.weight}kg · ${pkg.priority}</div>
            <div class="tr-sub" style="margin-top:4px">📍 ${pkg.address}</div>
            <div class="tr-sub">📞 ${pkg.phone}</div>
          </div>
          <div style="text-align:right">
            <span class="estado-badge eb-${pkg.status}" style="font-size:11px">${ESTADO_LABELS[pkg.status]}</span><br/>
            <span class="cat-badge cat-${pkg.category}" style="margin-top:8px;display:inline-block">${CAT_ICONS[pkg.category]} ${pkg.category}</span>
            ${deliverBtn}
          </div>
        </div>
        <div class="timeline">${tlHTML}</div>
        <div class="section-divider"><span>Historial de eventos</span></div>
        <div class="tr-events">
          ${[...pkg.events].reverse().map(e => `
            <div class="tr-event">
              <div class="tr-event-dot" style="background:${EVENT_COLORS[e.type] || "var(--cyan)"}"></div>
              <div>
                <div class="tr-event-msg">${e.message}</div>
                <div class="tr-event-time">${_formatDate(e.timestamp)}</div>
              </div>
            </div>`).join("")}
        </div>
      </div>`;
  },

  // ── Historial ─────────────────────────────────────────────────────

  renderHistorial(packages) {
    const el = _el("lista-historial");
    if (!packages.length) { el.innerHTML = _empty("📋", "Sin paquetes"); return; }

    el.innerHTML = packages.map(p => `
      <div class="pkg-card status-${p.status} clickable" onclick="App.goTrack('${p.id}')">
        <div class="pkg-info">
          <div class="pkg-id">${p.id} ${PRIO_ICONS[p.priority] || ""}</div>
          <div class="pkg-name">${p.recipient}</div>
          <div class="pkg-meta">${p.description} · ${p.address} · ${p.weight}kg</div>
        </div>
        <div class="pkg-right">
          <span class="cat-badge cat-${p.category}">${CAT_ICONS[p.category]} ${p.category}</span>
          <span class="estado-badge eb-${p.status}">${ESTADO_LABELS[p.status]}</span>
          ${p.status === "en_camino"
            ? `<button class="btn btn-green btn-sm" onclick="event.stopPropagation();App.abrirModalEntrega('${p.id}')">✓ Entregar</button>`
            : ""}
        </div>
      </div>`).join("");
  },

  // ── Modal de entrega ─────────────────────────────────────────────

  renderModalPkg(pkg) {
    _el("modal-sub").textContent   = `Entrega a: ${pkg.recipient} — ${pkg.address}`;
    _el("modal-pkg-info").innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--amz)">${pkg.id}</div>
          <div style="font-size:15px;font-weight:700;margin:4px 0">${pkg.description}</div>
          <div style="font-size:11px;color:var(--t3);font-family:var(--mono)">${pkg.weight}kg · ${pkg.priority} · Tel: ${pkg.phone}</div>
        </div>
        <span class="cat-badge cat-${pkg.category}">${CAT_ICONS[pkg.category]} ${pkg.category}</span>
      </div>`;
  },

  // ── Stats de topbar ───────────────────────────────────────────────

  updateStats(stats) {
    _el("ts-cola").textContent       = stats.queue_size;
    _el("ts-camion").textContent     = stats.truck_size;
    _el("ts-camino").textContent     = stats.on_route;
    _el("ts-entregados").textContent = stats.delivered;
    _el("nb-cola").textContent       = stats.queue_size;
    _el("nb-camion").textContent     = stats.truck_size;
  },

  // ── Log / Terminal ────────────────────────────────────────────────

  log(msg, type = "info") {
    const el  = _el("log-entries");
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = `<div class="log-t">${new Date().toLocaleTimeString()}</div>${msg}`;
    el.prepend(div);
  },

  clearLog() { _el("log-entries").innerHTML = ""; },

  // ── Toast ─────────────────────────────────────────────────────────

  toast(msg, type = "info") {
    const el = _el("toast");
    el.textContent = msg;
    el.className   = `show ${type}`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => (el.className = ""), 3000);
  },

};

// ── Helpers internos ─────────────────────────────────────────────────

function _el(id)       { return document.getElementById(id); }
function _empty(ico, txt) {
  return `<div class="empty-state"><span class="empty-ico">${ico}</span><span class="empty-txt">${txt}</span></div>`;
}
function _formatDate(iso) {
  try { return new Date(iso).toLocaleString(); }
  catch { return iso; }
}
