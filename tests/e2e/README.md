# Pruebas E2E

> Estado: pendiente — se implementan en la **Fase 17** (pruebas integrales), cuando existan
> los módulos de productos, ventas e inventario, y el frontend web.

Flujo E2E previsto:

1. Login (usuario administrador)
2. Crear categoría y producto
3. Seleccionar producto
4. Crear venta
5. Confirmar venta
6. Verificar movimiento y stock en inventario
7. Consultar reporte de ventas

Herramienta prevista: Vitest + supertest para E2E de API y, cuando exista frontend,
Playwright para E2E de navegador (web) y Detox para móvil.
