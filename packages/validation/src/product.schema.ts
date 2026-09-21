import { z } from 'zod';
import { idSchema, paginationSchema } from './common.schema.js';

/**
 * SKU: se normaliza a mayúsculas (la unicidad se comprueba sobre el valor
 * normalizado, por lo que `abc-123` y `ABC-123` son el mismo SKU).
 */
export const productSkuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'El SKU es obligatorio')
  .max(40)
  .regex(/^[A-Z0-9._-]+$/, 'Usa solo letras, números, puntos, guiones o guiones bajos');

/** Impuesto configurable: nombre + tasa porcentual 0–100. */
export const productTaxSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del impuesto es obligatorio').max(40),
  rate: z.number().min(0, 'La tasa no puede ser negativa').max(100, 'La tasa máxima es 100'),
});

const productFields = {
  code: z.string().trim().max(60).optional(),
  sku: productSkuSchema,
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  description: z.string().trim().max(1000).optional(),
  categoryId: idSchema,
  purchasePrice: z
    .number()
    .min(0, 'El precio de compra no puede ser negativo')
    .max(1_000_000_000),
  salePrice: z.number().min(0, 'El precio de venta no puede ser negativo').max(1_000_000_000),
  taxes: z.array(productTaxSchema).max(10).default([]),
  unit: z.string().trim().min(1, 'La unidad es obligatoria').max(20),
  isActive: z.boolean().default(true),
  image: z.string().trim().max(500).url('La imagen debe ser una URL válida').optional(),
  barcode: z.string().trim().max(60).optional(),
};

export const createProductSchema = z.object(productFields);
export type CreateProductInput = z.output<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    code: productFields.code,
    sku: productFields.sku.optional(),
    name: productFields.name.optional(),
    description: productFields.description,
    categoryId: productFields.categoryId.optional(),
    purchasePrice: productFields.purchasePrice.optional(),
    salePrice: productFields.salePrice.optional(),
    taxes: z.array(productTaxSchema).max(10).optional(),
    unit: productFields.unit.optional(),
    isActive: z.boolean().optional(),
    image: productFields.image,
    barcode: productFields.barcode,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debes indicar al menos un campo a actualizar',
  });
export type UpdateProductInput = z.output<typeof updateProductSchema>;

export const listProductsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  categoryId: idSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z
    .enum(['sku', 'name', 'purchasePrice', 'salePrice', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListProductsQueryInput = z.output<typeof listProductsQuerySchema>;
