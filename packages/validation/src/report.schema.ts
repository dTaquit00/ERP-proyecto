import { z } from 'zod';
import { idSchema } from './common.schema.js';

export const reportQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  branchId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  productId: idSchema.optional(),
  categoryId: idSchema.optional(),
  customerId: idSchema.optional(),
  supplierId: idSchema.optional(),
  userId: idSchema.optional(),
  status: z.string().trim().max(40).optional(),
});
export type ReportQueryInput = z.output<typeof reportQuerySchema>;
