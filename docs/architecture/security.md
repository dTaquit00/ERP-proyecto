# Seguridad

Estado: Fase 6 (autenticación). Marco completo por fase en `docs/qa/quality-checklist.md`.

## Implementado (Fase 4–6)

### Autenticación
- Contraseñas con **scrypt** (`N=16384, r=8, p=1`, sal aleatoria de 16 bytes,
  comparación con `timingSafeEqual`). Nunca texto plano, nunca en logs
  (redacción de pino: `password`, `accessToken`, `refreshToken`, cabeceras).
- **Access token JWT** HS256, 15 min (`JWT_ACCESS_TTL_SECONDS`), con `typ: 'access'`
  (se rechazan tokens con otro `typ`), `sub`, `companyId`, `roleId` y `sid`.
- **Refresh token opaco** (48 bytes aleatorios) guardado **solo como SHA-256** en
  `sessions`: si la colección se expone, los tokens no son utilizables.
  - Cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción,
    `Path=/api/v1/auth`, expiración alineada con la sesión.
  - **Rotación** en cada refresh: el token anterior deja de ser válido (reuso → 401).
  - **Logout** revoca la sesión; **cambio/reset de contraseña** revoca todas las
    sesiones del usuario.
- **Sin enumeración de usuarios**: login fallido idéntico para correo inexistente y
  contraseña incorrecta, con tiempo de respuesta equalizado (hash ficticio).
  El reset de contraseña responde 200 siempre.

### Autorización (RBAC)
- `authenticate` carga usuario + rol **desde la BD en cada request**: desactivar un
  usuario o quitarle permisos surte efecto inmediato.
- `authorize(permisos)` exige todos los permisos indicados → 403
  `INSUFFICIENT_PERMISSIONS`. Los permisos del rol se filtran contra el catálogo
  (`isPermission`): una BD alterada no puede ampliar permisos.
- Cuenta desactivada → 403 `ACCOUNT_DISABLED`; rol inexistente → 500 (fail closed).

### Validación y errores
- Toda la entrada pasa por Zod (`parseOrThrow`) → 400 `VALIDATION_ERROR` con
  `details[]` por campo. Sin datos sanitizados por regex peligrosos; Mongoose evita
  la inyección NoSQL (los operadores `$` no llegan a las consultas como objetos).
- Manejador global: `{error:{code,message}}`, sin stack traces en producción
  (solo 5xx en desarrollo). Cuerpo JSON limitado a 1 MB.

### Transporte y superficie
- **helmet** (headers de seguridad), **CORS** con orígenes explícitos de
  `CORS_ORIGIN` y `credentials: true`.
- **Rate limiting**: global (`RATE_LIMIT_MAX`) y estricto en endpoints de auth
  (`RATE_LIMIT_AUTH_MAX`), respuesta 429 `RATE_LIMITED` en formato estándar.
  `/health` queda fuera del límite para sondas de monitoreo.
- Logs estructurados con **redacción** de secretos.

### Secretos
- Ningún secreto en el código: todo por variables de entorno validadas al arrancar
  (la API no arranca con secretos faltantes o débiles).
- `.env` ignorado por Git; solo se versiona `.env.example`.

## Planificado

| Medida | Fase |
|---|---|
| `audit_logs`: login, cambios de contraseña, operaciones empresariales | 15 |
| Transacciones multi-documento (ventas → inventario) | 11–12 |
| Revisión de dependencias (`npm audit`) y CSP para el frontend | 17 |
| Pruebas de seguridad (pentest interno de casos negativos) | 17 |
| HTTPS obligatorio detrás de proxy / headers HSTS en producción | 20 |

## Reglas permanentes

- ❌ Contraseñas en texto plano o reversibles
- ❌ Secretos en Git o expuestos al frontend
- ❌ Conexión frontend → MongoDB
- ❌ Autorización confiada solo en el frontend
- ❌ Registrar contraseñas, tokens completos o credenciales
