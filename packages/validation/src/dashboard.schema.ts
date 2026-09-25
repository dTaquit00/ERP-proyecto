import { z } from 'zod';
import { idSchema } from './common.schema.js';

export const dashboardQuerySchema = z.object({
  branchId: idSchema.optional(),
  warehouseId: idSchema.optional(),
});
export type DashboardQueryInput = z.output<typeof dashboardQuerySchema>;
