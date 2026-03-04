"""
Servidor Flask — Amazon Hub Distribution Center
API REST que conecta el frontend con las estructuras de datos del backend.
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from typing import Optional
import os

from backend.models.paquete       import Paquete
from backend.structures.cola      import Cola
from backend.structures.pila      import Pila
from backend.structures.almacen   import Almacen

# ── Inicialización ───────────────────────────────────────────────────
app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app)

# Estructuras de datos globales
cola    = Cola()
camion  = Pila(max_capacity=5)
almacen = Almacen()

# Registro completo de todos los paquetes del sistema
todos: dict[str, Paquete] = {}

# Paquetes actualmente en ruta de entrega
en_camino: dict[str, Paquete] = {}

# Contador de IDs
_id_counter = 1


def _next_id() -> str:
    global _id_counter
    pkg_id = f"PKG-{str(_id_counter).zfill(3)}"
    _id_counter += 1
    return pkg_id


def _error(msg: str, code: int = 400):
    return jsonify({"ok": False, "error": msg}), code


def _ok(data: Optional[dict] = None):
    return jsonify({"ok": True, **(data or {})})


# ══════════════════════════════════════════════════════════════════════
# RUTAS — FRONTEND
# ══════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    """Sirve el frontend principal."""
    return send_from_directory("frontend", "index.html")


# ══════════════════════════════════════════════════════════════════════
# RUTAS — PAQUETES
# ══════════════════════════════════════════════════════════════════════

@app.route("/api/paquetes", methods=["POST"])
def recibir_paquete():
    """
    Recibe un nuevo paquete, lo agrega a la cola y al almacén.
    Body JSON: recipient, phone, address, category, weight, description, priority
    """
    data = request.get_json(silent=True) or {}
    required = ["recipient", "phone", "address", "category", "weight", "description"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return _error(f"Campos requeridos: {', '.join(missing)}")

    try:
        weight = float(data["weight"])
        if weight <= 0:
            raise ValueError
    except ValueError:
        return _error("El peso debe ser un número positivo")

    if data["category"] not in Paquete.VALID_CATEGORIES:
        return _error(f"Categoría inválida. Válidas: {Paquete.VALID_CATEGORIES}")

    pkg = Paquete(
        pkg_id      = _next_id(),
        recipient   = data["recipient"],
        phone       = data["phone"],
        address     = data["address"],
        category    = data["category"],
        weight      = weight,
        description = data["description"],
        priority    = data.get("priority", "normal"),
    )

    cola.enqueue(pkg)
    almacen.store(pkg)
    todos[pkg.id] = pkg

    return _ok({"package": pkg.to_dict()}), 201


@app.route("/api/paquetes/<pkg_id>", methods=["GET"])
def get_paquete(pkg_id: str):
    """Retorna los datos y el historial de un paquete por su ID."""
    pkg = todos.get(pkg_id.upper())
    if not pkg:
        return _error("Paquete no encontrado", 404)
    return _ok({"package": pkg.to_dict()})


@app.route("/api/paquetes", methods=["GET"])
def listar_paquetes():
    """Retorna todos los paquetes, con filtro opcional por estado."""
    estado = request.args.get("estado")
    pkgs   = list(todos.values())
    if estado:
        pkgs = [p for p in pkgs if p.status == estado]
    return _ok({"packages": [p.to_dict() for p in pkgs]})


# ══════════════════════════════════════════════════════════════════════
# RUTAS — COLA
# ══════════════════════════════════════════════════════════════════════

@app.route("/api/cola", methods=["GET"])
def ver_cola():
    """Retorna los paquetes actuales en la cola de recepción."""
    return _ok({"queue": cola.to_list(), "size": cola.size})


@app.route("/api/cola/despachar", methods=["POST"])
def despachar_de_cola():
    """
    Saca el primer paquete de la cola (FIFO) y lo carga al camión (Pila).
    """
    if cola.is_empty:
        return _error("La cola está vacía")
    if camion.is_full:
        return _error("El camión está lleno (máx 5 paquetes)")

    pkg = cola.dequeue()
    if not camion.push(pkg):
        cola.enqueue(pkg)           # revertir si no se pudo cargar
        return _error("No se pudo cargar al camión")

    pkg.update_status("en_camion", "Cargado al camión de entrega")
    return _ok({"package": pkg.to_dict(), "truck_size": camion.size})


@app.route("/api/cola/vaciar", methods=["DELETE"])
def vaciar_cola():
    """Vacía toda la cola de recepción."""
    count = cola.size
    cola.clear()
    return _ok({"deleted": count})


# ══════════════════════════════════════════════════════════════════════
# RUTAS — CAMIÓN (PILA)
# ══════════════════════════════════════════════════════════════════════

@app.route("/api/camion", methods=["GET"])
def ver_camion():
    """Retorna el contenido actual del camión (pila LIFO)."""
    return _ok({
        "truck":    camion.to_list(),
        "size":     camion.size,
        "max":      camion.max_capacity,
        "is_full":  camion.is_full,
        "pct":      camion.capacity_pct
    })


@app.route("/api/camion/salir_ruta", methods=["POST"])
def salir_a_ruta():
    """
    El camión sale a ruta: todos los paquetes pasan a estado 'en_camino'.
    """
    if camion.is_empty:
        return _error("El camión está vacío")

    packages = camion.pop_all()
    for pkg in packages:
        pkg.update_status("en_camino", "Camión salió a ruta de entrega")
        en_camino[pkg.id] = pkg

    return _ok({
        "dispatched": [p.to_dict() for p in packages],
        "count":      len(packages)
    })


@app.route("/api/camion/vaciar", methods=["DELETE"])
def vaciar_camion():
    """Vacía el camión manualmente (cancelación de ruta)."""
    count = camion.size
    camion.clear()
    return _ok({"cleared": count})


# ══════════════════════════════════════════════════════════════════════
# RUTAS — EN CAMINO / ENTREGA
# ══════════════════════════════════════════════════════════════════════

@app.route("/api/en_camino", methods=["GET"])
def ver_en_camino():
    """Retorna los paquetes que están actualmente en ruta."""
    return _ok({"on_route": [p.to_dict() for p in en_camino.values()]})


@app.route("/api/entregar/<pkg_id>", methods=["POST"])
def confirmar_entrega(pkg_id: str):
    """
    Confirma la entrega de un paquete al destinatario.
    Registra el evento y actualiza el estado a 'entregado'.
    """
    pkg = en_camino.get(pkg_id.upper())
    if not pkg:
        return _error("Paquete no está en ruta o no existe", 404)

    pkg.update_status(
        "entregado",
        f"Entregado a {pkg.recipient} — firma digital registrada"
    )
    del en_camino[pkg.id]

    return _ok({"package": pkg.to_dict()})


# ══════════════════════════════════════════════════════════════════════
# RUTAS — ALMACÉN
# ══════════════════════════════════════════════════════════════════════

@app.route("/api/almacen", methods=["GET"])
def ver_almacen():
    """Retorna el inventario completo del almacén agrupado por pasillo."""
    return _ok({"warehouse": almacen.to_dict(), "total": almacen.total})


@app.route("/api/almacen/buscar/<pkg_id>", methods=["GET"])
def buscar_en_almacen(pkg_id: str):
    """Busca un paquete en el almacén por su ID."""
    result = almacen.find_by_id(pkg_id.upper())
    if not result:
        return _error("Paquete no encontrado en el almacén", 404)
    return _ok({
        "package": result["package"].to_dict(),
        "aisle":   result["aisle"],
        "index":   result["index"]
    })


# ══════════════════════════════════════════════════════════════════════
# RUTAS — ESTADÍSTICAS
# ══════════════════════════════════════════════════════════════════════

@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Retorna las estadísticas generales del centro de distribución."""
    delivered = sum(1 for p in todos.values() if p.status == "entregado")
    return _ok({
        "queue_size":    cola.size,
        "truck_size":    camion.size,
        "on_route":      len(en_camino),
        "delivered":     delivered,
        "total_stored":  almacen.total,
        "total_pkgs":    len(todos),
    })


# ══════════════════════════════════════════════════════════════════════
# PUNTO DE ENTRADA
# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("="*55)
    print("  Amazon Hub — Centro de Distribución")
    print("  Servidor corriendo en: http://localhost:5000")
    print("="*55)
    app.run(debug=True, port=5000)