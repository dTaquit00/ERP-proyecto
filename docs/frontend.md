# Frontend

## Web

`apps/web` usa React Native Web, React y Vite. Ejecutar:

```bash
npm run dev --workspace apps/web
npm run build --workspace apps/web
```

La URL de API se configura con `VITE_API_URL`. El cliente usa cookies `HttpOnly`
para refresh y mantiene una sola promesa de refresh para solicitudes concurrentes.
En Ventas → Nueva venta, un lector USB de código de barras/QR configurado como
teclado puede agregar productos al emitir el código y Enter. El backend busca
por código de barras, SKU o código interno; cada lectura suma una unidad.

## Móvil

`apps/mobile` usa Expo y React Native. Ejecutar `npm run dev --workspace apps/mobile`.
La URL de API se configura con `EXPO_PUBLIC_API_URL`. El móvil no accede nunca a
MongoDB directamente.
