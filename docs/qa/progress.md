# Matriz de avance real

| Módulo | Backend | Web | Mobile | Unit | Integration | E2E | Security | Docs | Estado |
|---|---|---|---|---|---|---|---|---|---|
| M01 Auth | Sí | Login, refresh, cambio/recuperación de contraseña y expiración inmediata de sesiones revocadas | Login + refresh base | Sí | Sí | Smoke preparado | Sí | Sí | Integrado web; falta E2E |
| M02 Users | Sí | CRUD, activación, historial y revocación de todas las sesiones activas | No | Sí | Sí | No | RBAC | Sí | Integrado web; falta E2E |
| M03 RBAC | Sí | Sidebar y edición de permisos/roles con catálogo servido por API | No | Sí | Sí | No | Sí | Sí | Integrado web; falta E2E |
| M04 Companies | Sí | Consulta/edición de perfil y settings JSON | No | Sí | Sí | No | Bootstrap restringido | Sí | Integrado web; alta solo plataforma |
| M05 Branches | Sí | CRUD y activar/desactivar | No | Parcial | Sí | No | Multiempresa | Sí | Integrado web; falta E2E |
| M06 Categories | Sí | CRUD y desactivación | No | Sí | Sí | No | Sí | Sí | Integrado web; falta E2E |
| M07 Products | Sí | CRUD de catálogo con impuestos, imagen y código de barras | No | Sí | Sí | No | Sí | Sí | Integrado web; falta E2E |
| M08 Customers | Sí | CRUD, baja lógica e historial de ventas | No | Sí | Sí | No | Sí | Sí | Integrado web; falta E2E |
| M09 Suppliers | Sí | CRUD, baja lógica e historial de compras | No | Sí | Sí | No | Sí | Sí | Integrado web; falta E2E |
| M10 Warehouses | Sí | CRUD, asociación a sucursal e inventario por almacén | No | Sí | Sí | No | Sí | Sí | Integrado web; falta E2E |
| M11 Inventory | Sí | Existencias, mínimos configurables, movimientos e historial de operaciones | No | Sí | Sí | No | Sí | Sí | Integrado web; falta E2E |
| M12 Sales | Sí | Multiartículo, lector teclado de barcode/QR, listado, detalle/historial y transiciones | No | Sí | Sí | No | Sí | Sí | Integrado web; falta E2E |
| M13 Purchases | Sí | Multiartículo, recepción parcial, detalle/historial y transiciones | No | Parcial | Sí | No | Sí | Sí | Integrado web; falta E2E |
| M14 Dashboard | Sí | Indicadores y ventas/compras/movimientos recientes reales | Dashboard | No | Parcial | No | Sí | Sí | Integrado web; falta E2E |
| M15 Reports | CSV/PDF | Selección de tipo, formato y filtros, incluida sucursal para inventario/movimientos | No | No | Parcial | No | Límite/injection | Sí | Integrado web; falta E2E |
| M16 Audit | Sí | Listado, filtros y detalle de eventos | No | No | Parcial | No | Redacción base | Sí | Integrado web; falta E2E |

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

- Navegación y flujos de negocio móviles.
- E2E de negocio venta/compra/inventario/auditoría/aislamiento.
- Streaming de exportaciones grandes.
- Revisión de compatibilidad Vitest 5.
