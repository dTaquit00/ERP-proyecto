# Matriz de avance real

| Módulo | Backend | Web | Mobile | Unit | Integration | E2E | Security | Docs | Estado |
|---|---|---|---|---|---|---|---|---|---|
| M01 Auth | Sí | Login + refresh + AuthProvider | Login + refresh base | Sí | Sí | Smoke preparado | Sí | Sí | Parcial integrado |
| M02 Users | Sí | Listado | No | Sí | Sí | No | RBAC | Sí | Backend operativo |
| M03 RBAC | Sí | Sidebar filtrado | No | Sí | Sí | No | Sí | Sí | Parcial integrado |
| M04 Companies | Sí | No | No | Sí | Sí | No | Bootstrap restringido | Sí | Backend operativo |
| M05 Branches | Sí | Listado | No | Parcial | Sí | No | Multiempresa | Sí | Parcial integrado |
| M06 Categories | Sí | Listado | No | Sí | Sí | No | Sí | Sí | Parcial integrado |
| M07 Products | Sí | Listado | No | Sí | Sí | No | Sí | Sí | Parcial integrado |
| M08 Customers | Sí | Listado | No | Sí | Sí | No | Sí | Sí | Parcial integrado |
| M09 Suppliers | Sí | Listado | No | Sí | Sí | No | Sí | Sí | Parcial integrado |
| M10 Warehouses | Sí | Listado | No | Sí | Sí | No | Sí | Sí | Parcial integrado |
| M11 Inventory | Sí | Listado | No | Sí | Sí | No | Sí | Sí | Parcial integrado |
| M12 Sales | Sí | Listado | No | Sí | Sí | No | Sí | Sí | Backend operativo |
| M13 Purchases | Sí | Listado | No | Parcial | Sí | No | Sí | Sí | Parcial integrado |
| M14 Dashboard | Sí | Dashboard + routing | Dashboard | No | Parcial | No | Sí | Sí | Parcial integrado |
| M15 Reports | CSV/PDF | Enlace exportación | No | No | Parcial | No | Límite/injection | Sí | Parcial integrado |
| M16 Audit | Sí | Listado API pendiente | No | No | Parcial | No | Redacción base | Sí | Backend operativo |

## Verificación actual

- Instalación limpia: correcta.
- Lint: correcto.
- Typecheck raíz: correcto.
- Tests: 45 archivos, 375 pruebas exitosas.
- Build API: correcto.
- Build web: correcto.
- Typecheck móvil: correcto.
- `npm audit --audit-level=moderate`: 2 vulnerabilidades moderadas de Vitest; solución automática implica actualización mayor.
- Playwright: configuración y smoke creados; ejecución local bloqueada por timeout al descargar Chromium.

## Pendientes que no deben marcarse como terminados

- Formularios CRUD web y flujos POS/recepción completos.
- Navegación y flujos de negocio móviles.
- E2E de negocio venta/compra/inventario/auditoría/aislamiento.
- Scanner barcode/QR.
- Streaming de exportaciones grandes.
- Revisión de compatibilidad Vitest 5.
