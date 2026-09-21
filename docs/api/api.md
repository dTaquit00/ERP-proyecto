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
| 400 | Validación (`VALIDATION_ERROR`) o regla (`INVALID_RESET_TOKEN`...) |
| 401 | No autenticado (`MISSING_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `INVALID_CREDENTIALS`, `SESSION_INVALID`, `REFRESH_TOKEN_MISSING`) |
| 403 | Sin permisos (`INSUFFICIENT_PERMISSIONS`, `ACCOUNT_DISABLED`, `CURRENT_PASSWORD_INVALID`) |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` / `DUPLICATE` |
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

## Endpoints previstos (por fase)

```
GET|POST            /users                (Fase 7)
GET|PATCH|DELETE    /users/:id            (Fase 7)
POST                /users/:id/activate|deactivate
GET|POST            /roles                (Fase 7)
GET|POST            /products             (Fase 8)
GET|PATCH|DELETE    /products/:id
GET|POST            /categories           (Fase 8)
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
