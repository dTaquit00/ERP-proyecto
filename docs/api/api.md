# API REST — v1

Base: **`/api/v1`** · Formato: JSON · Codificación UTF-8.

## Convención de respuestas

Éxito:

```json
{ "data": { } }
```

Listado paginado:

```json
{ "data": { "items": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } } }
```

Error:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Los datos proporcionados no son válidos", "details": [ { "path": "email", "message": "Correo electrónico inválido" } ] } }
```

### Códigos HTTP

| Código | Uso |
|---|---|
| 200 | Éxito |
| 201 | Recurso creado |
| 400 | Validación (`VALIDATION_ERROR`) o regla (`INVALID_RESET_TOKEN`, `ROLE_NOT_FOUND`, `SELF_DEACTIVATE`, `CATEGORY_NOT_FOUND`, `WAREHOUSE_NOT_FOUND`, `PRODUCT_NOT_FOUND`) |
| 401 | No autenticado (`MISSING_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `INVALID_CREDENTIALS`, `SESSION_INVALID`, `REFRESH_TOKEN_MISSING`) |
| 403 | Sin permisos (`INSUFFICIENT_PERMISSIONS`, `ACCOUNT_DISABLED`, `CURRENT_PASSWORD_INVALID`) |
| 404 | `NOT_FOUND` (también recurso de otra empresa: no se filtra su existencia) |
| 409 | `CONFLICT` / `DUPLICATE` / `EMAIL_IN_USE` / `ROLE_NAME_IN_USE` / `SYSTEM_ROLE` / `ROLE_IN_USE` / `LAST_ACTIVE_ADMIN` / `NAME_IN_USE` / `SKU_IN_USE` / `WAREHOUSE_DISABLED` / `INSUFFICIENT_STOCK` |
| 422 | Regla de negocio no procesable (reservado) |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` (mensaje genérico; detalle solo en log) |

### Autenticación

`Authorization: Bearer <accessToken>` en todos los endpoints protegidos.

El **refresh token** viaja en cookie `httpOnly` (`Path=/api/v1/auth`), no en el cuerpo.
El cliente debe enviar `credentials: 'include'` (CORS está configurado con `credentials: true`).

---

## Health

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | no | Estado: `{ status: ok\|degraded, database, uptimeSeconds, timestamp }` (sin rate limit) |

---

## M01 — Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/login` | no | Login. Body `{email, password}` → `{user, accessToken, expiresIn}` + cookie refresh. |
| POST | `/auth/refresh` | cookie | Rota el refresh token y emite un access token nuevo. |
| POST | `/auth/logout` | cookie | Revoca la sesión (idempotente) y limpia la cookie. |
| GET | `/auth/me` | Bearer | Usuario autenticado + permisos del rol. |
| POST | `/auth/change-password` | Bearer | `{currentPassword, newPassword}`. Revoca las demás sesiones. |
| POST | `/auth/request-password-reset` | no | `{email}` → siempre 200. Solo fuera de producción devuelve `resetToken`. |
| POST | `/auth/reset-password` | no | `{token, newPassword}` → un solo uso; revoca todas las sesiones. |

