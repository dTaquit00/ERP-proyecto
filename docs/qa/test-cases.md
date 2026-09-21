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

## Pendientes por fase

⏳ Fase 7: TC-USER-*, TC-RBAC-* (CRUD usuarios, cambio de rol, permisos por endpoint)
⏳ Fase 8+: TC-PROD-*, TC-INV-*, TC-SALE-*, TC-PUR-*… (ver test-plan.md)
