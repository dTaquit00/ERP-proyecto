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

## Pendiente para fases siguientes

- [ ] Auditoría (`audit_logs`) al confirmar operaciones empresariales — Fase 15
- [ ] Transacciones multi-documento — Fase 11–12
- [ ] Paginación/filtros en todos los listados — desde Fase 7
- [ ] `npm audit` + pentest interno — Fase 17–18
- [ ] E2E completo (login → venta → inventario → reporte) — Fase 17
