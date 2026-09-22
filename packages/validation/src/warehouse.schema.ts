import { z } from 'zod';
import { idSchema, paginationSchema } from './common.schema.js';

export const warehouseNameSchema = z.string().trim().min(2).max(80);

export const createWarehouseSchema = z.object({
  name: warehouseNameSchema,
  address: z.string().trim().max(200).optional(),
  // M05 sucursales: FK validada cuando exista el módulo (Fase 13); hoy opcional.
  branchId: idSchema.optional(),
  isActive: z.boolean().default(true),
});
export type CreateWarehouseInput = z.output<typeof createWarehouseSchema>;

export const updateWarehouseSchema = z
  .object({
    name: warehouseNameSchema.optional(),
    address: z.string().trim().max(200).optional(),
    // `null` desvincula la sucursal.
    branchId: idSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debes indicar al menos un campo a actualizar',
  });
export type UpdateWarehouseInput = z.output<typeof updateWarehouseSchema>;

export const listWarehousesQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListWarehousesQueryInput = z.output<typeof listWarehousesQuerySchema>;
