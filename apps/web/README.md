# @erp/web — DATA ERP Web

Aplicación web React + TypeScript + Vite que consume la API REST de `apps/api`.
La interfaz no se conecta directamente a MongoDB y los listados se consultan con
paginación.

## Desarrollo y compilación

```bash
npm run dev --workspace apps/web
npm run build --workspace apps/web
```

Configura `VITE_API_URL` con la URL base de la API (por ejemplo,
`https://data-erp-api.onrender.com/api/v1`).

## Punto de venta

En **Ventas → Nueva venta**, escribe o escanea el código de barras en el campo
de lectura. Los lectores USB que funcionan como teclado deben enviar Enter al
terminar cada lectura. Se busca el código de barras, SKU o código interno de
un producto activo; cada lectura agrega una unidad y las lecturas repetidas
incrementan la cantidad. También se pueden capturar productos manualmente.

Un lector de QR que envíe el contenido como teclado puede usarse si el QR
contiene uno de esos códigos. La venta sigue siendo pendiente hasta que alguien
con permiso la confirme; el servidor calcula los importes y aplica el
movimiento de inventario.
