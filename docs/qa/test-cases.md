# Casos de prueba

Formato: `TC-<módulo>-<número>` · Estado: ✅ aprobado · ⏳ pendiente · ❌ falla

## M01 — Autenticación (integración: `tests/integration/auth.integration.test.ts`)

| ID | Descripción | Resultado esperado | Estado |
|---|---|---|---|
| TC-AUTH-001 | Login con credenciales válidas (email en mayúsculas) | 200, accessToken, cookie HttpOnly Path=/api/v1/auth, sin `passwordHash` en la respuesta | ✅ |
| TC-AUTH-002 | Login con contraseña incorrecta | 401 `INVALID_CREDENTIALS` | ✅ |
| TC-AUTH-003 | Login con correo inexistente | 401 `INVALID_CREDENTIALS` (idéntico a 002, sin enumerar) | ✅ |
| TC-AUTH-004 | Login sin campos | 400 `VALIDATION_ERROR` con `details[]` | ✅ |
| TC-AUTH-005 | Login con correo con formato inválido | 400 `VALIDATION_ERROR` | ✅ |
| TC-AUTH-006 | Login de cuenta desactivada con contraseña correcta | 403 `ACCOUNT_DISABLED` | ✅ |
| TC-AUTH-007 | Login con JSON malformado | 400 `VALIDATION_ERROR` | ✅ |
| TC-AUTH-008 | `/me` sin token | 401 `MISSING_TOKEN` | ✅ |
| TC-AUTH-009 | `/me` con token manipulado | 401 `TOKEN_INVALID` | ✅ |
| TC-AUTH-010 | `/me` con token expirado | 401 `TOKEN_EXPIRED` | ✅ |
| TC-AUTH-011 | `/me` con token cuyo usuario fue eliminado | 401 `SESSION_INVALID` | ✅ |
| TC-AUTH-012 | `/me` con sesión válida | 200 con usuario, rol y permisos | ✅ |
| TC-AUTH-013 | Aislamiento multiempresa en `/me` | devuelve el `companyId` propio, nunca el de otra empresa | ✅ |
| TC-AUTH-014 | `refresh` sin cookie | 401 `REFRESH_TOKEN_MISSING` | ✅ |
| TC-AUTH-015 | `refresh` con cookie válida | 200, accessToken distinto, cookie rotada | ✅ |
| TC-AUTH-016 | Reuso del refresh token anterior | 401 `SESSION_INVALID` | ✅ |
| TC-AUTH-017 | `refresh` con cookie manipulada | 401 `SESSION_INVALID` | ✅ |
| TC-AUTH-018 | `logout` y refresh posterior | 200 y luego 401 | ✅ |
| TC-AUTH-019 | `logout` sin sesión (idempotente) | 200 | ✅ |
| TC-AUTH-020 | `change-password` sin autenticación | 401 | ✅ |
| TC-AUTH-021 | `change-password` con contraseña actual incorrecta | 403 `CURRENT_PASSWORD_INVALID` | ✅ |
| TC-AUTH-022 | `change-password` con contraseña nueva débil | 400 `VALIDATION_ERROR` | ✅ |
| TC-AUTH-023 | `change-password` correcto: revoca otras sesiones, contraseña vieja falla y nueva funciona | 200; refresh de otra sesión 401; login viejo 401; login nuevo 200 | ✅ |
| TC-AUTH-024 | Reset con correo inexistente | 200 sin `resetToken` | ✅ |
| TC-AUTH-025 | Flujo completo de reset | 200; login viejo 401; login nuevo 200 | ✅ |
| TC-AUTH-026 | Reuso del token de reset | 400 `INVALID_RESET_TOKEN` | ✅ |
| TC-AUTH-027 | Reset con token inválido | 400 `INVALID_RESET_TOKEN` | ✅ |
| TC-AUTH-028 | Reset con contraseña nueva inválida | 400 `VALIDATION_ERROR` | ✅ |
| TC-AUTH-029 | Ruta inexistente | 404 con formato `{error:{code,message}}` | ✅ |

