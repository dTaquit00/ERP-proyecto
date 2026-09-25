import { z } from 'zod';
import { paginationSchema } from './common.schema.js';

export const listAuditQuerySchema = paginationSchema.extend({
  userId: z.string().regex(/^[0-9a-f]{24}$/).optional(),
  action: z.string().trim().max(80).optional(),
  resource: z.string().trim().max(80).optional(),
  result: z.enum(['success', 'failure']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListAuditQueryInput = z.output<typeof listAuditQuerySchema>;
