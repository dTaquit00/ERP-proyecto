# Frontend

## Web

`apps/web` es una aplicación React con TypeScript, React Router y Vite. Ejecutar:

```bash
npm run dev --workspace apps/web
npm run build --workspace apps/web
```

En desarrollo, Vite reenvía `/api/v1` a `http://localhost:3000`. Para usar otra
API se configura `VITE_API_URL`; en Cloudflare Pages se usa la Pages Function del
mismo origen. El cliente usa cookies `HttpOnly` para refresh y mantiene una sola
promesa de refresh para solicitudes concurrentes.
En Ventas → Nueva venta, un lector USB de código de barras/QR configurado como
teclado puede agregar productos al emitir el código y Enter. El backend busca
por código de barras, SKU o código interno; cada lectura suma una unidad.
Los selectores que requieren catálogos de referencia recorren las páginas de la
API hasta cargar todos los resultados, respetando el permiso de lectura de cada
catálogo. En los movimientos de inventario se admiten cantidades decimales mayores o
iguales a 1 según la unidad; cada lectura de código de barras agrega una unidad.
Los ajustes representan la existencia final; al cambiar el almacén de origen de un
traslado se invalida un destino que coincida con el nuevo origen.

## Móvil

`apps/mobile` usa Expo y React Native. Ejecutar `npm run dev --workspace apps/mobile`.
La URL de API se configura con `EXPO_PUBLIC_API_URL`. El móvil no accede nunca a
MongoDB directamente.
