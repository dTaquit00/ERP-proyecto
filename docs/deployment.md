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

Para que la recuperación de contraseña entregue correos, configurar en el servicio
de API `RESEND_API_KEY`, `RESEND_FROM` y `WEB_APP_URL`. `RESEND_FROM` debe usar un
dominio verificado en Resend para enviar a destinatarios externos; el remitente de
prueba `onboarding@resend.dev` sirve únicamente para las limitaciones de prueba de
Resend. `WEB_APP_URL` debe ser el origen público de la web (por ejemplo,
`https://erp-proyecto.pages.dev`); ahí se construye el enlace a `/reset-password`.

## Web (Cloudflare Pages)

Conectar el repositorio y configurar el directorio raíz `apps/web`, el comando de
compilación `npm run build` y el directorio de salida `dist`. En las variables de
entorno de Pages, definir `API_ORIGIN` como el origen HTTPS de la API de Render,
por ejemplo `https://data-erp-api.onrender.com` (sin `/api/v1`). La Pages Function
`functions/api/[[path]].ts` reenvía la ruta recibida (incluido `/api/v1`) al origen
configurado. La variable `API_ORIGIN` debe ser una URL completa con protocolo HTTPS.

El CI bloquea vulnerabilidades altas y críticas. La revisión del 25 de noviembre
de 2026 actualizó Vitest a 4.1.12 y las dependencias compatibles. La auditoría de
producción de API y web reportó cero avisos. La auditoría general conserva
12 avisos de la cadena de Expo del módulo móvil (9 moderados y 3 altos).
Por ello el paso de auditoría general seguirá señalando un fallo hasta migrar
Expo y verificar la aplicación móvil en un dispositivo.

## Rollback y datos

Versionar imágenes o artefactos por commit. Antes de migraciones, crear backup de
Atlas. Para rollback, detener la versión nueva, restaurar el artefacto anterior y
verificar `/api/v1/health` y los flujos transaccionales.
