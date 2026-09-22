# ERP — Sistema Empresarial Multiempresa

ERP web y móvil para centralizar la administración de usuarios, roles y permisos, clientes,
proveedores, productos, inventarios, ventas, compras, dashboard, reportes y auditoría.

Construido con **TypeScript estricto** en todo el stack:

| Capa | Tecnología |
|---|---|
| Móvil | React Native + TypeScript |
| Web | React Native Web + TypeScript |
| API | Node.js + Express + TypeScript |
| Base de datos | MongoDB Atlas (Mongoose) |
| Validación | Zod (schemas compartidos) |
| Pruebas | Vitest + Supertest + mongodb-memory-server |

> Estado actual: **Fase 10 completada** — monorepo, API base, seguridad, MongoDB,
> autenticación (M01), usuarios (M02), roles/permisos (M03), categorías (M06),
> productos (M07), almacenes (M10), inventario (M11), clientes (M08) y
> proveedores (M09), con RBAC verificado en backend y pruebas unitarias e de
> integración. Los módulos restantes se construyen por fases según
> `docs/requirements/requirements.md`.

---

## Arquitectura

```
React Native / React Native Web
        ↓  (REST / JSON + JWT)
   API REST  /api/v1
        ↓
 Node.js + Express (controllers)
        ↓
 Servicios / reglas de negocio
        ↓
 Repositorios (única capa que toca la BD)
        ↓
    MongoDB Atlas
```

Reglas fijas:

- El frontend **nunca** se conecta a MongoDB: todo pasa por la API.
- El backend **siempre** calcula totales, valida entradas y verifica permisos (RBAC).
- Toda operación empresarial lleva `companyId` (aislamiento multiempresa).
- Multiempresa: un usuario jamás consulta datos de otra empresa aunque conozca el ID.

Estructura del monorepo (npm workspaces):

```
ERP/
├── apps/
│   ├── api/        Express + TS (arquitectura por módulo: routes → controller → service → repository → model)
│   ├── web/        React Native Web (Fase 16)
│   └── mobile/     React Native (Fase 16)
├── packages/
│   ├── types/        Tipos compartidos (ApiResponse, permisos, payloads)
│   ├── validation/   Schemas Zod compartidos API ↔ clientes
│   ├── ui/           Componentes compartidos (Fase 16)
│   └── config/       tsconfig base compartido
├── tests/
│   ├── unit/         (convención: unitarias junto al código, ver abajo)
│   ├── integration/  API → service → MongoDB con mongodb-memory-server
│   └── e2e/          Fase 17
├── docs/
│   ├── architecture/ architecture.md · database.md · security.md
│   ├── requirements/ requirements.md
│   ├── api/          api.md
│   └── qa/           test-plan.md · test-cases.md · bug-report.md · quality-checklist.md
├── .env.example
├── package.json      (workspaces)
├── tsconfig.json     (typecheck de todo el repo, rutas de alias)
└── vitest.config.ts
```

### Convención de módulo (backend)

```
modules/sales/
├── sales.routes.ts       endpoints + middlewares
├── sales.controller.ts   HTTP: parsea entrada, llama al service, responde
├── sales.service.ts      reglas de negocio
├── sales.repository.ts   acceso a MongoDB
├── sales.model.ts        esquema persistente (Mongoose)
├── sales.types.ts        tipos TypeScript del módulo
└── sales.service.test.ts pruebas unitarias junto al código
```

Las validaciones de entrada viven en `packages/validation` (fuente única compartida
con los clientes); las pruebas unitarias se colocan junto al módulo que prueban.

---

## Requisitos

- Node.js ≥ 20 (probado con Node 24)
- npm ≥ 11
- Una base de datos MongoDB Atlas (o MongoDB local para desarrollo)

## Instalación

```bash
git clone <repo>
cd ERP
npm install
cp .env.example .env   # y completar los valores
```

## Variables de entorno

Ver `.env.example`. Las obligatorias son:

