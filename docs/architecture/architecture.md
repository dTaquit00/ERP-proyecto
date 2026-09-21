# Arquitectura

## 1. Visión general

Monorepo con npm workspaces y TypeScript estricto en todas las capas.

```
apps/mobile (React Native)   apps/web (React Native Web)
                \             /
                 ↓ JSON + JWT
            apps/api  (Express + TS)
                 ↓
     controllers → services → repositories
                 ↓
            MongoDB Atlas (Mongoose)
```

Decisiones clave y su justificación:

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| npm workspaces | Nx / Turbo | Suficiente para 3 apps + 4 packages hoy; cero dependencias extra; migrable después |
| Zod como única fuente de validación | class-validator / validaciones ad-hoc | Un solo schema tipado sirve a API y clientes; errores estructurados `details[]` |
| Arquitectura por módulo (routes→controller→service→repository→model) | Capas globales por tipo | Cada módulo crece sin tocar a los demás; extraíble y testeable |
| scrypt (node:crypto) para contraseñas | bcrypt / argon2 nativos | Nativo de Node, sin compilación en Windows, parámetros embebidos en el hash |
| Access JWT corto + refresh opaco rotativo en cookie httpOnly | JWT largo | Revocación real (logout, cambio de contraseña, reuso detectado) |
| Permisos leídos de la BD en cada request | Permisos solo en el token | Cambios de rol/desactivación surten efecto inmediato |
| `createApp()` sin side effects | app que escucha puertos | Permite supertest y pruebas de integración limpias |
| Respuestas `{data}` / `{error}` | formats heterogéneos | Contrato único y documentable para web y móvil |

## 2. Estructura de un módulo backend

```
modules/<modulo>/
├── <modulo>.routes.ts       endpoints + middlewares (rate limit, authenticate, authorize)
├── <modulo>.controller.ts   HTTP: parsea entrada (parseOrThrow), llama al service, responde
├── <modulo>.service.ts      reglas de negocio; lanza AppError con código de negocio
├── <modulo>.repository.ts   única capa que consulta MongoDB
├── <modulo>.model.ts        esquema Mongoose + índices
├── <modulo>.types.ts        tipos del módulo
└── *.test.ts                unitarias junto al código
```

Reglas:

- Los controllers no contienen lógica de negocio ni consultas.
- Los services no conocen `Request`/`Response`.
- Los repositories no lanzan errores HTTP: devuelven documentos o `null`.
- La validación de entrada vive en `packages/validation` (compartida con clientes).

## 3. Middleware y flujo de una petición

```
helmet → cors → express.json → cookie-parser → pino-http
  → /health (sin rate limit)
  → rate limit global
  → /api/v1/<módulo>
      → authRateLimiter (auth)
      → authenticate  (JWT → usuario+rol desde BD → req.auth)
      → authorize('permiso')  (RBAC)
      → controller (parseOrThrow → service)
  → notFoundHandler → errorHandler (formato {error:{code,message}})
```

## 4. Multiempresa

- Todo documento empresarial lleva `companyId`.
- El access token incluye `companyId`; `authenticate` reconstruye el contexto desde BD.
- `authorize` opera sobre permisos del rol **dentro** de la empresa del usuario.
- Índices compuestos `{companyId: ..., campo: ...}` (unicidad y búsquedas por empresa).
- En Fase 8+ cada repository filtrará por `companyId` proveniente de `req.auth`
  (nunca del cuerpo de la petición).

## 5. Consistencia transaccional

MongoDB admite transacciones multi-documento con replica set (Atlas lo es). Operaciones
que deben ser atómicas (confirmar venta → venta + stock + movimiento + auditoría) se
ejecutarán dentro de `mongoose.startSession()` / `withTransaction` (Fase 11–12).
Si alguna operación falla, no quedan datos parciales.

## 6. Escalabilidad

- Paginación obligatoria en listados (`page`, `limit ≤ 100`, `total`).
- Índices solo donde mejoran consultas frecuentes (ver `database.md`).
- Repositorios aíslan el motor de datos: migrar o añadir caché no toca services.
- Logging estructurado (pino) listo para monitoreo; `/health` expone estado de BD.
- Rate limiting y límites de payload ya activos.

## 7. Estado por fase

| Fase | Contenido | Estado |
|---|---|---|
| 2–3 | Monorepo, configs, TS estricto, lint, tests | ✅ |
| 4 | API base: respuestas, errores, logging, health | ✅ |
| 5 | Conexión MongoDB + repositorios + índices | ✅ |
| 6 | M01 Autenticación (login/refresh/logout/reset/cambio) | ✅ |
| 7 | M02 Usuarios + M03 Roles/permisos (CRUD + RBAC completo) | ✅ |
| 8–15 | Productos, inventario, clientes/proveedores, ventas, compras, dashboard, reportes, auditoría | ⏳ |
| 16 | Frontend web + móvil | ⏳ |
| 17–20 | E2E, seguridad, optimización, docs, producción | ⏳ |
