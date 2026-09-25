# Operaciones

- Supervisar `/api/v1/health` y logs JSON de la API.
- Alertar por errores 5xx, fallos de autenticación, latencia y estado degradado de MongoDB.
- Revisar auditoría con `GET /api/v1/audit-logs` para acciones críticas.
- Mantener backups de MongoDB Atlas y probar restauración periódicamente.
- Ejecutar CI antes de publicar: lint, typecheck, pruebas, build y audit.
