from backend.models.paquete import Paquete


class Almacen:
    """
    Warehouse with fixed array aisles, one per product category.
    Each index in the array represents a physical aisle in the warehouse.
    """

    CATEGORIES: list[str] = ["electronica", "ropa", "alimentos", "juguetes", "libros"]

    def __init__(self):
        # Fixed-size array: each position maps to a category aisle
        self._aisles: list[list[Paquete]] = [[] for _ in self.CATEGORIES]

    # ── Operaciones principales ─────────────────────────────────────

    def store(self, package: Paquete) -> bool:
        """
        Stores a package in the correct aisle based on its category.
        Returns False if the category is not recognized.
        """
        index = self._get_index(package.category)
        if index == -1:
            return False
        self._aisles[index].append(package)
        return True

    def find_by_id(self, pkg_id: str) -> dict | None:
        """
        Searches all aisles for a package by ID.
        Returns a dict with the package and aisle info, or None.
        """
        for i, aisle in enumerate(self._aisles):
            for pkg in aisle:
                if pkg.id == pkg_id:
                    return {
                        "package": pkg,
                        "aisle":   self.CATEGORIES[i],
                        "index":   i
                    }
        return None

    # ── Consultas ───────────────────────────────────────────────────

    def get_aisle(self, category: str) -> list[Paquete]:
        """Returns all packages in a given category aisle."""
        index = self._get_index(category)
        return self._aisles[index] if index != -1 else []

    @property
    def total(self) -> int:
        """Total number of packages stored across all aisles."""
        return sum(len(a) for a in self._aisles)

    def to_dict(self) -> dict:
        """Returns the full warehouse inventory as a serializable dict."""
        return {
            cat: [p.to_dict() for p in self._aisles[i]]
            for i, cat in enumerate(self.CATEGORIES)
        }

    # ── Helpers ─────────────────────────────────────────────────────

    def _get_index(self, category: str) -> int:
        """Returns the aisle index for a given category, or -1 if not found."""
        try:
            return self.CATEGORIES.index(category.lower())
        except ValueError:
            return -1

    def __repr__(self) -> str:
        return f"Almacen(total={self.total}, pasillos={len(self.CATEGORIES)})"
