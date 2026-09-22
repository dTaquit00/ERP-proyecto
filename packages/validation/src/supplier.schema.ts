import { z } from 'zod';
import { paginationSchema } from './common.schema.js';
import {
  addressSchema,
  clearableEmail,
  clearableText,
  optionalEmail,
  optionalText,
} from './customer.schema.js';

const supplierFields = {
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  contactName: optionalText(120),
  email: optionalEmail,
  phone: optionalText(30),
  ruc: optionalText(20),
  address: addressSchema.optional(),
  notes: optionalText(1000),
};

export const createSupplierSchema = z.object(supplierFields);
export type CreateSupplierInput = z.output<typeof createSupplierSchema>;

/** UPDATE: lo en blanco (`''`/espacios/`null`) significa "borrar" (→ `null`). */
export const updateSupplierSchema = z
  .object({
    name: supplierFields.name.optional(),
    contactName: clearableText(120),
    email: clearableEmail,
    phone: clearableText(30),
    ruc: clearableText(20),
    // La dirección se reemplaza completa (envía todos los campos que quieras conservar).
    address: addressSchema.optional(),
    notes: clearableText(1000),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debes indicar al menos un campo a actualizar',
  });
export type UpdateSupplierInput = z.output<typeof updateSupplierSchema>;

export const listSuppliersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum(['name', 'contactName', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListSuppliersQueryInput = z.output<typeof listSuppliersQuerySchema>;
