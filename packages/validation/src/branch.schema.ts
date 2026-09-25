import { z } from 'zod';
import { idParamsSchema, paginationSchema } from './common.schema.js';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const branchFieldsSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  address: optionalText(300),
  phone: optionalText(50),
  email: z.string().trim().email('El correo no es válido').max(254).optional(),
  manager: optionalText(160),
  isActive: z.boolean(),
});

export const createBranchSchema = branchFieldsSchema.extend({ isActive: z.boolean().default(true) });
export const updateBranchSchema = branchFieldsSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Debes indicar al menos un campo a actualizar',
);
export const listBranchesQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export const branchIdParamsSchema = idParamsSchema;

export type CreateBranchInput = z.output<typeof createBranchSchema>;
export type UpdateBranchInput = z.output<typeof updateBranchSchema>;
export type ListBranchesQueryInput = z.output<typeof listBranchesQuerySchema>;
