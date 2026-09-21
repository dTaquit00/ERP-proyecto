# Reporte de errores

Formato obligatorio (numeración correlativa):

```
BUG-001
Módulo:
Severidad:  Baja | Media | Alta | Crítica
Prioridad:  P1 | P2 | P3

Descripción:

Pasos para reproducir:

Resultado esperado:

Resultado actual:

Causa probable:

Solución:

Prueba realizada:

Estado: Abierto | En proceso | Resuelto | Verificado | Cerrado
```

---

## Registro

| ID | Módulo | Severidad | Prioridad | Estado | Resumen |
|---|---|---|---|---|---|
| BUG-001 | Rate limit (pruebas) | Baja | P3 | Resuelto | La app de prueba del rate limit no montaba `errorHandler`: el 429 salía en formato HTML por defecto en lugar de `{error:{code,message}}`. **Solución**: montar el `errorHandler` real en la app del test. **Prueba**: `rate-limit.test.ts` → 429 `RATE_LIMITED` con formato estándar ✅ |
| BUG-002 | Auth / refresh (pruebas) | Baja | P3 | Resuelto | El test de rotación comparaba access tokens, que pueden ser idénticos si se emiten en el mismo segundo (HS256 determinista con mismo payload e `iat`). **Solución**: el invariante correcto es que la cookie `refreshToken` cambia; se verifica además que el nuevo access token funciona en `/me`. **Prueba**: `auth.integration.test.ts` ✅ |
| BUG-003 | Build API | Media | P2 | Resuelto | `apps/api/tsconfig.build.json` heredaba los `paths` del tsconfig raíz (apuntaban al fuente de los packages) y `rootDir: src` rechazaba esos archivos (TS6059). **Solución**: `paths: {}` en el build — resuelve `@erp/*` vía `node_modules` → `dist`; el typecheck/editor sigue usando `paths` → src. **Prueba**: `npm run build` ✅ |
| BUG-004 | Build API / packages | Media | P2 | Resuelto | `tsconfig.base.json` no declaraba `declaration: true`: los packages emitían solo `.js` sin `.d.ts`, el build del API perdía los tipos de `@erp/types` (TS7016) y dos errores derivados aparecieron en `seed.ts`. **Solución**: `declaration`/`declarationMap` en la config compartida (el build de la API los sobreescribe a `false`). **Prueba**: `npm run build` + `npm test` ✅ |
| BUG-005 | Build / repositorio | Media | P2 | Resuelto | El build fallido de BUG-003 emitió `.js`/`.js.map` junto al fuente de `packages/*/src` (tsc emite pese a errores porque no había `noEmitOnError`) y 9 archivos strays entraron al commit inicial. **Solución**: `noEmitOnError: true` en la config compartida, reglas en `.gitignore` para salida accidental en `src/`, eliminación de los archivos y amend del commit. **Prueba**: `npm run build` en verde, `git ls-files` sin `.js` en `src/` (0) ✅ |

### Correcciones previas al cierre (sin ticket)

- Filtro de permisos sin lógica real en `toAuthUserResponse` → ahora usa `isPermission`.
- Expresión residual en la asignación de permisos del rol auditor (seed).
- Función no usada en `companies.repository`.
- `ObjectId` pasados donde se esperaba `string` (`roleId`) en auth.service/authenticate.
