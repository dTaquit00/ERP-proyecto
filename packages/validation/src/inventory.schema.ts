import { z } from 'zod';
import { MOVEMENT_TYPES } from '@erp/types';
import { idSchema, paginationSchema } from './common.schema.js';

/**
 * Alta de movimiento (M11). La cantidad mínima por tipo se valida en el service:
 * IN/OUT/TRANSFER/RETURN requieren ≥ 1; ADJUSTMENT admite 0 (recuento absoluto).
 * TRANSFER exige `toWarehouseId`; los demás tipos no lo admiten (refine).
 */
export const createMovementSchema = z
  .object({
    type: z.enum(MOVEMENT_TYPES),
    warehouseId: idSchema,
    toWarehouseId: idSchema.optional(),
    productId: idSchema,
    quantity: z
      .number()
      .min(0, 'La cantidad no puede ser negativa')
      .max(1_000_000_000, 'La cantidad es demasiado grande'),
    reason: z.string().trim().max(200).optional(),
    documentRef: z.string().trim().max(60).optional(),
  })
  .refine((value) => (value.type === 'TRANSFER') === (value.toWarehouseId !== undefined), {
    message: 'TRANSFER requiere toWarehouseId y los demás tipos no admiten toWarehouseId',
    path: ['toWarehouseId'],
  });
export type CreateMovementInput = z.output<typeof createMovementSchema>;

/** Umbral mínimo de stock por almacén (base para "stock bajo" del dashboard). */
export const updateStockSchema = z.object({
  minStock: z
    .number()
    .min(0, 'El mínimo no puede ser negativo')
    .max(1_000_000_000, 'El mínimo es demasiado grande'),
});
export type UpdateStockInput = z.output<typeof updateStockSchema>;

export const listStockQuerySchema = paginationSchema.extend({
  warehouseId: idSchema.optional(),
  productId: idSchema.optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'low']).optional(),
  sort: z.enum(['quantity', 'minStock', 'updatedAt', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListStockQueryInput = z.output<typeof listStockQuerySchema>;

export const listMovementsQuerySchema = paginationSchema.extend({
  warehouseId: idSchema.optional(),
  productId: idSchema.optional(),
  type: z.enum(MOVEMENT_TYPES).optional(),
  sort: z.enum(['createdAt', 'type', 'quantity']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListMovementsQueryInput = z.output<typeof listMovementsQuerySchema>;