| Variable | Descripción |
|---|---|
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas |
| `JWT_ACCESS_SECRET` | Secreto del access token (≥16 chars; usa `openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Secreto distinto para la sesión/refresh |

Opcionales: `PORT`, `JWT_ACCESS_TTL_SECONDS`, `REFRESH_TTL_DAYS`, `CORS_ORIGIN`,
`LOG_LEVEL`, límites de rate limiting y parámetros del seed.

**Nunca** subas un `.env` real al repositorio: `.env` está en `.gitignore` y solo
se versiona `.env.example`.

## Ejecución

```bash
npm run seed       # crea empresa, roles del sistema y usuario administrador (idempotente)
npm run dev:api    # API en http://localhost:3000/api/v1 (modo watch)
```

El seed imprime una contraseña aleatoria si `SEED_ADMIN_PASSWORD` está vacío.

## Pruebas

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript estricto (tsc --noEmit implícito)
npm test           # typecheck + unitarias + integración (Vitest)
npm run build      # compila packages + api a dist/
```

Las integraciones usan **mongodb-memory-server**: no necesitas una base de datos
real para ejecutar `npm test`.

## API

Base: `/api/v1`. Convención completa en `docs/api/api.md`.

Éxito: `{ "data": ... }` · Error: `{ "error": { "code", "message", "details?" } }`

Endpoints (Fases 6–10):

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | Login (devuelve access token + cookie httpOnly de refresh) |
| POST | `/auth/refresh` | Rotación de sesión |
| POST | `/auth/logout` | Revoca la sesión |
| GET | `/auth/me` | Usuario autenticado + permisos |
| POST | `/auth/change-password` | Cambio de contraseña (revoca otras sesiones) |
| POST | `/auth/request-password-reset` | Solicitud de restablecimiento |
| POST | `/auth/reset-password` | Aplica el restablecimiento (un solo uso) |
| GET, POST | `/users` | Listado paginado con filtros / creación (`users.read`/`users.write`) |
| GET, PATCH | `/users/:id` | Detalle / edición (incluye cambio de rol) |
| POST | `/users/:id/activate`, `/users/:id/deactivate` | Activar / desactivar con protecciones (`SELF_DEACTIVATE`, `LAST_ACTIVE_ADMIN`) |
| GET | `/users/:id/history` | Fechas reales + sesiones recientes |
| GET, POST | `/roles` | Roles con `userCount` / creación (`roles.read`/`roles.write`) |
| GET, PATCH, DELETE | `/roles/:id` | Detalle / edición / borrado protegido (`SYSTEM_ROLE`, `ROLE_IN_USE`) |
| GET | `/permissions` | Catálogo de permisos para el editor de roles |
| GET, POST | `/categories` | Categorías con `productCount` / creación (`categories.read`/`categories.write`) |
| GET, PATCH | `/categories/:id` | Detalle / edición y alta-baja lógica (`isActive`); 409 `NAME_IN_USE` |
| GET, POST | `/products` | Catálogo con `categoryName` y filtros (`products.read`/`products.write`) |
| GET, PATCH | `/products/:id` | Detalle / edición; SKU único por empresa (409 `SKU_IN_USE`) |
| GET, POST | `/customers` | Clientes con filtros (`customers.read`/`customers.write`); sin unicidad de nombre/correo |
| GET, PATCH | `/customers/:id` | Detalle / edición; `''` limpia el campo (persiste `null`); baja con `PATCH {isActive:false}` |
| GET, POST | `/suppliers` | Proveedores con filtros (`suppliers.read`/`suppliers.write`); sin unicidad de nombre/RUC |
| GET, PATCH | `/suppliers/:id` | Detalle / edición; `''` limpia el campo (persiste `null`); baja con `PATCH {isActive:false}` |
| GET, POST | `/warehouses` | Almacenes con filtros (`warehouses.read`/`warehouses.write`) |
| GET, PATCH | `/warehouses/:id` | Detalle / edición y alta-baja lógica (`isActive`); 409 `NAME_IN_USE` |
| GET | `/warehouses/:id/inventory` | Existencias reales del almacén (`inventory.read`) |
| GET | `/inventory/stock` | Existencias con `minStock`, `lowStock` y `availability` |
| GET, PATCH | `/inventory/stock/:id` | Detalle / recuento manual de una existencia (`inventory.write`) |
| GET | `/inventory/movements` | Movimientos inmutables, filtros por tipo/almacén |
| GET | `/inventory/movements/:id` | Detalle de movimiento (solo lectura: sin PATCH/DELETE) |
| POST | `/inventory/movements` | Registrar `IN`/`OUT`/`RETURN`/`ADJUSTMENT`/`TRANSFER` (`inventory.transfer` extra para TRANSFER) |
| GET | `/health` | Estado del servidor y de MongoDB |

## Base de datos

Colecciones: `users`, `roles`, `companies`, `sessions`, `password_reset_tokens`
(fase 6), `categories`, `products` (fase 8), `warehouses`, `stock_balances`,
`inventory_movements` (fase 9) y `customers`, `suppliers` (fase 10); por fase,
`branches`, `sales`, `purchases`, `cash_movements`, `audit_logs`.
Detalle y justificación de cada relación en `docs/architecture/database.md`.

## Seguridad

- Contraseñas con **scrypt** (nunca texto plano), JWT HS256 de corta duración.
- Refresh token opaco guardado **solo como SHA-256**, rotado en cada uso, en cookie
  `httpOnly` con `SameSite=Lax` y `Secure` en producción.
- RBAC verificado en backend (`authenticate` + `authorize`).
- Validación Zod de toda la entrada, rate limiting (global + estricto en auth),
  helmet, CORS por origen explícito, logs estructurados con redacción de secretos.
- Sin enumeración de usuarios: respuestas idénticas para correo inexistente y
  contraseña incorrecta; tiempo de respuesta equalizado.
- Detalle completo en `docs/architecture/security.md`.

## Contribuir

1. Trabajar por fases: no avanzar con errores críticos en la fase actual.
2. TypeScript estricto: sin `any` si hay alternativa tipada.
3. Toda funcionalidad nueva incluye pruebas (unitarias + casos negativos) y docs.
4. Verificar antes de entregar: `npm run lint && npm test && npm run build`.
5. Bugs documentados en `docs/qa/bug-report.md` con formato `BUG-001`.
