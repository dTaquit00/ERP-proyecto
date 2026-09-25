# Despliegue

## Variables

Configurar `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`,
`NODE_ENV=production` y `PORT`. Los secretos deben provenir del gestor de secretos
del proveedor, nunca del repositorio.

## API

```bash
npm ci
npm run build
npm run start:api
```

MongoDB Atlas debe usar replica set para confirmar ventas y recepciones de compras.
Publicar la API detrás de HTTPS con `helmet`, CORS restringido al dominio web y
health check en `/api/v1/health`.

El CI bloquea vulnerabilidades altas y críticas. Actualmente Vitest mantiene dos
avisos moderados que requieren una actualización mayor; deben resolverse en una
ventana de compatibilidad antes de elevar el umbral del pipeline.

## Rollback y datos

Versionar imágenes o artefactos por commit. Antes de migraciones, crear backup de
Atlas. Para rollback, detener la versión nueva, restaurar el artefacto anterior y
verificar `/api/v1/health` y los flujos transaccionales.
