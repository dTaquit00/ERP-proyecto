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

## M06 — Categorías (integración: `tests/integration/categories.integration.test.ts`)

| ID | Descripción | Resultado esperado | Estado |
|---|---|---|---|
| TC-CAT-001 | `GET /categories` sin token / sin `categories.read` | 401 `MISSING_TOKEN` / 403 `INSUFFICIENT_PERMISSIONS` | ✅ |
| TC-CAT-002 | Listado con rol catálogo (RBAC positivo) | 200, solo categorías de la empresa, con `productCount`, sin datos ajenos ni `passwordHash` | ✅ |
| TC-CAT-003 | Filtro por estado | `status=inactive` → solo `isActive:false` (incluye la categoría base desactivada) | ✅ |
| TC-CAT-004 | Búsqueda por nombre/descripción sin inyección de regex | `search=Obsoleta` filtra; `search=(((` → 200 (regex escapada) | ✅ |
| TC-CAT-005 | Paginación y campos no permitidos | `page=2&limit=1` → `meta` coherente; `sort=passwordHash` → 400; `limit=5000` → 400 | ✅ |
| TC-CAT-006 | Detalle con `productCount` real | 200, `productCount ≥ 1` (producto creado en la propia suite) | ✅ |
| TC-CAT-007 | Detalle otra empresa / `:id` inválido / inexistente | 404 / 400 `VALIDATION_ERROR` / 404 | ✅ |
| TC-CAT-008 | Creación válida | 201, nombre recortado, `isActive:true`, `productCount:0`, `companyId` propio | ✅ |
| TC-CAT-009 | Nombre duplicado en la empresa | 409 `NAME_IN_USE` | ✅ |
| TC-CAT-010 | Payload inválido / sin permiso / sin token | 400 con `details[]` / 403 / 401 | ✅ |
| TC-CAT-011 | `PATCH` nombre+descripción y `isActive:false` | 200; el filtro `status=inactive` refleja el cambio; reactivación | ✅ |
| TC-CAT-012 | `PATCH` vacío / duplicado / renombrarse a sí mismo / sin permisos / otra empresa | 400 / 409 `NAME_IN_USE` / 200 / 403 / 404 | ✅ |

## M07 — Productos (integración: `tests/integration/products.integration.test.ts`)

| ID | Descripción | Resultado esperado | Estado |
|---|---|---|---|
| TC-PROD-001 | `GET /products` sin token / sin `products.read` | 401 / 403 | ✅ |
| TC-PROD-002 | Listado con rol catálogo (RBAC positivo) | 200, solo productos propios, con `categoryName`, sin `FOREIGN-1`, sin `passwordHash`/`tokenHash` | ✅ |
| TC-PROD-003 | Paginación consistente | `meta` calculada en backend coherente con `total` real | ✅ |
| TC-PROD-004 | Búsqueda por nombre/SKU con regex hostiles | `search=SKU-BASE` filtra por SKU; `search=[[` → 200 | ✅ |
| TC-PROD-005 | Filtros `categoryId`/`status` y campos no permitidos | resultados coherentes; `sort=passwordHash` → 400; `limit=5000` → 400 | ✅ |
| TC-PROD-006 | Detalle con precios e impuestos | 200, `purchasePrice`/`salePrice`/`categoryName` correctos | ✅ |
| TC-PROD-007 | Detalle otra empresa / `:id` inválido / inexistente | 404 / 400 / 404 | ✅ |
| TC-PROD-008 | Creación válida | 201, SKU normalizado a mayúsculas, `categoryName` resuelto, impuestos y `companyId` correctos | ✅ |
| TC-PROD-009 | SKU duplicado (distinta caja) en la empresa | 409 `SKU_IN_USE` | ✅ |
| TC-PROD-010 | Categoría de otra empresa / inexistente | 400 `CATEGORY_NOT_FOUND` en ambos | ✅ |
| TC-PROD-011 | Precio negativo / tasa >100 / unidad vacía / SKU con espacios | 400 `VALIDATION_ERROR` con `details[]` | ✅ |
| TC-PROD-012 | Crear sin `products.write` y sin token | 403 `INSUFFICIENT_PERMISSIONS` / 401 | ✅ |
| TC-PROD-013 | `PATCH` nombre+precio+impuestos y `isActive:false` | 200; el filtro `status=inactive` incluye el producto | ✅ |
| TC-PROD-014 | `PATCH` vacío / SKU duplicado / categoría ajena / sin permisos / otra empresa | 400 / 409 `SKU_IN_USE` / 400 `CATEGORY_NOT_FOUND` / 403 / 404 | ✅ |

