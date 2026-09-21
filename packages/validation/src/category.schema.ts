import { z } from 'zod';
import { paginationSchema } from './common.schema.js';

/** Nombre de categoría: 2–80 caracteres, sin cambiar la capitalización. */
export const categoryNameSchema = z.string().trim().min(2).max(80);

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  description: z.string().trim().max(500).optional(),
});
export type CreateCategoryInput = z.output<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    description: z.string().trim().max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debes indicar al menos un campo a actualizar',
  });
export type UpdateCategoryInput = z.output<typeof updateCategorySchema>;

export const listCategoriesQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListCategoriesQueryInput = z.output<typeof listCategoriesQuerySchema>;
