# Requisitos del ERP (M01–M16)

Especificación resumida por módulo y su estado por fase. Toda funcionalidad nueva
debe pasar la "Definición de terminado" (ver `docs/qa/quality-checklist.md`).

## Multiempresa (transversal)

- Todo documento empresarial lleva `companyId`.
- El backend comprueba que el usuario solo accede a datos de sus empresas,
  aunque conozca el ID de otra (aislamiento horizontal).

| ID | Módulo | Requisitos esenciales | Fase |
|---|---|---|---|
| M01 | Autenticación | Login, logout, refresh con rotación, recuperación y cambio de contraseña, protección de rutas, expiración y control de sesiones | 6 ✅ |
| M02 | Usuarios | Crear, editar, activar/desactivar, consultar, cambiar rol, historial | 7 ✅ |
| M03 | Roles y permisos | RBAC; roles: administrador, gerente, vendedor, almacén, compras, finanzas, auditor; el **backend** verifica permisos | 7 ✅ |
| M04 | Empresas | nombre, razón social, identificación fiscal, teléfono, correo, dirección, estado, configuración | 13 |
| M05 | Sucursales | Crear, editar, desactivar, consultar | 13 |
| M06 | Categorías | Crear, editar, desactivar, consultar | 8 ✅ |
| M07 | Productos | código, SKU (único por empresa), nombre, descripción, categoría, precio compra/venta, impuestos configurables, unidad, estado, imagen, código de barras; validaciones | 8 ✅ |
| M08 | Clientes | Registrar, editar, consultar, desactivar, historial de compras | 10 ✅ |
| M09 | Proveedores | Registrar, editar, consultar, desactivar, historial de compras | 10 ✅ |
| M10 | Almacenes | Crear, asociar a sucursal, activar/desactivar, consultar inventario | 9 ✅ |
| M11 | Inventario | Existencias, entradas, salidas, ajustes, transferencias, devoluciones, movimientos e historial. **Nunca modificar stock sin generar un movimiento** (`IN OUT ADJUSTMENT TRANSFER RETURN`) | 9 ✅ |
| M12 | Ventas | Crear, consultar, listar, buscar, confirmar, cancelar (permisos), devolución, historial. El **backend calcula el total**: cliente, usuario, productos, cantidades, precios, subtotal, impuestos, total, estado, fecha, sucursal, almacén | 11 |
| M13 | Compras | Orden, consultar, confirmar, recibir mercancía (→ inventario), cancelar, devoluciones | 12 |
| M14 | Dashboard | Ventas del día/mes, compras, stock bajo, agotados, clientes, proveedores, inventario, últimas ventas/compras. **Datos reales vía API, sin datos falsos** | 13 |
| M15 | Reportes | ventas, compras, inventario, movimientos, productos, clientes, proveedores; filtros (fecha, usuario, sucursal, almacén, producto, cliente, proveedor); exportar CSV/PDF | 14 |
| M16 | Auditoría | `audit_logs`: usuario, acción, recurso, ID, fecha, IP, resultado. Sin contraseñas ni secretos | 15 |

## Fases

1. Diagnóstico ✅
2–3. Monorepo + configs ✅
4. API base ✅
5. MongoDB Atlas ✅
6. Autenticación ✅
7. Usuarios y permisos ✅
8. Productos y categorías ✅
9. Inventario ✅
10. Clientes y proveedores ✅
11. Ventas
12. Compras
13. Dashboard
14. Reportes
15. Auditoría
16. Frontend web + móvil
17. Pruebas integrales (E2E)
18. Seguridad
19. Optimización
20. Documentación y producción

## Definición de "terminado"

Un módulo está TERMINADO cuando:

- [ ] Funcionalidad implementada
- [ ] Requisitos documentados
- [ ] Validaciones implementadas
- [ ] Permisos implementados (backend)
- [ ] API documentada
- [ ] Pruebas unitarias
- [ ] Pruebas de integración cuando correspondan
- [ ] Casos negativos probados
- [ ] Errores corregidos
- [ ] Lint correcto
- [ ] TypeScript sin errores
- [ ] Sin secretos en el código
- [ ] Auditoría implementada cuando corresponda
- [ ] Documentación actualizada
- [ ] Revisión final de código