## M08 — Clientes (integración: `tests/integration/customers.integration.test.ts`)

| ID | Descripción | Resultado esperado | Estado |
|---|---|---|---|
| TC-CUS-001 | `GET /customers` sin token / sin `customers.read` | 401 `MISSING_TOKEN` / 403 `INSUFFICIENT_PERMISSIONS` | ✅ |
| TC-CUS-002 | Listado con rol `comercial` (RBAC positivo) | 200, solo clientes propios con `address`, sin datos ajenos ni `passwordHash` | ✅ |
| TC-CUS-003 | Paginación consistente | `meta` calculada en backend coherente con `total` real | ✅ |
| TC-CUS-004 | Búsqueda por nombre/correo con regex hostiles | `search` filtra; `(((` → 200 (regex escapada) | ✅ |
| TC-CUS-005 | Filtro `status` y campos no permitidos | `status=inactive` filtra; `sort=passwordHash` → 400; `limit=5000` → 400 | ✅ |
| TC-CUS-006 | Detalle con dirección completa | 200 con `address` y campos opcionales | ✅ |
| TC-CUS-007 | Otra empresa / `:id` inválido / inexistente | 404 / 400 `VALIDATION_ERROR` / 404 | ✅ |
| TC-CUS-008 | Creación completa | 201, correo normalizado a minúsculas, `address`, `isActive:true`, `companyId` propio | ✅ |
| TC-CUS-009 | Cliente mínimo con `''` en opcionales | 201; `email`/`phone`/`address` en la respuesta → `null` (ausentes) | ✅ |
| TC-CUS-010 | Payload inválido / sin `customers.write` / sin token | 400 con `details[]` / 403 / 401 | ✅ |
| TC-CUS-011 | `PATCH` nombre + `address` (reemplazo completo) + estado | 200; campos no enviados intactos; filtro `status` refleja la baja y reactivación | ✅ |
| TC-CUS-012 | `PATCH` limpia opcionales con `''`/solo espacios | 200; en BD `email`/`notes` = `null` (releídos por GET); no enviados intactos | ✅ |
| TC-CUS-013 | `PATCH` vacío / sin permisos / otra empresa | 400 / 403 / 404 | ✅ |
| TC-CUS-014 | `DELETE /customers/:id` | 404 (no existe: la baja es `PATCH {isActive:false}`) | ✅ |

## M09 — Proveedores (integración: `tests/integration/suppliers.integration.test.ts`)

| ID | Descripción | Resultado esperado | Estado |
|---|---|---|---|
| TC-SUP-001 | `GET /suppliers` sin token / sin `suppliers.read` | 401 / 403 | ✅ |
| TC-SUP-002 | Listado con rol `proveeduria` (RBAC positivo) | 200, solo proveedores propios con `address`, sin datos sensibles | ✅ |
| TC-SUP-003 | Paginación consistente | `meta` calculada en backend coherente con `total` real | ✅ |
| TC-SUP-004 | Búsqueda por nombre/contacto/RUC con regex hostiles | `search` filtra; regex hostil → 200 | ✅ |
| TC-SUP-005 | Filtro `status` y campos no permitidos | `status=inactive` filtra; `sort=passwordHash` → 400; `limit=5000` → 400 | ✅ |
| TC-SUP-006 | Detalle con dirección completa | 200, correo en minúsculas y `contactName`/`ruc` | ✅ |
| TC-SUP-007 | Otra empresa / `:id` inválido / inexistente | 404 / 400 / 404 | ✅ |
| TC-SUP-008 | Creación completa | 201, correo normalizado, dirección, `companyId` propio | ✅ |
| TC-SUP-009 | Nombres duplicados | 201 (decisión de negocio: sin unicidad) | ✅ |
| TC-SUP-010 | Payload inválido / sin `suppliers.write` / sin token | 400 con `details[]` / 403 / 401 | ✅ |
| TC-SUP-011 | `PATCH` contacto + `address` (reemplazo completo) + estado | 200; filtro `status` refleja la baja y reactivación | ✅ |
| TC-SUP-012 | `PATCH` limpia opcionales con `''`/solo espacios | 200; en BD `email`/`ruc`/`notes` = `null` (releídos por GET); no enviados intactos | ✅ |
| TC-SUP-013 | `PATCH` vacío / sin permisos / otra empresa | 400 / 403 / 404 | ✅ |
| TC-SUP-014 | `DELETE /suppliers/:id` | 404 (no existe: la baja es `PATCH {isActive:false}`) | ✅ |