## M02 — Usuarios (integración: `tests/integration/users.integration.test.ts`)

| ID | Descripción | Resultado esperado | Estado |
|---|---|---|---|
| TC-USER-001 | `GET /users` sin token | 401 `MISSING_TOKEN` | ✅ |
| TC-USER-002 | `GET /users` con rol sin `users.read` | 403 `INSUFFICIENT_PERMISSIONS` | ✅ |
| TC-USER-003 | Listado aislado por empresa | 200, todos con el `companyId` propio, sin `passwordHash`, sin usuarios de otra empresa, con `roleName` | ✅ |
| TC-USER-004 | Paginación consistente | `page=2&limit=1` → `meta` coherente con `total` real y `totalPages` | ✅ |
| TC-USER-005 | Búsqueda por texto | `search=inactive` filtra; entrada `(((` no provoca 500 (regex escapada) | ✅ |
| TC-USER-006 | Filtro por estado | `status=inactive` → solo `isActive:false` | ✅ |
| TC-USER-007 | Campos de orden y límites no permitidos | `sort=passwordHash` → 400; `limit=5000` → 400 | ✅ |
| TC-USER-008 | Detalle de usuario con rol | 200, `roleName=administrador`, sin `passwordHash` | ✅ |
| TC-USER-009 | Detalle de usuario de otra empresa | 404 `NOT_FOUND` (no filtra existencia) | ✅ |
| TC-USER-010 | `:id` inválido vs inexistente | 400 `VALIDATION_ERROR` / 404 | ✅ |
| TC-USER-011 | Creación válida | 201 con `roleName` y `isActive`; login con la contraseña dada → 200 | ✅ |
| TC-USER-012 | Correo duplicado en la empresa | 409 `EMAIL_IN_USE` (case-insensitive) | ✅ |
| TC-USER-013 | Rol de otra empresa o inexistente | 400 `ROLE_NOT_FOUND` | ✅ |
| TC-USER-014 | Crear sin `users.write` y con datos inválidos | 403 / 400 `VALIDATION_ERROR` con `details[]` | ✅ |
| TC-USER-015 | `PATCH` nombre y apellido | 200 con el valor actualizado | ✅ |
| TC-USER-016 | `PATCH` cambio de rol | 200, respuesta refleja `roleId` y `roleName` nuevos | ✅ |
| TC-USER-017 | `PATCH` correo duplicado / rol foráneo | 409 `EMAIL_IN_USE` / 400 `ROLE_NOT_FOUND` | ✅ |
| TC-USER-018 | `PATCH` vacío / sin permisos / otra empresa | 400 / 403 / 404 | ✅ |
| TC-USER-019 | Desactivar → login bloqueado → activar | 200; login 403 `ACCOUNT_DISABLED`; 200; login 200 | ✅ |
| TC-USER-020 | Desactivarse a uno mismo | 400 `SELF_DEACTIVATE` | ✅ |
| TC-USER-021 | Desactivar al último administrador activo | 409 `LAST_ACTIVE_ADMIN` | ✅ |
| TC-USER-022 | Activar/desactivar usuario de otra empresa | 404 | ✅ |
| TC-USER-023 | Historial: RBAC + sesiones reales | 401 sin token, 403 sin `users.read`; 200 con `createdAt`, `lastLoginAt` y `sessions[]` activas; sin `tokenHash`/`refreshToken` | ✅ |
| TC-USER-024 | Historial de otra empresa | 404 | ✅ |

## M03 — Roles (integración: `tests/integration/roles.integration.test.ts`)

