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
| M15 Reports | CSV/PDF | Selección de tipo, formato y filtros por reporte, incluida sucursal para inventario/movimientos | No | No | Parcial | No | Límite/injection | Sí | Integrado web; falta E2E |
| M16 Audit | Sí | Listado, filtros y detalle de eventos | No | No | Parcial | No | Redacción base | Sí | Integrado web; falta E2E |
| M17 Socios Gym OMH | Sí | Alta, búsqueda, edición y baja lógica; cliente vinculado | No | Validación | Sí | Pendiente | RBAC + multiempresa | Sí | Primera etapa; pendiente despliegue |
| M18 Membresías Gym OMH | Sí | Planes, duración en días, precio y disponibilidad | No | Validación | Sí | Pendiente | RBAC + multiempresa | Sí | Primera etapa; pendiente despliegue |
| M19 Inscripciones Gym OMH | Sí | Alta, consulta, vigencia e historial/cancelación | No | Validación | Sí | Pendiente | Transacciones + bloqueo de solapamientos | Sí | Primera etapa; pendiente despliegue |

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



## Corrección de formularios — 29 de octubre de 2026

- Corregido el recurso que reciben las rutas de alta y detalle de Usuarios, Roles,
  Clientes, Proveedores, Almacenes, Sucursales y Empresas.
- Verificación de rutas sin navegador: 14 casos correctos con el enrutador real.
- Suite completa: 46 archivos y 389 pruebas correctas, incluyendo las 14 de rutas,
  creación de usuarios, asignación de roles, permisos, compras, ventas e inventario.
- Compilación API y web correctas. Lint sin errores (39 advertencias existentes en móvil).
- Nuevos recorridos Playwright preparados para los formularios y usuarios/roles;
  no ejecutados: descarga de Chromium agotó el tiempo de espera.
- Conexión local a Atlas verificada con ping correcto tras usar la cadena estándar
  con TLS y agregar la IP actual a la lista de acceso del proyecto.
- Lote privado aplicado: cuatro cuentas nuevas activas con roles combinados y
  cuenta administradora existente conservada. Asignaciones y hashes de las
  contraseñas iniciales verificados. Datos personales y accesos solo en `.local/`,
  excluida de Git. Correcciones web aún pendientes de despliegue.

## Visibilidad por rol — 29 de octubre de 2026

- Menú y acceso por URL protegidos antes de montar las pantallas.
- Inicio de sesión dirigido a un módulo permitido.
- Dashboard web y respuesta API limitados a los módulos autorizados.
- Reportes y exportaciones CSV/PDF exigen lectura del módulo además del permiso
  de reportes. El selector solo ofrece reportes autorizados.
- Pruebas de permisos de los siete roles base y las cuatro combinaciones del equipo,
  con datos temporales y sin alterar las cuentas reales.
- Verificación final: 48 archivos y 428 pruebas correctas; compilación API y web
  correcta, TypeScript correcto y lint sin errores (39 advertencias existentes en móvil).
- Cambios pendientes de despliegue de web y API para aplicarse en el sitio público.

## Pendientes generales

## Adaptación Gym OMH — 4 de noviembre de 2026

- Confirmado conservar TypeScript y MongoDB; los documentos son referencias de
  dominio y los archivos PHP no se ejecutan ni se importan a la aplicación.
- Nuevos módulos: socios vinculados a Clientes, catálogo de membresías e
  inscripciones con vigencia, saldo registrado, historial y cancelación.
- API con permisos independientes, aislamiento multiempresa e índices únicos.
  La creación de socio/cliente y de inscripciones es transaccional; se evitan
  periodos solapados incluso con solicitudes concurrentes.
- Página pública, portal del socio y asesoramientos siguen pendientes. El diseño
  y la separación de esas superficies están en `docs/requirements/gym-omh.md`.
- No se cargaron datos de prueba ni se cambiaron usuarios reales en Atlas.
- Verificación: 51 archivos y 452 pruebas correctas con
  `npm test -- --maxWorkers=2`; se limitaron los procesos porque el arranque
  simultáneo de varias réplicas temporales agotaba el límite de 10 segundos.
- Despliegue de API y web y pruebas completas en navegador pendientes.

## Otros pendientes generales

## Tienda pública y cuenta del socio — 4 de noviembre de 2026

- Portada Gym OMH y catálogo público en `/` y `/tienda`, con búsqueda,
  paginación y detalle de productos. Publicación explícita por empresa y producto.
- Alta administrativa de cuentas de socio, vínculo único e identidad por sesión.
- Panel `/mi-cuenta` con membresía, fecha final, días restantes e historial.
- Permisos administrativos bloqueados en interfaz y API para el rol de socio.
- Vista previa local revisada en formato móvil y escritorio con base temporal.
- Verificación final: 53 archivos y 469 pruebas correctas con dos procesos;
  compilación API/web correcta y lint sin errores (39 advertencias previas de móvil).
- Pagos en línea y registro público libre no implementados.
- Despliegue de web y API pendiente de confirmación.

## Pendientes generales restantes

- Navegación y flujos de negocio móviles.
- E2E de negocio venta/compra/inventario/auditoría/aislamiento.
- Streaming de exportaciones grandes.
- Revisión de compatibilidad Vitest 5.
