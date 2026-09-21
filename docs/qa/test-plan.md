# Plan de pruebas

## Estrategia

QA desde el día uno: cada funcionalidad se implementa con sus pruebas y se verifica
antes de declarar la fase terminada.

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript estricto
npm test           # typecheck + unitarias + integración
npm run build      # compilación de producción
```

## Niveles

| Nivel | Ubicación | Herramienta | Estado |
|---|---|---|---|
| Unitarias | junto al código (`apps/api/src/**/*.test.ts` y `packages/*/src/**/*.test.ts`) | Vitest | ✅ Fase 7 |
| Integración API→service→MongoDB | `tests/integration/` | Vitest + Supertest + mongodb-memory-server | ✅ Fase 7 |
| E2E | `tests/e2e/` | API: Vitest+Supertest; web: Playwright; móvil: Detox | ⏳ Fase 17 |

## Cobertura actual (Fase 7 — 137 pruebas: 67 unitarias + 70 de integración)

- Hash/verificación de contraseñas (scrypt), incluidos hashes malformados.
- Firma/verificación de JWT: expirado, manipulado, `typ` incorrecto, incompleto.
- Tokens opacos: unicidad, hashing, no reversibilidad.
- Validación de entradas (`parseOrThrow`): campos faltantes, formatos inválidos.
- Jerarquía de errores: código HTTP + code de negocio correctos.
- Middleware `authorize` (RBAC): con permiso, sin permiso, sin autenticación, permisos múltiples.
- Variables de entorno: faltantes, débiles, malformadas.
- Rate limit: 200 dentro del límite, 429 formateado al superarlo.
- Login completo: éxito, credenciales inválidas, correo inexistente (misma respuesta),
  campos vacíos, correo inválido, cuenta desactivada, JSON malformado.
- `/me`: sin token, token manipulado, expirado, huérfano, éxito, multiempresa.
- Refresh: sin cookie, rotación, reuso, cookie manipulada.
- Logout: revocación + idempotencia.
- Cambio de contraseña: contraseña actual incorrecta, contraseña débil, revocación
  de sesiones, login con contraseña antigua/nueva.
- Reset de contraseña: correo inexistente (sin filtrar), flujo completo,
  token de un solo uso, token inválido, política de contraseña.
- Formato de error 404 estándar.
- Usuarios: RBAC 401/403, aislamiento multiempresa (404), sin `passwordHash`,
  paginación/búsqueda/filtros, `sort` no permitido (400), creación (201) y
  duplicados (409 `EMAIL_IN_USE`), rol foráneo (400 `ROLE_NOT_FOUND`),
  activar/desactivar (`ACCOUNT_DISABLED`, `SELF_DEACTIVATE`, `LAST_ACTIVE_ADMIN`),
  historial con sesiones reales sin exponer tokens.
- Roles: listado con los 7 roles del sistema y `userCount`, RBAC 401/403,
  duplicados (`ROLE_NAME_IN_USE`), permisos fuera de catálogo (400),
  `name` inmutable en edición, borrado protegido (`SYSTEM_ROLE`, `ROLE_IN_USE`),
  aislamiento multiempresa (404), catálogo `/permissions`.

## Casos negativos obligatorios por módulo nuevo

Campos vacíos · datos incorrectos · IDs inexistentes · cantidades negativas o cero ·
duplicados · usuario sin permisos · token inválido/expirado · solicitudes repetidas ·
datos de otra empresa · registros desactivados · stock insuficiente ·
errores de MongoDB · errores de red.

## Plan por fase

1. Antes de cada fase: `npm test` en verde.
2. Durante: pruebas unitarias + integración con cada función, incluidos negativos.
3. Al cerrar la fase: regresión completa + `npm run build` + actualización de
   `test-cases.md` y `quality-checklist.md`.
4. Errores encontrados → `bug-report.md` con formato `BUG-001`.

## Entorno de pruebas

- MongoDB real no requerido: `mongodb-memory-server` levanta una instancia por suite.
- `NODE_ENV=test`, logs en `silent`, límites de rate limit elevados (el rate limit se
  prueba en una app aislada para no interferir).