## M10 — Almacenes (integración: `tests/integration/warehouses.integration.test.ts`)

| ID | Descripción | Resultado esperado | Estado |
|---|---|---|---|
| TC-WH-001 | `GET /warehouses` sin token / sin `warehouses.read` | 401 `MISSING_TOKEN` / 403 `INSUFFICIENT_PERMISSIONS` | ✅ |
| TC-WH-002 | Listado con rol almacenero (RBAC positivo) | 200, solo almacenes propios, sin datos ajenos ni `passwordHash` | ✅ |
| TC-WH-003 | Filtro `status` y `search` con regex hostiles | `status=inactive` filtra; `search=(((` → 200 (regex escapada) | ✅ |
| TC-WH-004 | Paginación y campos no permitidos | `page=2&limit=1` → `meta` coherente; `sort=passwordHash` → 400; `limit=5000` → 400 | ✅ |
| TC-WH-005 | Detalle con dirección y sucursal | 200 con `address` (string) y `branchId: null` (`branchId` opcional, M05 → Fase 13) | ✅ |
| TC-WH-006 | Otra empresa / `:id` inválido / inexistente | 404 / 400 `VALIDATION_ERROR` / 404 | ✅ |
| TC-WH-007 | Creación con rol almacenero (RBAC positivo) | 201, nombre recortado, `isActive:true`, `companyId` propio | ✅ |
| TC-WH-008 | Nombre duplicado en la empresa | 409 `NAME_IN_USE` | ✅ |
| TC-WH-009 | Payload inválido / sin `warehouses.write` / sin token | 400 con `details[]` / 403 / 401 | ✅ |
| TC-WH-010 | `PATCH` nombre+dirección y `isActive:false` | 200; el filtro `status=inactive` refleja el cambio; reactivación | ✅ |
| TC-WH-011 | `PATCH` vacío / duplicado / sin permisos / otra empresa | 400 / 409 `NAME_IN_USE` / 403 / 404 | ✅ |
| TC-WH-012 | `GET /:id/inventory` tras registrar un movimiento | 200 con la existencia real (`quantityAfter`) del producto | ✅ |
| TC-WH-013 | `GET /:id/inventory` sin token / sin `inventory.read` / otra empresa | 401 / 403 / 404 | ✅ |

## M11 — Inventario (integración: `tests/integration/inventory.integration.test.ts`)

| ID | Descripción | Resultado esperado | Estado |
|---|---|---|---|
| TC-INV-001 | `GET /inventory/stock` y `/inventory/movements` sin token / sin `inventory.read` | 401 / 403 | ✅ |
| TC-INV-002 | Listados iniciales aislados con rol almacenero (RBAC positivo) | 200, solo datos propios, sin secretos | ✅ |
| TC-INV-003 | Movimiento `IN` | 201 con `quantityAfter` correcto y existencia creada/actualizada | ✅ |
| TC-INV-004 | `IN` con `inventory.write` (RBAC positivo) | 201 y el resultado persistido en la existencia | ✅ |
| TC-INV-005 | `OUT` con stock insuficiente | 409 `INSUFFICIENT_STOCK` y el stock no cambia | ✅ |
| TC-INV-006 | `OUT` válido | 201, descuenta y refleja el stock resultante | ✅ |
| TC-INV-007 | `RETURN` | 201, devuelve mercancía al almacén | ✅ |
| TC-INV-008 | `ADJUSTMENT` | 201, fija el recuento absoluto (admite 0) | ✅ |
| TC-INV-009 | `TRANSFER` sin `inventory.transfer` | 403 `INSUFFICIENT_PERMISSIONS` | ✅ |
| TC-INV-010 | `TRANSFER` con `inventory.transfer` | 201, mueve stock: origen −, destino + | ✅ |
| TC-INV-011 | Almacén desactivado | 409 `WAREHOUSE_DISABLED` para OUT/TRANSFER; ADJUSTMENT permitido | ✅ |
| TC-INV-012 | Validación por tipo de movimiento | 400: cantidad ≥ 1 salvo ADJUSTMENT, destino solo en TRANSFER y distinto | ✅ |
| TC-INV-013 | FKs de otra empresa o inexistentes | 400 `WAREHOUSE_NOT_FOUND` / `PRODUCT_NOT_FOUND` | ✅ |
| TC-INV-014 | Filtros de movimientos (`type`, `warehouseId`) y `sort`/`limit` | resultados coherentes; `sort=productId` → 400; `limit=5000` → 400 | ✅ |
| TC-INV-015 | `minStock` y `availability` (low / out_of_stock / in_stock) | `lowStock` derivado; 403 sin `inventory.write` para `minStock` | ✅ |
| TC-INV-016 | `GET /stock/:id` inexistente/ajeno vs `:id` inválido | 404 / 400 `VALIDATION_ERROR` | ✅ |
| TC-INV-017 | `GET /movements/:id` propio y aislamiento | 200 con snapshots; otra empresa → 404 | ✅ |
| TC-INV-018 | Inmovilidad de movimientos | no existen PATCH/DELETE → 404; los documentos no se alteran | ✅ |

