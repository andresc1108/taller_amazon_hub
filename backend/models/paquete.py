from datetime import datetime


class Paquete:
    """Represents a package in the distribution center."""

    VALID_CATEGORIES = ["electronica", "ropa", "alimentos", "juguetes", "libros"]
    VALID_PRIORITIES  = ["normal", "express", "fragil"]

    def __init__(self, pkg_id: str, recipient: str, phone: str,
                 address: str, category: str, weight: float,
                 description: str, priority: str = "normal"):

        self.id          = pkg_id
        self.recipient   = recipient
        self.phone       = phone
        self.address     = address
        self.category    = category
        self.weight      = weight
        self.description = description
        self.priority    = priority
        self.status      = "en_cola"
        self.created_at  = datetime.now()
        self.events: list[dict] = []

        # Primer evento al registrar el paquete
        self._add_event("Pedido recibido en el centro de distribución", "ok")

    # ── Métodos de negocio ──────────────────────────────────────────

    def _add_event(self, message: str, event_type: str = "info") -> None:
        """Adds a tracking event to the package history."""
        self.events.append({
            "message":    message,
            "type":       event_type,
            "timestamp":  datetime.now().isoformat()
        })

    def update_status(self, new_status: str, event_message: str) -> None:
        """Updates the package status and logs the event."""
        self.status = new_status
        self._add_event(event_message, "ok")

    # ── Serialización ───────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Converts the package to a JSON-serializable dictionary."""
        return {
            "id":          self.id,
            "recipient":   self.recipient,
            "phone":       self.phone,
            "address":     self.address,
            "category":    self.category,
            "weight":      self.weight,
            "description": self.description,
            "priority":    self.priority,
            "status":      self.status,
            "created_at":  self.created_at.isoformat(),
            "events":      self.events,
        }

    def __repr__(self) -> str:
        return (f"Paquete(id={self.id!r}, destinatario={self.recipient!r}, "
                f"estado={self.status!r})")
