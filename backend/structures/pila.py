from backend.models.paquete import Paquete


class Pila:
    """
    LIFO stack representing the delivery truck.
    The last package loaded is the first to be delivered.
    """

    def __init__(self, max_capacity: int = 5):
        self._items: list[Paquete] = []
        self.max_capacity = max_capacity

    # ── Operaciones principales ─────────────────────────────────────

    def push(self, package: Paquete) -> bool:
        """
        Pushes a package onto the top of the stack.
        Returns False if the truck is already at full capacity.
        """
        if self.is_full:
            return False
        self._items.append(package)
        return True

    def pop(self) -> Paquete | None:
        """Removes and returns the top package (LIFO). Returns None if empty."""
        return self._items.pop() if self._items else None

    def pop_all(self) -> list[Paquete]:
        """Removes and returns all packages (used when the truck leaves for a route)."""
        packages = list(reversed(self._items))  # top first
        self._items.clear()
        return packages

    def clear(self) -> None:
        """Empties the stack."""
        self._items.clear()

    # ── Consultas ───────────────────────────────────────────────────

    @property
    def size(self) -> int:
        return len(self._items)

    @property
    def is_empty(self) -> bool:
        return len(self._items) == 0

    @property
    def is_full(self) -> bool:
        return len(self._items) >= self.max_capacity

    @property
    def capacity_pct(self) -> float:
        """Returns current capacity as a percentage (0.0 – 1.0)."""
        return self.size / self.max_capacity

    def to_list(self) -> list[dict]:
        """Returns all packages as a serializable list (top → bottom)."""
        return [p.to_dict() for p in reversed(self._items)]

    def __repr__(self) -> str:
        return f"Pila(size={self.size}/{self.max_capacity})"
