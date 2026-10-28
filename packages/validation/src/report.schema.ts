import { z } from 'zod';
import { idSchema, paginationSchema } from './common.schema.js';

const reportFiltersSchema = z.object({
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
const isValidDateRange = (query: { dateFrom?: Date; dateTo?: Date }) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo;
const dateRangeIssue = { message: 'La fecha inicial no puede ser posterior a la fecha final', path: ['dateTo'] };

export const reportQuerySchema = reportFiltersSchema.refine(isValidDateRange, dateRangeIssue);
export type ReportQueryInput = z.output<typeof reportQuerySchema>;

export const listReportQuerySchema = paginationSchema.extend(reportFiltersSchema.shape).refine(isValidDateRange, dateRangeIssue);
export type ListReportQueryInput = z.output<typeof listReportQuerySchema>;
