# Adaptación del ERP a Gym OMH

## Decisión de tecnología y referencias

El usuario confirmó conservar TypeScript, React, Express y MongoDB. La propuesta
académica menciona Python/MySQL, pero se usa como referencia de dominio y no como
instrucción de migración. Se revisaron la propuesta de desarrollo, el alcance, el
estado del arte y los dos ZIP proporcionados. Los ZIP son de Solfibras: aportan
ideas de organización de panel, catálogo y sitio público; su código y recursos no
se ejecutaron ni incorporaron al proyecto.

## Dos superficies conectadas

1. ERP interno: socios, membresías e inscripciones, productos, ventas y posteriormente
   asesoramientos registrados por entrenadores.
2. Página externa: información del gimnasio, servicios, actividades y catálogo;
   posteriormente acceso privado de cada socio a su propia información.

La página externa consultará una API con respuestas públicas explícitas. No debe
reutilizar endpoints administrativos ni exponer datos de socios. Las cuentas de
los socios deberán tener alcance propio, independiente de los roles del equipo.

## Primera etapa implementada

| Necesidad | Función |
|---|---|
| Socios | Alta, consulta, búsqueda por nombre/número/correo, edición y baja lógica |
| Contacto | Número de socio único por empresa, nombre, apellidos, correo y teléfono |
| Ventas | Cliente vinculado automáticamente al socio para usar el flujo actual de ventas |
| Membresías | Catálogo con nombre, descripción, duración en días, precio MXN y disponibilidad |
| Inscripciones | Socio, plan, fecha de inicio, monto recibido y notas administrativas |
| Vigencia | Fin calculado por el servidor: inicio + duración - 1 días, ambos incluidos |
| Estado | Programada, vigente, vencida o cancelada; evaluado en America/Mexico_City |
| Historial | Precio, nombre del plan y duración conservados como snapshot |
| Renovaciones | Periodos consecutivos permitidos; periodos solapados bloqueados incluso en concurrencia |
| Cancelaciones | Conservan el registro y su monto; no crean reembolsos |

Se registra el monto recibido fuera del sistema, con su saldo calculado. Esta
etapa no realiza cobros en línea, facturas ni conciliaciones de caja. Se evitan
datos médicos o de lesiones en la ficha administrativa.

La creación del socio y su cliente es atómica. La ficha administrativa del socio
es la fuente del nombre y contacto sincronizados hacia Clientes. La baja del
socio conserva el cliente y su historial de ventas. Los registros existentes de
Clientes no se convierten automáticamente en socios.

## Permisos y despliegue

Los permisos nuevos son `members.read/write`, `memberships.read/write` y
`enrollments.read/write`. Se pueden asignar a roles personalizados desde Roles.
La API agrega estos permisos al administrador del sistema de forma aditiva e
idempotente al iniciar; no modifica los roles personalizados del equipo.

Las rutas web `/gym/members`, `/gym/plans` y `/gym/enrollments` están protegidas
por los mismos permisos. Toda consulta API está limitada a la empresa de la sesión.
La nueva etapa requiere desplegar la API y la web juntas.

## Tienda y portal de socios

La ruta `/` y `/tienda` presentan Gym OMH y su catálogo sin iniciar sesión.
`/login` conserva el acceso compartido; las cuentas con solo `portal.read`
entran a `/mi-cuenta`, mientras que el personal conserva su página administrativa.

### Publicación del catálogo

1. En Empresa, activar **Habilitar esta empresa como tienda pública Gym OMH** y guardar.
2. Activar esa opción en una sola empresa. Si ninguna o varias están habilitadas,
   el catálogo público permanece vacío para evitar mezclar datos de empresas.
3. En Productos, marcar **Visible en la tienda pública de Gym OMH** en los
   productos que se desean publicar y guardar. Los demás siguen privados.

El endpoint `/api/v1/public/store/products` devuelve únicamente ID, nombre,
descripción, precio público con los impuestos configurados, imagen, unidad y
nombre de categoría. No entrega costos, existencias internas, proveedores ni
identificadores de empresa. La selección de empresa no se toma del navegador.
La compra y el cobro se confirman en recepción; no hay carrito, pasarela ni cobros
en línea en esta etapa.

### Acceso de socios

Desde la ficha de un socio activo, el administrador puede usar **Crear acceso del
socio** con correo y contraseña inicial. Requiere `members.write` y `users.write`.
La API crea el usuario y su vínculo en una transacción, con un rol personalizado
`socio` limitado a `portal.read`. No reutiliza cuentas administrativas ni cambia
contraseñas de usuarios existentes. No envía contraseñas por correo automáticamente.

`/api/v1/portal/me` resuelve al socio por empresa y usuario autenticados, no por
un ID suministrado desde el navegador. Devuelve su membresía actual, días restantes
(incluido el día actual), próxima inscripción e historial. Excluye notas internas,
otros socios y datos administrativos. Una ficha inactiva conserva el historial,
pero se presenta sin membresía habilitada. Los días se calculan usando la fecha
de America/Mexico_City; las inscripciones vencidas o canceladas tienen cero días.

La cuenta puede cambiar su contraseña desde el flujo existente. No se agrega
registro público libre: recepción verifica la ficha antes de crear el acceso.

## Siguientes incrementos pendientes

- Entrenadores, asignación de asesoramientos y seguimiento con alcance por socio.
- Asesoramientos dentro del portal del socio.
- Contenido público ampliado de servicios y actividades, validado con el gimnasio.
- Configuración de horarios, domicilio, contactos, logotipo y fotografías propias.
- Indicadores y reportes específicos del gimnasio.
- Pruebas de navegación completa en navegador, accesibilidad y validación con el gimnasio.

No se considera implementado lo anterior por el hecho de disponer de la primera
etapa. IA, pagos en línea y una aplicación móvil nativa no forman parte de esta
adaptación inicial.
