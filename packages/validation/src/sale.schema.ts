import { z } from 'zod';
import { SALE_STATUSES } from '@erp/types';
import { idSchema, paginationSchema } from './common.schema.js';
import { optionalText } from './customer.schema.js';

/**
 * Alta de venta (M12). El cliente envía SOLO referencias y cantidades:
 * precios, impuestos y totales los calcula siempre el backend a partir del
 * catálogo (el precio de línea nunca proviene del cliente).
 *
 * - `items` admite de 1 a 100 líneas y un mismo producto NO puede repetirse.
 * - `discount` es porcentaje de línea (0–100).
 * - `saleDate` opcional (ISO); por defecto se registra el momento de alta.
 */
const saleItemInput = z.object({
  productId: idSchema,
  quantity: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad debe ser al menos 1')
    .max(1_000_000_000, 'La cantidad es demasiado grande'),
  discount: z
    .number()
    .min(0, 'El descuento no puede ser negativo')
    .max(100, 'El descuento no puede superar el 100%')
    .default(0),
});

export const createSaleSchema = z
  .object({
    customerId: idSchema,
    warehouseId: idSchema,
    // M05 sucursales (Fase 13): opcional y sin validación FK todavía.
    branchId: idSchema.optional(),
    saleDate: z.coerce.date().optional(),
    notes: optionalText(500),
    items: z
      .array(saleItemInput)
      .min(1, 'La venta debe tener al menos un producto')
      .max(100, 'La venta no puede exceder 100 líneas'),
  })
  .refine(
    (value) => new Set(value.items.map((item) => item.productId)).size === value.items.length,
    { message: 'Un mismo producto no puede repetirse en la venta', path: ['items'] },
  );
export type CreateSaleInput = z.output<typeof createSaleSchema>;

/**
 * Día calendario completo (`AAAA-MM-DD`); rechaza fechas imposibles
 * (p. ej. 2026-02-31) además del formato. El V8 desborda en silencio las
 * fechas inválidas si llevan componente horario, así que se valida por
 * round-trip: el día parseado debe coincidir con el escrito.
 */
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (uso: AAAA-MM-DD)')
  .refine(
    (value) => {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    },
    'Fecha de calendario inválida',
  );

/**
 * Listado de ventas: búsqueda sobre snapshots (cliente, producto, SKU),
 * filtros de estado/refs y rango de fechas por día calendario UTC
 * (`dateFrom` y `dateTo` son días completos e inclusivos).
 */
export const listSalesQuerySchema = paginationSchema
  .extend({
    search: z.string().trim().max(100).optional(),
    status: z.enum(SALE_STATUSES).optional(),
    customerId: idSchema.optional(),
    warehouseId: idSchema.optional(),
    dateFrom: isoDay.optional(),
    dateTo: isoDay.optional(),
    sort: z.enum(['saleDate', 'total', 'createdAt', 'updatedAt']).default('saleDate'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: 'dateFrom no puede ser posterior a dateTo',
    path: ['dateTo'],
  });
export type ListSalesQueryInput = z.output<typeof listSalesQuerySchema>;
