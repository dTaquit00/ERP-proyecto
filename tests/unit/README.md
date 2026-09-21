# Pruebas unitarias

> Convención: las pruebas unitarias **viven junto al código** que prueban (`*.test.ts`
> dentro de `apps/api/src/...`), siguiendo la estructura de módulo descrita en el
> documento de arquitectura.

Ejemplos actuales:

- `apps/api/src/shared/security/password.test.ts` — hash/verificación de contraseñas
- `apps/api/src/shared/security/jwt.test.ts` — firma/verificación de tokens
- `apps/api/src/shared/http/parse.test.ts` — validación de entradas
- `apps/api/src/shared/http/errors.test.ts` — códigos HTTP de los errores
- `apps/api/src/shared/middleware/authorize.test.ts` — RBAC
- `apps/api/src/config/env.test.ts` — variables de entorno
- `apps/api/src/shared/middleware/rate-limit.test.ts` — límite de solicitudes

Las pruebas de integración (API → service → MongoDB) están en `tests/integration/`.
