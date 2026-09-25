# Modelo de datos (MongoDB)

## Principios

1. **Referencia vs documento embebido**: se embebe solo si los datos se leen siempre
   juntos, tienen sentido de pertenencia y no se consultan de forma independiente
   (ej. líneas de una venta → embebidas; cliente de una venta → referencia).
2. `companyId` en todo documento empresarial (multiempresa), incluso si la v1 usa una
   sola empresa.
3. Índices solo donde mejoran consultas frecuentes o garantizan unicidad.
4. **El stock nunca se modifica en silencio**: cada cambio genera un
   `inventory_movements`.

## Colecciones — Fases 6–8 (implementadas)

### companies
| Campo | Tipo | Notas |
|---|---|---|
| name | string | obligatorio |
| legalName, taxId, phone, email, address | string? | M04 |
| status | `active` \| `inactive` | |
| settings | object | configuración empresarial |
| createdAt / updatedAt | Date | timestamps |

Índice: `{name}`.

En el contexto autenticado, el `companyId` del usuario coincide con el `_id` de esta
colección; por eso el service solo permite consultar o modificar el registro cuyo ID
coincide con el contexto y no acepta un `companyId` enviado por el cliente.

### roles (RBAC)
| Campo | Tipo | Notas |
|---|---|---|
| companyId | ObjectId → companies | |
| name | string | minúsculas; único por empresa |
| displayName | string | |
| permissions | string[] | catálogo de `packages/types/permissions.ts` |
| isSystem | boolean | roles del sistema no se eliminan |

Índice único: `{companyId, name}`.

### users
| Campo | Tipo | Notas |
|---|---|---|
| companyId | ObjectId | |
| email | string | minúsculas; único por empresa |
| passwordHash | string | `select: false`; scrypt |
| firstName, lastName | string | |
| roleId | ObjectId → roles | |
| isActive | boolean | login/requests lo verifican |
| lastLoginAt, passwordChangedAt | Date? | control de sesiones |

Índice único: `{companyId, email}`; índice `{companyId, roleId}`.

### sessions (refresh tokens)
| Campo | Tipo | Notas |
|---|---|---|
| userId | ObjectId | |
| tokenHash | string | SHA-256 del token; único |
| ip, userAgent | string? | trazabilidad |
| expiresAt | Date | índice TTL (`expireAfterSeconds: 0`) |
| lastUsedAt, revokedAt | Date? | rotación, logout, revocaciones |

Índices: `{tokenHash}` único, `{expiresAt}` TTL, `{userId, revokedAt}`.

### password_reset_tokens
`userId`, `tokenHash` (único), `expiresAt` (TTL), `usedAt` (un solo uso).

### categories (M06)
| Campo | Tipo | Notas |
|---|---|---|
| companyId | ObjectId → companies | |
| name | string | único por empresa |
| description | string? | |
| isActive | boolean | baja lógica (M06: "desactivar"; no hay borrado físico) |
| createdAt / updatedAt | Date | timestamps |

Índice único: `{companyId, name}`; índice `{companyId, isActive}`.

### products (M07)
| Campo | Tipo | Notas |
|---|---|---|
| companyId | ObjectId → companies | |
| code | string? | código interno |
| sku | string | normalizado en mayúsculas; **único por empresa** |
| name | string | |
| description | string? | |
| categoryId | ObjectId → categories | debe pertenecer a la misma empresa (validado en service) |
| purchasePrice, salePrice | number | ≥ 0; los totales los calcula el backend (Fase 11) |
| taxes | `[{ name, rate }]` | impuestos configurables; rate 0–100; sin `_id` |
| unit | string | pza, kg, lt… |
| isActive | boolean | estado del producto |
| image | string? (URL) | |
| barcode | string? | |

Índices: único `{companyId, sku}`; `{companyId, categoryId}`; `{companyId, isActive}`.

## Colecciones — por fase

| Colección | Fase | Notas clave |
|---|---|---|
| branches | 13 | sucursales; `{companyId, code}` único |
| customers / suppliers | 10 ✅ | `address` subdocumento `{_id:false}` reemplazado completo en PATCH; **sin unicidad** de nombre/correo/DNI/RUC; opcionales en blanco → `null`; referenciados por ventas/compras (Fase 11–12) |
| warehouses | 9 ✅ | referencian `branchId` |
| stock_balances | 9 ✅ | `{companyId, warehouseId, productId}` único → consulta rápida de existencias |
| inventory_movements | 9 ✅ | tipo `IN OUT ADJUSTMENT TRANSFER RETURN`; documento inmutable con stock resultante |
| sales | 11 ✅ | estados `pending/confirmed/cancelled/returned`; cabecera con snapshots + `items[]` embebidos (precio/impuestos del momento) + `history[]` de transiciones |
| purchases | 12 | ítems embebidos; recepción genera movimientos IN |
| cash_movements | futuro | finanzas |
| audit_logs | 15 | usuario, acción, recurso, resourceId, ip, resultado, fecha |

### Justificaciones de diseño

- **Ítems embebidos en ventas/compras**: se leen siempre con la cabecera y son
  inmutables tras confirmar (snapshot del precio del momento); no se consultan solos.
- **Transacciones de venta (Fase 11)**: confirmar/cancelar/devolver cambia la venta y
  el stock a la vez; exige replica set (Atlas lo es). Helper compartido:
  `apps/api/src/shared/db/transaction.ts` — compras (Fase 12) lo reutiliza.
- **stock_balances separado de movements**: la existencia actual es una consulta
  caliente (dashboard, disponibilidad); el histórico es append-only y grande.
- **audit_logs separado**: crecimiento independiente, sin joins con datos de negocio,
  y política propia de retención. Nunca almacena contraseñas ni tokens.
- **Relación usuario↔rol por referencia**: el rol cambia sin duplicar permisos.

## Índices globales por consulta frecuente

- Ventas: `{companyId, saleDate}`, `{companyId, status, saleDate}`, `{companyId, customerId, saleDate}`, `{companyId, warehouseId, saleDate}`
- Movimientos: `{companyId, productId, createdAt}`, `{warehouseId, createdAt}`
- Auditoría: `{companyId, createdAt}`, `{companyId, resource, resourceId}`
