from collections import deque
from backend.models.paquete import Paquete


class Cola:
    """
    FIFO queue for package reception.
    The first package to arrive is the first to be dispatched.
    """

    def __init__(self):
        self._items: deque[Paquete] = deque()

    # ── Operaciones principales ─────────────────────────────────────

    def enqueue(self, package: Paquete) -> None:
        """Adds a package to the back of the queue."""
        self._items.append(package)

    def dequeue(self) -> Paquete | None:
        """Removes and returns the front package. Returns None if empty."""
        return self._items.popleft() if self._items else None

    def clear(self) -> None:
        """Empties the queue."""
        self._items.clear()

    # ── Consultas ───────────────────────────────────────────────────

    @property
    def size(self) -> int:
        return len(self._items)

    @property
    def is_empty(self) -> bool:
        return len(self._items) == 0

    def to_list(self) -> list[dict]:
        """Returns all packages as a serializable list (front → back)."""
        return [p.to_dict() for p in self._items]

    def __repr__(self) -> str:
        return f"Cola(size={self.size})"