---

## M12 — Ventas (integración: `tests/integration/sales.integration.test.ts`)

| ID | Caso | Esperado | Estado |
|---|---|---|---|
| TC-SALE-001 | `GET`/`POST /sales` sin token / sin permiso | 401 / 403 | ✅ |
| TC-SALE-002 | Rol sistema `vendedor` (`sales.read/write`): lista y crea; `cancel` → 403 | RBAC positivo y negativo con el mismo rol; venta intacta tras el 403 | ✅ |
| TC-SALE-003 | Vendedor confirma (`sales.write`) y devuelve (`sales.return`) | 200 con stock `OUT`/`RETURN` verificado; movimientos como conjunto (orden no determinista) | ✅ |
| TC-SALE-004 | Totales calculados por el backend | `unitPrice` enviado 999 → 20 de catálogo; IVA 16 % por línea; cabecera `subtotal 71`, `taxes [{IVA,16,9.6}]`, `total 80.6`; snapshots e `history[created]` | ✅ |
| TC-SALE-005 | Descuento de línea | 10 % aplicado **antes** de impuestos: `discountAmount 4`, IVA sobre 36 → 5.76, `total 41.76` | ✅ |
| TC-SALE-006 | FK inexistentes o de otra empresa | 400 `CUSTOMER_NOT_FOUND` / `WAREHOUSE_NOT_FOUND` / `PRODUCT_NOT_FOUND` | ✅ |
| TC-SALE-007 | Recursos desactivados | 409 `CUSTOMER_DISABLED` / `PRODUCT_INACTIVE` / `WAREHOUSE_DISABLED` | ✅ |
| TC-SALE-008 | Entradas inválidas | 400 `VALIDATION_ERROR`: items vacíos, cantidad 0, producto repetido, id mal formado, discount 101, notas > 500 | ✅ |
| TC-SALE-009 | Confirmar | 200 `confirmed`; stock debitado en la existencia; `OUT` con `documentRef = SALE:<id>` e historial | ✅ |
| TC-SALE-010 | Stock insuficiente al confirmar | 409 `INSUFFICIENT_STOCK` con **rollback total**: venta `pending`, stock y movimientos intactos | ✅ |
| TC-SALE-011 | Doble confirmación | 409 `INVALID_SALE_STATE` sin tocar stock | ✅ |
| TC-SALE-012 | Almacén desactivado tras crear la venta | 409 `WAREHOUSE_DISABLED` y rollback (venta `pending`, sin movimientos) | ✅ |
| TC-SALE-013 | Cancelar pendiente (`sales.cancel`) | 200 `cancelled` sin tocar stock ni generar movimientos | ✅ |
| TC-SALE-014 | Cancelar confirmada | 200 con restock `RETURN` (stock de vuelta al valor previo) | ✅ |
| TC-SALE-015 | Cancelar ya cancelada / devuelta | 409 `INVALID_SALE_STATE` | ✅ |
| TC-SALE-016 | Devolver confirmada (`sales.return`) | 200 `returned`, restock `RETURN`, historial `created → confirmed → returned` | ✅ |
| TC-SALE-017 | Devolver pendiente o ya devuelta | 409 `INVALID_SALE_STATE` sin cambios | ✅ |
| TC-SALE-018 | Filtros del listado | `status`/`customerId`/`warehouseId`/`search` (cliente y SKU sobre snapshots)/`dateFrom`–`dateTo` (ayer–hoy → 8; mañana → 0)/`sort=total` consistente | ✅ |
| TC-SALE-019 | Parámetros de listado inválidos | 400 `VALIDATION_ERROR` (sort, order, limit, status, fecha imposible, rango invertido, customerId) | ✅ |
| TC-SALE-020 | Aislamiento en listado | solo las ventas propias (8); sin `Cliente Ajeno`, `Bob Otro` ni `passwordHash` | ✅ |
| TC-SALE-021 | Detalle e historial | snapshots + `history created → confirmed → returned` y fechas de transición | ✅ |
| TC-SALE-022 | Inmovilidad del documento | `PATCH`/`DELETE /sales/:id` → 404 y la venta no cambia | ✅ |
| TC-SALE-023 | Detalle con id inválido / inexistente / ajeno | 400 `VALIDATION_ERROR` / 404 `Venta no encontrada` / 404 | ✅ |

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
| TC-UNIT-012 | `category.schema.test.ts` / `product.schema.test.ts` | schemas de categoría y producto: SKU normalizado a mayúsculas, impuestos 0–100, precios ≥ 0, imagen URL, defaults, sort/limit, claves desconocidas descartadas | ✅ |
| TC-UNIT-013 | `categories.repository.test.ts` | `buildCategoryFilter`: scope `companyId`, status, búsqueda escapada, regex hostil | ✅ |
| TC-UNIT-014 | `products.repository.test.ts` | `buildProductFilter`: scope `companyId`, categoryId, status, búsqueda multi-campo escapada | ✅ |
| TC-UNIT-015 | `products.service.test.ts` | `toProductSummary`: nombre de categoría, fallback `sin-categoría`, campos opcionales nulos, sin fugas de hash | ✅ |
| TC-UNIT-016 | `warehouse.schema.test.ts` / `inventory.schema.test.ts` | schemas de almacén e inventario: enums de movimiento, cantidad por tipo, `availability`/`minStock`, sort/limit, claves desconocidas descartadas | ✅ |
| TC-UNIT-017 | `warehouses.repository.test.ts` / `inventory.repository.test.ts` | filtros con scope `companyId` (status, type, warehouseId, búsqueda escapada, regex hostil) | ✅ |
| TC-UNIT-018 | `inventory.service.test.ts` | `toMovementSummary`: snapshots de almacén/producto, `quantityAfter`, campos nulos, sin secretos | ✅ |
| TC-UNIT-019 | `customer.schema.test.ts` / `supplier.schema.test.ts` | Diseño B: `''`/espacios/`null` → `null` en UPDATE y ausentes en CREATE, refine "al menos un campo", sort/limit, claves desconocidas descartadas | ✅ |
| TC-UNIT-020 | `customers.repository.test.ts` / `suppliers.repository.test.ts` | filtros con scope `companyId` (status, búsqueda escapada, sort whitelist, regex hostil) | ✅ |
| TC-UNIT-021 | `customers.service.test.ts` / `suppliers.service.test.ts` | mappers: opcionales `|| null` (sin `undefined` en JSON), `address` completa, sin fugas de hash | ✅ |
| TC-UNIT-022 | `sale.schema.test.ts` | CREATE: refs, 1–100 líneas, producto duplicado, cantidad/descuento, notas/fecha; query: defaults, filtros, fecha imposible por round-trip, rango invertido | ✅ |
| TC-UNIT-023 | `sales.service.test.ts` | `roundMoney` (coma flotante), `computeLineTotals` (descuento antes de IVA, multi-impuesto, redondeo), `aggregateTaxes`, `toSaleResponse` (snapshots, `|| null`, historial ISO, sin `passwordHash`) | ✅ |
| TC-UNIT-024 | `sales.repository.test.ts` | `buildSaleFilter`: scope `companyId`, estado/refs a ObjectIds, rango de fechas día UTC inclusivo, búsqueda escapada sobre snapshots | ✅ |

## Pendientes por fase

⏳ Fase 12+: TC-PUR-*… (ver test-plan.md)
