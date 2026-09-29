# ERP móvil

Aplicación Expo en el workspace `apps/mobile`, conectada únicamente a la API REST.

## Desarrollo

```bash
npm run dev --workspace apps/mobile
```

## Android Studio

Para probar la app en un emulador, instala Android Studio y crea/inicia un dispositivo virtual desde **Device Manager**. Después ejecuta el comando de desarrollo anterior desde la raíz del monorepo y pulsa `a` en la terminal de Expo.

Para abrir el proyecto Android nativo en Android Studio, desde la raíz ejecuta `npx expo prebuild --platform android` y abre `apps/mobile/android` en Android Studio. Expo genera esa carpeta localmente; no es necesario versionarla para el flujo normal de desarrollo administrado.

El proyecto usa Expo SDK 56, React Native 0.85 y React 19.2.3. Requiere Node 20.19 o superior.

Configura `EXPO_PUBLIC_API_URL` con la dirección de la API accesible desde el dispositivo, por ejemplo `http://192.168.1.20:3000/api/v1` en una red local. En un teléfono físico, `localhost` apunta al teléfono y no al equipo que ejecuta la API.

La app guarda el access token con `expo-secure-store` y renueva la sesión usando el endpoint de refresh. Los listados de productos, inventario, ventas y compras leen datos reales de la API; las operaciones de crear, confirmar y recibir todavía están pendientes.

Nunca configures `MONGODB_URI` en la app móvil. MongoDB solo se configura en `apps/api`.
