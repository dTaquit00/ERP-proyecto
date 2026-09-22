# Quality checklist

Definición de "terminado" aplicada por fase.

## Fase 2–3 — Monorepo y configuración

- [x] Estructura `apps/` + `packages/` + `tests/` + `docs/`
- [x] TypeScript estricto (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`)
- [x] ESLint (flat config) sin errores
- [x] Vitest configurado (unit + integración)
- [x] `.env.example` completo; `.env` ignorado por Git
- [x] `npm install` sin conflictos

## Fase 4 — API base

- [x] `createApp()` sin side effects; entrada `index.ts` con apagado limpio
- [x] Respuestas consistentes `{data}` / `{error:{code,message}}`
- [x] Manejador global de errores (Zod, Mongoose, 404, 500 sin stack en producción)
- [x] Logging estructurado con redacción de secretos
- [x] helmet + CORS por origen + rate limiting global
- [x] `GET /health` (estado del servidor y de MongoDB)

## Fase 5 — MongoDB

- [x] Conexión con fallo rápido y mensajes claros
- [x] Acceso solo vía repositories (ninguna consulta en controllers)
- [x] Índices: unicidad `{companyId,email}` usuarios, `{companyId,name}` roles, TTL sesiones
- [x] Multiempresa: `companyId` en usuarios/roles/empresas

## Fase 6 — Autenticación (M01)

- [x] Login / logout / refresh con rotación
- [x] Recuperación y cambio de contraseña
- [x] Protección de rutas (`authenticate`) y expiración de sesión
- [x] Control de sesiones (revocación total/parcial, reuso detectado)
- [x] Validaciones de entrada (Zod) con `details[]`
- [x] Permisos: `authorize` + catálogo filtrado (`isPermission`)
- [x] API documentada (`docs/api/api.md`)
- [x] Pruebas unitarias (7 archivos) + integración (29 casos, con negativos)
- [x] Lint correcto · TypeScript sin errores · `npm run build` OK
- [x] Sin secretos en el código (entorno validado; `.env` fuera de Git)
- [x] Documentación actualizada (README, architecture, database, security, api, qa)

## Fase 7 — Usuarios (M02) y Roles (M03)

- [x] Módulo completo `users/`: model · repository · service · controller · routes · types · tests
- [x] Módulo completo `roles/`: igual estructura + `roles.system.ts` (fuente única de los 7 roles)
- [x] Endpoints: `GET/POST /users`, `GET /users/:id`, `PATCH /users/:id`, `POST /users/:id/activate|deactivate`, `GET /users/:id/history`, `GET/POST /roles`, `GET /roles/:id`, `PATCH/DELETE /roles/:id`, `GET /permissions`
- [x] RBAC verificado en backend (`users.read/write`, `roles.read/write`) con pruebas negativas 401/403
- [x] Aislamiento multiempresa: recursos de otra empresa → 404 (sin filtrar existencia)
- [x] Nunca se expone `passwordHash` ni `tokenHash` en respuestas (verificado por test)
- [x] Listado: paginación, `search` (regex-escapado), `status`, `sort` con whitelist anti sort-injection
- [x] Sin eliminación de usuarios (solo desactivar) y sin edición del `name` de rol
- [x] Reglas de negocio: `SELF_DEACTIVATE`, `LAST_ACTIVE_ADMIN`, `EMAIL_IN_USE`, `ROLE_NOT_FOUND`, `ROLE_NAME_IN_USE`, `SYSTEM_ROLE`, `ROLE_IN_USE`
- [x] `GET /users/:id/history` con fechas reales + sesiones recientes (audit trail completo → Fase 15)
- [x] Seed refactorizado sobre `ensureSystemRoles` (misma fuente que las pruebas)
- [x] Pruebas: unitarias (repositorios/servicios/schemas) + integración (24 users + 17 roles, con negativos)
- [x] Lint correcto · TypeScript sin errores · 137/137 tests · `npm run build` OK
- [x] Documentación actualizada (api, test-cases, quality-checklist, requirements, architecture, README)

## Fase 8 — Categorías (M06) y Productos (M07)

- [x] Módulo completo `categories/`: model · repository · service · controller · routes · types · tests
- [x] Módulo completo `products/`: misma estructura
- [x] Endpoints: `GET/POST /categories`, `GET|PATCH /categories/:id`, `GET/POST /products`, `GET|PATCH /products/:id`
- [x] RBAC verificado en backend (`categories.read/write`, `products.read/write`) con negativas 401/403 y positivas con rol catálogo
- [x] Aislamiento multiempresa: categorías/productos de otra empresa → 404 (sin filtrar existencia)
- [x] Reglas de negocio: `NAME_IN_USE` (nombre único por empresa), `SKU_IN_USE` (SKU único por empresa, normalizado a mayúsculas), `CATEGORY_NOT_FOUND` (categoría de la misma empresa)
- [x] Campos de producto completos: código, SKU, nombre, descripción, categoría, precio compra/venta, impuestos configurables (tasa 0–100), unidad, estado, imagen (URL), código de barras
- [x] Sin borrado físico: baja lógica vía `PATCH {isActive:false}` (spec M06: "desactivar")
- [x] Listado: paginación, `search` (regex-escapado sobre nombre/SKU/código/barras), `status`, `categoryId`, `sort` con whitelist anti sort-injection
- [x] `productCount` real por categoría (una agregación por petición)
- [x] Nunca se expone `passwordHash` ni `tokenHash` en respuestas (verificado por test)
- [x] Pruebas: unitarias (schemas de categoría/producto, `buildCategoryFilter`, `buildProductFilter`, `toProductSummary`) + integración (12 categorías + 14 productos, con negativos)
- [x] Lint correcto · TypeScript sin errores · 193/193 tests · `npm run build` OK
- [x] Documentación actualizada (api, test-cases, test-plan, quality-checklist, requirements, architecture, database, security, README)

## Fase 9 — Almacenes (M10) e Inventario (M11)

- [x] Módulo completo `warehouses/`: model · repository · service · controller · routes · types · tests
- [x] Módulo completo `inventory/`: misma estructura (dos modelos: `stock_balances` + `inventory_movements`)
- [x] Endpoints: `GET/POST /warehouses`, `GET|PATCH /warehouses/:id`, `GET /warehouses/:id/inventory`, `GET /inventory/stock`, `GET|PATCH /inventory/stock/:id`, `GET /inventory/movements`, `GET /inventory/movements/:id`, `POST /inventory/movements`
- [x] RBAC verificado en backend (`warehouses.read/write`, `inventory.read/write`) + `inventory.transfer` específico de TRANSFER (403 probado con rol sin él)
- [x] **El stock nunca cambia sin movimiento**: cada cambio genera un registro inmutable con `quantityAfter` (actualización atómica con filtro `quantity >= q`; compensación si el insert falla — transacciones → Fase 11–12)
- [x] Tipos de movimiento `IN OUT ADJUSTMENT TRANSFER RETURN` con reglas por tipo (ADJUSTMENT = recuento absoluto admite 0)
- [x] Sin endpoints de edición/borrado de movimientos; campos clave `immutable: true` en el schema
- [x] Reglas de negocio: `INSUFFICIENT_STOCK`, `WAREHOUSE_DISABLED` (ADJUSTMENT permitido para cierre), `WAREHOUSE_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `NAME_IN_USE`
- [x] Aislamiento multiempresa: stock/movimientos/almacenes de otra empresa → 404; FKs ajenos → 400
- [x] Listados: paginación, filtros (`warehouseId`, `productId`, `type`, `availability`), `sort` con whitelist anti sort-injection
- [x] `minStock` por existencia + `lowStock` derivado en backend (base de "stock bajo" del dashboard M14)
- [x] `branchId` opcional con validación FK diferida a Fase 13 (M05 sucursales) — decisión documentada
- [x] Nombres "foto" (almacén/producto/usuario) en el movimiento: histórico inmutable sin joins
- [x] Pruebas: unitarias (schemas, `buildWarehouseFilter`, `buildStockFilter`, `buildMovementFilter`, `movementEffect`, mappers) + integración (13 almacenes + 18 inventario, con negativos)
- [x] Lint correcto · TypeScript sin errores · 255/255 tests · `npm run build` OK
- [x] Documentación actualizada (api, test-cases, test-plan, quality-checklist, requirements, architecture, database, security, README)

## Fase 10 — Clientes (M08) y Proveedores (M09)

- [x] Módulo completo `customers/`: model · repository · service · controller · routes · types · tests
- [x] Módulo completo `suppliers/`: misma estructura (comparte `optionalText`/`clearable*`/`address` con M08)
- [x] Endpoints: `GET/POST /customers`, `GET|PATCH /customers/:id`, `GET/POST /suppliers`, `GET|PATCH /suppliers/:id`
- [x] RBAC verificado en backend (`customers.read/write`, `suppliers.read/write`) con negativas 401/403 y positivas con roles mínimos (`comercial`, `proveeduria`)
- [x] Aislamiento multiempresa: recursos de otra empresa → 404 (sin filtrar existencia)
- [x] Sin borrado físico: baja vía `PATCH {isActive:false}`; `DELETE` no existe (404 probado en ambas suites)
- [x] **Sin unicidad** de nombre/correo/DNI/RUC (decisión de negocio documentada: duplicados → 201)
- [x] Diseño B de limpieza: en PATCH, `''`/solo espacios/`null` → persiste `null` (≠ `undefined` = no tocar); en POST lo en blanco se omite como campo ausente
- [x] `address` subdocumento `{_id:false}` reemplazado completo en PATCH; mapeo de respuesta `|| null` (escalares y subcampos) → JSON sin `undefined`
- [x] Cuerpo PATCH sin campos → 400 (`al menos un campo`); nunca se expone `passwordHash` (verificado por test)
- [x] Listados: paginación, `search` (regex escapado), `status`, `sort` con whitelist anti sort-injection
- [x] Pruebas: unitarias (schemas Diseño B, `buildCustomerFilter`/`buildSupplierFilter`, mappers a `string | null`) + integración (14 clientes + 14 proveedores, con negativos)
- [x] Lint correcto · TypeScript sin errores · 316/316 tests · `npm run build` OK
- [x] Documentación actualizada (api, test-cases, test-plan, quality-checklist, requirements, architecture, database, README)

## Fase 11 — Ventas (M12)

- [x] Módulo completo `sales/`: model · repository · service · controller · routes · types · tests
- [x] Tipos compartidos `sale.types.ts` (estados, líneas con snapshot, impuestos, historial) + schema Zod `sale.schema.ts` con tests unitarios
- [x] Endpoints: `GET/POST /sales`, `GET /sales/:id`, `POST /sales/:id/confirm|cancel|return` — sin PATCH/DELETE (404 probado): el documento solo transiciona de estado
- [x] RBAC verificado en backend (`sales.read/write/cancel/return`) con negativas 401/403 y positivas con el rol sistema `vendedor` (que **no** tiene `sales.cancel`)
- [x] **Backend calcula siempre precios/impuestos/totales**: `unitPrice` = `product.salePrice` (el enviado por el cliente se ignora — probado), descuento antes de impuestos, redondeo a 2 decimales, cabecera con `taxes[]` agregadas
- [x] Máquina de estados `pending → confirmed → cancelled/returned` con reclamo condicional atómico (409 `INVALID_SALE_STATE` en transiciones inválidas o concurrentes)
- [x] **Transacciones multi-documento** (novedad de la fase): helper `withTransaction` (`shared/db/transaction.ts`) + `session` opcional en repository/service de inventario — con sesión el rollback lo hace la transacción; sin sesión la compensación de M11 queda intacta; sin replica set → 500 `TRANSACTIONS_REQUIRED`
- [x] Confirmar debita stock (`OUT` por ítem); cancelar confirmada y devolver repone (`RETURN`); cancelar pendiente no toca stock — verificado contra la existencia y los movimientos (`documentRef = SALE:<id>`)
- [x] Rollback probado en frío: `INSUFFICIENT_STOCK` y almacén desactivado dejan la venta en `pending`, el stock sin cambios y sin movimientos huérfanos
- [x] FK con códigos propios 400 (`CUSTOMER_NOT_FOUND`/`WAREHOUSE_NOT_FOUND`/`PRODUCT_NOT_FOUND`) y desactivados 409 (`CUSTOMER_DISABLED`/`PRODUCT_INACTIVE`/`WAREHOUSE_DISABLED`)
- [x] Aislamiento multiempresa: venta de otra empresa → 404 en detalle y ausente en listados
- [x] `history[]` con `created|confirmed|cancelled|returned` + snapshots "foto" (cliente, usuario, almacén, productos)
- [x] Listados: paginación, `search` (regex escapado sobre snapshots), filtros estado/cliente/almacén/fechas (día calendario UTC inclusivo, fechas imposibles rechazadas por round-trip), `sort` con whitelist
- [x] Pruebas: unitarias (`sale.schema.test`, `computeLineTotals`/`aggregateTaxes`/`roundMoney`/`toSaleResponse`, `buildSaleFilter`) + integración (23 casos, con negativos y transacciones)
- [x] Tests migrados a `MongoMemoryReplSet` (replica set en memoria: requisito de las transacciones; documentado)
- [x] Lint correcto · TypeScript sin errores · 361/361 tests · `npm run build` OK
- [x] Documentación actualizada (api, test-cases, test-plan, quality-checklist, requirements, architecture, database, README)

## Pendiente para fases siguientes

- [ ] Auditoría (`audit_logs`) al confirmar operaciones empresariales — Fase 15
- [ ] Paginación/filtros en todos los listados — desde Fase 7
- [ ] `npm audit` + pentest interno — Fase 17–18
- [ ] E2E completo (login → venta → inventario → reporte) — Fase 17