| ID | Descripción | Resultado esperado | Estado |
|---|---|---|---|
| TC-ROLE-001 | `GET /roles` sin token / sin `roles.read` | 401 / 403 | ✅ |
| TC-ROLE-002 | Listado con roles del sistema | ≥7 roles del sistema + personalizados, con `userCount` y sin secretos | ✅ |
| TC-ROLE-003 | Paginación de roles | `meta` coherente con `total` real | ✅ |
| TC-ROLE-004 | Detalle con `userCount` | 200, recuento ≥2 para `administrador` | ✅ |
| TC-ROLE-005 | Detalle otra empresa / `:id` inválido / inexistente | 404 / 400 / 404 | ✅ |
| TC-ROLE-006 | Catálogo de permisos | 200 con el catálogo completo (`roles.read`) | ✅ |
| TC-ROLE-007 | Catálogo sin token / sin permisos | 401 / 403 | ✅ |
| TC-ROLE-008 | Crear rol personalizado | 201, `isSystem:false`, `userCount:0`, permisos exactos | ✅ |
| TC-ROLE-009 | Nombre de rol duplicado en la empresa | 409 `ROLE_NAME_IN_USE` | ✅ |
| TC-ROLE-010 | Permiso fuera del catálogo / nombre con espacios | 400 `VALIDATION_ERROR` con `details[]` | ✅ |
| TC-ROLE-011 | Crear rol sin `roles.write` | 403 `INSUFFICIENT_PERMISSIONS` | ✅ |
| TC-ROLE-012 | `PATCH` displayName + permisos | 200 actualizado; el campo `name` se ignora (inmutable) | ✅ |
| TC-ROLE-013 | `PATCH` vacío / permiso inválido / sin permisos / otra empresa | 400 / 400 / 403 / 404 | ✅ |
| TC-ROLE-014 | `DELETE` de rol del sistema | 409 `SYSTEM_ROLE` | ✅ |
| TC-ROLE-015 | `DELETE` de rol asignado a usuarios | 409 `ROLE_IN_USE` | ✅ |
| TC-ROLE-016 | `DELETE` de rol libre (y sin permisos) | 403 para rol sin `roles.write`; 200 `{id,deleted:true}`; luego GET → 404 | ✅ |
| TC-ROLE-017 | `DELETE` de rol de otra empresa | 404 | ✅ |

## Unitarias

| ID | Archivo | Casos | Estado |
|---|---|---|---|
| TC-UNIT-001 | `password.test.ts` | hash scrypt, verificación, sal único, hashes malformados, hash ficticio | ✅ |
| TC-UNIT-002 | `jwt.test.ts` | roundtrip, secreto ajeno, expirado vs inválido, `typ` incorrecto, payload incompleto | ✅ |
| TC-UNIT-003 | `token.test.ts` | unicidad, formato base64url, SHA-256 determinista, no reversible | ✅ |
| TC-UNIT-004 | `parse.test.ts` | datos válidos, detalles por campo, entradas arbitrarias (null, string, array) | ✅ |
| TC-UNIT-005 | `errors.test.ts` | código HTTP y `code` de cada error de la jerarquía | ✅ |
| TC-UNIT-006 | `authorize.test.ts` | con permiso, sin permiso, permisos múltiples, sin auth | ✅ |
| TC-UNIT-007 | `env.test.ts` | entorno válido, defaults, URI ausente, secretos cortos, NODE_ENV/PORT inválidos, orígenes CORS | ✅ |
| TC-UNIT-008 | `rate-limit.test.ts` | 200 dentro del límite, 429 formateado al superarlo | ✅ |
| TC-UNIT-009 | `users.repository.test.ts` | `buildUserFilter` (scope `companyId`, status, roleId, búsqueda), `escapeRegExp` | ✅ |
| TC-UNIT-010 | `users.service.test.ts` | `toUserSummary` sin fugas de hash, fallback de rol, fechas nulas | ✅ |
| TC-UNIT-011 | `user.schema.test.ts` / `role.schema.test.ts` | schemas de usuario y rol: válidos, inválidos, defaults, refinamientos | ✅ |

## Pendientes por fase

⏳ Fase 8+: TC-PROD-*, TC-INV-*, TC-SALE-*, TC-PUR-*… (ver test-plan.md)
