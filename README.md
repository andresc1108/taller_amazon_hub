
## Descripción

Simulador de un centro de distribución tipo Amazon Hub que implementa las tres
estructuras de datos principales:

| Estructura | Uso en el sistema |
|---|---|
| **Cola (FIFO)** | Recepción de pedidos en orden de llegada |
| **Pila (LIFO)** | Gestión de carga en el camión de entrega |
| **Array** | Inventario de estanterías fijas por categoría |

---

## Estructura del proyecto

```
amazon_hub/
│
├── app.py                      ← Servidor Flask (API REST)
├── requirements.txt
│
├── backend/
│   ├── models/
│   │   └── paquete.py          ← Clase Paquete
│   └── structures/
│       ├── cola.py             ← Cola FIFO
│       ├── pila.py             ← Pila LIFO
│       └── almacen.py          ← Array de pasillos
│
└── frontend/
    ├── index.html              ← Interfaz principal
    ├── css/
    │   └── styles.css          ← Estilos
    └── js/
        ├── api.js              ← Comunicación con la API
        ├── ui.js               ← Renderizado de componentes
        └── app.js              ← Controlador principal
```

---

## Instalación y ejecución

### 1. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 2. Ejecutar el servidor
```bash
python app.py
```

### 3. Abrir en el navegador
```
http://localhost:5000
```

---

## Flujo completo de un paquete

```
[Recibir Pedido]
      ↓
  Cola FIFO          ← Almacén (array)
      ↓
[Cargar al camión]
      ↓
  Pila LIFO (LIFO: último en entrar, primero en entregarse)
      ↓
[Salir a ruta]
      ↓
  En camino
      ↓
[Confirmar entrega + firma digital]
      ↓
  Entregado ✓
```

---

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/paquetes` | Registrar nuevo paquete |
| `GET`  | `/api/paquetes/:id` | Ver paquete con historial |
| `GET`  | `/api/cola` | Estado de la cola |
| `POST` | `/api/cola/despachar` | Cargar paquete al camión |
| `POST` | `/api/camion/salir_ruta` | Enviar camión a ruta |
| `POST` | `/api/entregar/:id` | Confirmar entrega |
| `GET`  | `/api/almacen` | Ver inventario completo |
| `GET`  | `/api/stats` | Estadísticas generales |