### Ejemplo — login

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "admin@demo.local", "password": "..." }
```

```json
{
  "data": {
    "user": {
      "id": "665f...",
      "email": "admin@demo.local",
      "firstName": "Admin",
      "lastName": "Sistema",
      "companyId": "665e...",
      "roleId": "665f...",
      "roleName": "administrador",
      "permissions": ["users.read", "sales.write"],
      "isActive": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

Respuesta fallida:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Correo o contraseña incorrectos" } }
```

> El `refreshToken` no aparece en el cuerpo: viaja en cookie `Set-Cookie: refreshToken=...; HttpOnly; Path=/api/v1/auth`.

---

## M02 — Usuarios

Todos exigen `Authorization: Bearer` y RBAC en backend. Scope: siempre la empresa del token.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/users` | `users.read` | Listado paginado `{items, meta}`. Query: `page, limit, search, roleId, status(active\|inactive), sort(email\|firstName\|lastName\|createdAt\|lastLoginAt), order(asc\|desc)`. Incluye `roleName`; nunca `passwordHash`. |
| POST | `/users` | `users.write` | Crea usuario. Body `{email, password, firstName, lastName, roleId, isActive?}` → 201. Errores: 409 `EMAIL_IN_USE`, 400 `ROLE_NOT_FOUND`. |
| GET | `/users/:id` | `users.read` | Detalle con rol. Otra empresa o inexistente → 404. |
| PATCH | `/users/:id` | `users.write` | Edita `email/firstName/lastName/roleId`. Body no vacío (400). Sin borrado físico. |
| POST | `/users/:id/activate` | `users.write` | Reactiva (login vuelve a funcionar). |
| POST | `/users/:id/deactivate` | `users.write` | Desactiva. 400 `SELF_DEACTIVATE` (a uno mismo), 409 `LAST_ACTIVE_ADMIN` (último admin activo). |
| GET | `/users/:id/history` | `users.read` | `{userId, createdAt, lastLoginAt, passwordChangedAt, sessions[]}` — fechas reales + sesiones recientes (sin tokens). |

---

## M03 — Roles y permisos

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/roles` | `roles.read` | Listado paginado con `userCount` por rol. Orden por nombre. |
| GET | `/roles/:id` | `roles.read` | Detalle con `userCount`. Otra empresa → 404. |
| POST | `/roles` | `roles.write` | Crea rol. Body `{name(minúsculas/numérico/guiones), displayName, permissions[]}` → 201. 409 `ROLE_NAME_IN_USE`, 400 permiso fuera de catálogo. |
| PATCH | `/roles/:id` | `roles.write` | Edita `displayName` y `permissions`. El `name` no es editable (identificador inmutable). |
| DELETE | `/roles/:id` | `roles.write` | 200 `{id, deleted:true}`. 409 `SYSTEM_ROLE` (rol del sistema), 409 `ROLE_IN_USE` (asignado a usuarios). |
| GET | `/permissions` | `roles.read` | Catálogo completo `{permissions[]}` para el editor de roles del frontend. |

> Los 7 roles del sistema (`administrador, gerente, vendedor, almacen, compras, finanzas, auditor`)
> se crean idempotentemente por empresa vía `rolesService.ensureSystemRoles` (seed y pruebas).

---

## M06 — Categorías

Todos exigen `Authorization: Bearer` y RBAC en backend. Scope: siempre la empresa del token.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/categories` | `categories.read` | Listado paginado `{items, meta}` con `productCount`. Query: `page, limit, search(nombre/descripción), status(active\|inactive), sort(name\|createdAt\|updatedAt), order(asc\|desc)`. |
| GET | `/categories/:id` | `categories.read` | Detalle con `productCount`. Otra empresa o inexistente → 404. |
| POST | `/categories` | `categories.write` | `{name(2–80), description?}` → 201. 409 `NAME_IN_USE` (nombre único por empresa). |
| PATCH | `/categories/:id` | `categories.write` | Edita `name/description/isActive`. Body no vacío (400). Renombrarse a sí mismo no es duplicado. |

> Sin borrado físico: la baja es `PATCH {"isActive": false}` (M06 pide "desactivar").
> `productCount` se calcula agregando `products` (una sola consulta por petición).

---

## M07 — Productos

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/products` | `products.read` | Listado paginado con `categoryName`. Query: `page, limit, search(nombre/sku/código/barras), categoryId, status(active\|inactive), sort(sku\|name\|purchasePrice\|salePrice\|createdAt\|updatedAt), order`. |
| GET | `/products/:id` | `products.read` | Detalle con precios e impuestos. Otra empresa → 404. |
| POST | `/products` | `products.write` | `{sku, name, categoryId, purchasePrice, salePrice, unit, code?, description?, taxes?, isActive?, image?, barcode?}` → 201. |
| PATCH | `/products/:id` | `products.write` | Edita cualquier campo permitido; `sku` y `categoryId` se revalidan. Body no vacío (400). |

Reglas de negocio:

- **SKU único por empresa**, normalizado a mayúsculas → 409 `SKU_IN_USE`.
- `categoryId` debe existir **en la misma empresa** → 400 `CATEGORY_NOT_FOUND`.
- Precios ≥ 0; `taxes[]` con `rate` 0–100; `image` debe ser URL.
- Estado: `PATCH {"isActive": false}` (sin `DELETE`).

```http
POST /api/v1/products
{ "sku": "sku-001", "name": "Teclado mecánico", "categoryId": "665f...",
  "purchasePrice": 100.5, "salePrice": 150, "unit": "pza",
  "taxes": [{ "name": "IVA", "rate": 16 }] }
```

```json
{ "data": { "id": "6660...", "sku": "SKU-001", "categoryName": "General",
  "purchasePrice": 100.5, "salePrice": 150, "taxes": [{ "name": "IVA", "rate": 16 }],
  "isActive": true } }
```

---

## M08 — Clientes

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/customers` | `customers.read` | Listado paginado. Query: `page, limit, search(nombre/correo), status(active\|inactive), sort(name\|email\|createdAt\|updatedAt), order`. |
| GET | `/customers/:id` | `customers.read` | Detalle con `address` (subdocumento). Otra empresa → 404. |
| POST | `/customers` | `customers.write` | `{name(2–120), email?, phone?, dni?, address?{street?,city?,state?,zipCode?}, notes?, isActive?}` → 201. |
| PATCH | `/customers/:id` | `customers.write` | Edita campos individuales; body sin campos → 400. Baja: `{"isActive": false}`. |

> **Sin unicidad** de nombre/correo/DNI (decisión de negocio: se admiten clientes repetidos).
> **Sin DELETE**: la baja es `PATCH {"isActive": false}` (DELETE → 404, probado).
> **Limpieza de opcionales (diseño B)**: en PATCH, `''`, solo espacios o `null`
> significan "borrar" y se persisten como `null` (`undefined` = no tocar el campo).
> En POST lo en blanco se trata como campo ausente.
> `address` en PATCH se **reemplaza completa** (envía todos los campos que quieras conservar).

---

## M09 — Proveedores

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/suppliers` | `suppliers.read` | Listado paginado. Query: `page, limit, search(nombre/contacto/ruc), status(active\|inactive), sort(name\|contactName\|createdAt\|updatedAt), order`. |
| GET | `/suppliers/:id` | `suppliers.read` | Detalle con `address`. Otra empresa → 404. |
| POST | `/suppliers` | `suppliers.write` | `{name(2–120), contactName?, email?, phone?, ruc?, address?, notes?, isActive?}` → 201. |
| PATCH | `/suppliers/:id` | `suppliers.write` | Edita campos individuales; body sin campos → 400. Baja: `{"isActive": false}`. |

> Mismas reglas que M08: sin unicidad (nombre/RUC/correo repetidos → 201), sin
> DELETE, limpieza `''` → `null` en PATCH, `address` reemplazada completa.
> Comparte `optionalText`/`address` con `customer.schema.ts` (fuente única).

---

## M10 — Almacenes

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/warehouses` | `warehouses.read` | Listado paginado. Query: `page, limit, search(nombre/dirección), status(active\|inactive), sort(name\|createdAt\|updatedAt), order`. |
| GET | `/warehouses/:id` | `warehouses.read` | Detalle. Otra empresa → 404. |
| POST | `/warehouses` | `warehouses.write` | `{name(2–80), address?, branchId?, isActive?}` → 201. 409 `NAME_IN_USE` (nombre único por empresa). |
| PATCH | `/warehouses/:id` | `warehouses.write` | Edita `name/address/branchId/isActive`; `branchId: null` desvincula. Body no vacío (400). |
| GET | `/warehouses/:id/inventory` | `inventory.read` | **Consultar inventario** del almacén: existencias paginadas (mismos filtros que `/inventory/stock`). Otra empresa → 404. |

> `branchId` (M05 sucursales) es opcional: la validación FK se activa en Fase 13.
> Sin borrado físico: la baja es `PATCH {"isActive": false}`.

---

## M11 — Inventario

Regla central: **el stock nunca cambia sin generar un movimiento**; los movimientos
son **inmutables** (solo `POST`, sin PATCH/DELETE) y registran `quantityAfter`.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/inventory/stock` | `inventory.read` | Existencias `{items, meta}` con `warehouseName`, `productName/Sku`, `quantity`, `minStock`, `lowStock`. Query: `warehouseId, productId, availability(in_stock\|out_of_stock\|low), sort(quantity\|minStock\|updatedAt\|createdAt), order`. |
| GET | `/inventory/stock/:id` | `inventory.read` | Detalle de existencia. Otra empresa → 404. |
| PATCH | `/inventory/stock/:id` | `inventory.write` | `{minStock ≥ 0}` — umbral de "stock bajo" (dashboard M14). |
| GET | `/inventory/movements` | `inventory.read` | Histórico paginado. Query: `warehouseId, productId, type(IN\|OUT\|ADJUSTMENT\|TRANSFER\|RETURN), sort(createdAt\|type\|quantity), order`. |
| GET | `/inventory/movements/:id` | `inventory.read` | Detalle de movimiento. Otra empresa → 404. |
| POST | `/inventory/movements` | `inventory.write` + (`inventory.transfer` si TRANSFER) | `{type, warehouseId, toWarehouseId?(TRANSFER), productId, quantity, reason?, documentRef?}` → 201 con `quantityAfter`. |

Reglas de negocio:

| Tipo | Cantidad | Efecto |
|---|---|---|
| `IN` | ≥ 1 | `+q` en el almacén |
| `OUT` | ≥ 1 | `−q`; si no hay stock → 409 `INSUFFICIENT_STOCK` (filtro atómico: nunca negativo) |
| `RETURN` | ≥ 1 | `+q` (devolución de venta) |
| `ADJUSTMENT` | ≥ 0 | **recuento absoluto**: fija la cantidad (0 = dejar vacío) |
| `TRANSFER` | ≥ 1 | `−q` en origen y `+q` en destino; exige `toWarehouseId` distinto y permiso `inventory.transfer` |

- Almacén/producto referenciado debe existir en la **misma empresa** → 400 `WAREHOUSE_NOT_FOUND` / `PRODUCT_NOT_FOUND`.
- Almacén `isActive:false` → 409 `WAREHOUSE_DISABLED` para IN/OUT/RETURN/TRANSFER; `ADJUSTMENT` sí está permitido (cierre/reconteo).
- `quantityAfter` se calcula con una actualización atómica y se persiste el movimiento; si el insert falla se compensa el stock. Desde la Fase 11, cuando el movimiento participa en una transacción de venta, el rollback lo aporta la transacción y no se compensa a mano.

```http
POST /api/v1/inventory/movements
{ "type": "TRANSFER", "warehouseId": "6660...", "toWarehouseId": "6661...",
  "productId": "665f...", "quantity": 2, "reason": "Reposición sucursal" }
```

---

## M12 — Ventas

Ciclo de vida: `pending → confirmed → { cancelled | returned }` y `pending → cancelled`.
El **backend calcula siempre precios, impuestos y totales** desde el catálogo: el precio
unitario **nunca** proviene del cliente (las claves desconocidas del body se descartan).

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/sales` | `sales.read` | Listado paginado. Query: `page, limit, search(cliente/producto/SKU sobre snapshots), status(pending\|confirmed\|cancelled\|returned), customerId, warehouseId, dateFrom, dateTo (días calendario UTC inclusivos), sort(saleDate\|total\|createdAt\|updatedAt), order`. |
| GET | `/sales/:id` | `sales.read` | Detalle con `items[]`, `history[]` de transiciones y snapshots. Otra empresa → 404. |
| POST | `/sales` | `sales.write` | `{customerId, warehouseId, branchId?, saleDate?(ISO), notes?, items:[{productId, quantity ≥ 1, discount? (0–100 %)}]}` → 201 en `pending`; 1–100 líneas y sin producto repetido. |
| POST | `/sales/:id/confirm` | `sales.write` | `pending → confirmed` + movimientos `OUT` por ítem **en una transacción**: sin stock → 409 `INSUFFICIENT_STOCK` y rollback total (venta sigue `pending`). |
| POST | `/sales/:id/cancel` | `sales.cancel` | `pending → cancelled` (sin tocar stock) o `confirmed → cancelled` (restock con `RETURN`), en transacción. |
| POST | `/sales/:id/return` | `sales.return` | Devolución `confirmed → returned` + restock `RETURN`, en transacción. |

Reglas de negocio:

- **Cálculo backend**: `unitPrice = product.salePrice`; por línea `subtotal = precio × cantidad`,
  el descuento se aplica **antes** de los impuestos, impuestos por tasa del producto y
  redondeo a 2 decimales; cabecera `subtotal`, `discountTotal`, `taxes[]` agregadas por
  (nombre, tasa) y `total = Σ totales de línea`.
- **FK con códigos propios** (400): `CUSTOMER_NOT_FOUND`, `WAREHOUSE_NOT_FOUND`,
  `PRODUCT_NOT_FOUND` (también aplica a registros de otra empresa).
- **Recursos desactivados** (409): `CUSTOMER_DISABLED`, `WAREHOUSE_DISABLED`, `PRODUCT_INACTIVE`.
- Transición inválida o carrera perdida → 409 `INVALID_SALE_STATE` (el reclamo de estado
  es condicional y atómico).
- **Transacciones multi-documento** (novedad de Fase 11): `withTransaction`
  (`shared/db/transaction.ts`) envuelve el reclamo de estado + movimientos de inventario
  y los aborta juntos. Requiere replica set (Atlas lo es); sin él → 500 `TRANSACTIONS_REQUIRED`.
- **Sin PATCH/DELETE**: el documento solo transiciona de estado (probado → 404).
- `branchId` (M05 sucursales) opcional: la validación FK se activa en Fase 13.
- `history[]`: eventos `created|confirmed|cancelled|returned` con `at`, `userId` y
  `userName` "foto" (historial del documento sin joins).

```http
POST /api/v1/sales
{ "customerId": "6660...", "warehouseId": "6661...",
  "items": [{ "productId": "665f...", "quantity": 3, "discount": 10 }] }
```

---

## Endpoints previstos (por fase)

```
GET|POST            /purchases            (Fase 12)
POST                /purchases/:id/confirm|receive|cancel
GET                 /dashboard/summary    (Fase 13)
GET                 /reports/sales|purchases|inventory|...  (Fase 14)
GET                 /audit-logs           (Fase 15)
```

Convención: plural en minúsculas, sin verbos en GET, acciones vía subrecurso
(`/sales/:id/cancel`), paginación `?page=&limit=`, filtros por query string.
