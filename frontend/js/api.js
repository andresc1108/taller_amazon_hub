/**
 * api.js
 * Módulo encargado de toda la comunicación con la API REST del backend.
 * Cada función retorna la respuesta JSON del servidor.
 */

const API_BASE = "http://localhost:5000/api";

const API = {

  // ── Paquetes ──────────────────────────────────────────────────────

  /** Registra un nuevo paquete en el sistema. */
  async recibirPaquete(data) {
    return _post("/paquetes", data);
  },

  /** Retorna un paquete por su ID junto con su historial de eventos. */
  async getPaquete(id) {
    return _get(`/paquetes/${id}`);
  },

  /** Retorna todos los paquetes, con filtro opcional por estado. */
  async listarPaquetes(estado = null) {
    const qs = estado ? `?estado=${estado}` : "";
    return _get(`/paquetes${qs}`);
  },

  // ── Cola ─────────────────────────────────────────────────────────

  /** Retorna el estado actual de la cola de recepción. */
  async getCola() {
    return _get("/cola");
  },

  /** Saca el primer paquete de la cola y lo carga al camión. */
  async despacharDeCola() {
    return _post("/cola/despachar");
  },

  /** Vacía toda la cola de recepción. */
  async vaciarCola() {
    return _delete("/cola/vaciar");
  },

  // ── Camión ───────────────────────────────────────────────────────

  /** Retorna el estado actual del camión. */
  async getCamion() {
    return _get("/camion");
  },

  /** Envía el camión a ruta: todos los paquetes pasan a 'en_camino'. */
  async salirRuta() {
    return _post("/camion/salir_ruta");
  },

  /** Vacía el camión manualmente. */
  async vaciarCamion() {
    return _delete("/camion/vaciar");
  },

  // ── En camino ────────────────────────────────────────────────────

  /** Retorna los paquetes actualmente en ruta de entrega. */
  async getEnCamino() {
    return _get("/en_camino");
  },

  /** Confirma la entrega de un paquete al destinatario. */
  async confirmarEntrega(id) {
    return _post(`/entregar/${id}`);
  },

  // ── Almacén ──────────────────────────────────────────────────────

  /** Retorna el inventario completo del almacén. */
  async getAlmacen() {
    return _get("/almacen");
  },

  /** Busca un paquete en el almacén por ID. */
  async buscarEnAlmacen(id) {
    return _get(`/almacen/buscar/${id}`);
  },

  // ── Estadísticas ─────────────────────────────────────────────────

  /** Retorna las estadísticas generales del centro de distribución. */
  async getStats() {
    return _get("/stats");
  },

};

// ── Helpers internos ─────────────────────────────────────────────────

async function _get(endpoint) {
  try {
    const res = await fetch(API_BASE + endpoint);
    return await res.json();
  } catch {
    return { ok: false, error: "Sin conexión con el servidor" };
  }
}

async function _post(endpoint, body = {}) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { ok: false, error: "Sin conexión con el servidor" };
  }
}

async function _delete(endpoint) {
  try {
    const res = await fetch(API_BASE + endpoint, { method: "DELETE" });
    return await res.json();
  } catch {
    return { ok: false, error: "Sin conexión con el servidor" };
  }
}
