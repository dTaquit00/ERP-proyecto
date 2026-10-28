# Pruebas E2E web

La suite automatiza el recorrido principal de DATA ERP en un navegador:

1. Validar login y campos obligatorios.
2. Iniciar sesión como administrador.
3. Crear categoría y producto.
4. Registrar existencias, crear y confirmar una venta.
5. Comprobar que el inventario refleja la venta.
6. Consultar el reporte de ventas y descargarlo en CSV y PDF.
7. Verificar la navegación permitida para los siete roles del sistema.

## Ejecución local

```bash
npm run test:e2e
```

El comando inicia una API y un sitio web locales, y prepara MongoDB en memoria con
una base aislada y datos desechables. No utiliza `MONGODB_URI` ni datos de producción.
Playwright necesita que Chromium esté instalado una vez en el equipo:

```bash
npx playwright install chromium
```

La suite solo se considera ejecutada cuando Playwright completa todos los casos. Si
el entorno no tiene Chromium o no puede descargarlo, quedan pendientes los resultados
de navegador, aunque los builds, tipos y lint pasen.
