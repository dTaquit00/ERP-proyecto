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
| Unitarias | junto al código (`apps/api/src/**/*.test.ts` y `packages/*/src/**/*.test.ts`) | Vitest | ✅ Fase 10 |
| Integración API→service→MongoDB | `tests/integration/` | Vitest + Supertest + mongodb-memory-server | ✅ Fase 10 |
| E2E | `tests/e2e/` | API: Vitest+Supertest; web: Playwright; móvil: Detox | ⏳ Fase 17 |

## Cobertura actual (Fase 10 — 316 pruebas: 161 unitarias + 155 de integración)

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
- Categorías: RBAC 401/403 (y positivo con rol catálogo), aislamiento
  multiempresa (404), `productCount` real, `search`/`status`/paginación,
  `sort` no permitido (400), creación 201 y nombre duplicado (409 `NAME_IN_USE`),
  edición con renombre a sí mismo, alta/baja por `isActive` reflejada en el
  filtro `status`.
- Productos: RBAC 401/403 (lectura con rol catálogo; escritura sin permiso),
  listado con `categoryName` y sin secretos, búsqueda por nombre/SKU con regex
  hostiles, filtros `categoryId`/`status`, SKU normalizado a mayúsculas y
  duplicado (409 `SKU_IN_USE`), categoría ajena o inexistente
  (400 `CATEGORY_NOT_FOUND`), precios negativos / tasa >100 / unidad vacía /
  SKU inválido (400), edición de precios+impuestos+estado, aislamiento (404).
- Almacenes: RBAC 401/403 (y positivo con rol almacenero), aislamiento
  multiempresa (404), nombre duplicado (409 `NAME_IN_USE`), `search`/`status`/
  paginación, `sort` no permitido (400), edición y alta/baja por `isActive`,
  `branchId` opcional (M05 → Fase 13), y `GET /:id/inventory` con existencias
  reales tras registrar un movimiento.
- Inventario: RBAC 401/403 (lectura/escritura con rol almacenero), ciclo completo
  `IN → OUT → RETURN → ADJUSTMENT → TRANSFER` con `quantityAfter` verificado en
  la existencia, `INSUFFICIENT_STOCK` (409) sin alterar el stock,
  `inventory.transfer` extra para TRANSFER (403 sin él), almacén desactivado
  (409 `WAREHOUSE_DISABLED`; ADJUSTMENT permitido), validación por tipo
  (cantidad ≥ 1 salvo ADJUSTMENT, destino solo en TRANSFER y distinto),
  FKs ajenos/inexistentes (400 `WAREHOUSE_NOT_FOUND`/`PRODUCT_NOT_FOUND`),
  filtros `type`/`warehouseId`/`availability(low|in_stock|out_of_stock)`,
  `minStock` con `lowStock` derivado, `sort` no permitido (400),
  inmovilidad de movimientos (sin PATCH/DELETE) y aislamiento (404).
- Clientes: RBAC 401/403 (lectura y escritura con rol mínimo `comercial`),
  aislamiento multiempresa (404), sin `passwordHash`, paginación/búsqueda con
  regex hostiles, filtros `status`/`sort` (campo no permitido y `limit>100` → 400),
  creación 201 con correo normalizado y cliente mínimo (`''` = campo ausente),
  edición con reemplazo completo de `address`, limpieza de opcionales
  (`''`/solo espacios → `null` persistido y releído), cuerpo PATCH vacío (400),
  sin DELETE (baja por `PATCH {isActive:false}` → DELETE responde 404) y
  **sin unicidad** de nombre/correo (decisión de negocio).
- Proveedores: la misma batería sobre M09 con rol propio `proveeduria`
  (nombre distinto a los 7 roles del sistema), campos `contactName`/`ruc`,
  duplicados permitidos (201) y limpieza `email`/`ruc`/`notes` → `null`.

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
