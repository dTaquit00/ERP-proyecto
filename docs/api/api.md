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
| 400 | Validación (`VALIDATION_ERROR`) o regla (`INVALID_RESET_TOKEN`, `ROLE_NOT_FOUND`, `SELF_DEACTIVATE`, `CATEGORY_NOT_FOUND`) |
| 401 | No autenticado (`MISSING_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `INVALID_CREDENTIALS`, `SESSION_INVALID`, `REFRESH_TOKEN_MISSING`) |
| 403 | Sin permisos (`INSUFFICIENT_PERMISSIONS`, `ACCOUNT_DISABLED`, `CURRENT_PASSWORD_INVALID`) |
| 404 | `NOT_FOUND` (también recurso de otra empresa: no se filtra su existencia) |
| 409 | `CONFLICT` / `DUPLICATE` / `EMAIL_IN_USE` / `ROLE_NAME_IN_USE` / `SYSTEM_ROLE` / `ROLE_IN_USE` / `LAST_ACTIVE_ADMIN` / `NAME_IN_USE` / `SKU_IN_USE` |
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

## Endpoints previstos (por fase)

```
GET|POST            /customers            (Fase 10)
GET|POST            /suppliers            (Fase 10)
GET|POST            /warehouses           (Fase 9)
GET                 /inventory/stock      (Fase 9)
POST                /inventory/movements  (Fase 9)
GET|POST            /sales                (Fase 11)
POST                /sales/:id/confirm|cancel|return
GET|POST            /purchases            (Fase 12)
POST                /purchases/:id/confirm|receive|cancel
GET                 /dashboard/summary    (Fase 13)
GET                 /reports/sales|purchases|inventory|...  (Fase 14)
GET                 /audit-logs           (Fase 15)
```

Convención: plural en minúsculas, sin verbos en GET, acciones vía subrecurso
(`/sales/:id/cancel`), paginación `?page=&limit=`, filtros por query string.
