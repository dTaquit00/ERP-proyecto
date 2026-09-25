import { z } from 'zod';
import { idSchema, paginationSchema } from './common.schema.js';

const taxSchema = z.object({ name: z.string().trim().min(1).max(80), rate: z.number().min(0).max(100) });
const purchaseLineSchema = z.object({
  productId: idSchema,
  quantity: z.number().int().min(1).max(1_000_000_000),
  unitCost: z.number().min(0).max(1_000_000_000),
  discount: z.number().min(0).max(100).default(0),
  taxes: z.array(taxSchema).default([]),
});

export const createPurchaseSchema = z.object({
  supplierId: idSchema,
  warehouseId: idSchema,
  branchId: idSchema.optional(),
  purchaseDate: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(purchaseLineSchema).min(1).max(100),
}).refine((value) => new Set(value.items.map((item) => item.productId)).size === value.items.length, {
  message: 'Un mismo producto no puede repetirse en la compra', path: ['items'],
});
export type CreatePurchaseInput = z.output<typeof createPurchaseSchema>;

export const receivePurchaseSchema = z.object({
  items: z.array(z.object({ productId: idSchema, quantity: z.number().int().min(1) })).min(1),
}).refine((value) => new Set(value.items.map((item) => item.productId)).size === value.items.length, {
  message: 'Un mismo producto no puede repetirse en la recepción', path: ['items'],
});
export type ReceivePurchaseInput = z.output<typeof receivePurchaseSchema>;

/** Header opcional para hacer idempotentes los reintentos de una recepción. */
export const receiptIdempotencyKeySchema = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/);

export const listPurchasesQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'confirmed', 'partially_received', 'received', 'cancelled', 'returned']).optional(),
  supplierId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  sort: z.enum(['purchaseDate', 'total', 'createdAt', 'updatedAt']).default('purchaseDate'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListPurchasesQueryInput = z.output<typeof listPurchasesQuerySchema>;
