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

## Siguientes incrementos pendientes

- Entrenadores, asignación de asesoramientos y seguimiento con alcance por socio.
- Portal del socio con acceso exclusivamente a su ficha y asesoramientos.
- Sitio público Gym OMH con contenido real validado, servicios, actividades y catálogo.
- Configuración de horarios, domicilio, contactos, logotipo y fotografías propias.
- Indicadores y reportes específicos del gimnasio.
- Pruebas de navegación completa en navegador, accesibilidad y validación con el gimnasio.

No se considera implementado lo anterior por el hecho de disponer de la primera
etapa. IA, pagos en línea y una aplicación móvil nativa no forman parte de esta
adaptación inicial.
