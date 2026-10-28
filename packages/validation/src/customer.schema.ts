import { z } from 'zod';
import { emailSchema, paginationSchema } from './common.schema.js';

/** `null` o cadena que queda vacía tras `trim()` → "sin valor" para el usuario. */
function isBlank(value: unknown): boolean {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Texto opcional para CREATE: lo en blanco se omite y no se almacena.
 * Compartido con M09 (proveedores): los formularios suelen enviar `''`/espacios.
 */
export function optionalText(max: number) {
  return z.preprocess(
    (value) => (isBlank(value) ? undefined : value),
    z.string().trim().max(max).optional(),
  );
}

/**
 * Texto opcional para UPDATE: lo en blanco se convierte en `null` (borrado
 * explícito). Como `null !== undefined`, el `refine` de "al menos un campo" lo
 * cuenta como una actualización válida y `saveChanges` lo persiste como null.
 */
export function clearableText(max: number) {
  return z.preprocess(
    (value) => (isBlank(value) ? null : value),
    z.string().trim().max(max).nullable().optional(),
  );
}

/** Correo opcional para CREATE (normalizado a minúsculas cuando existe). */
export const optionalEmail = z.preprocess(
  (value) => (isBlank(value) ? undefined : value),
  emailSchema.optional(),
);

/** Correo para UPDATE: en blanco → `null` (borrado); válido → normalizado. */
export const clearableEmail = z.preprocess(
  (value) => (isBlank(value) ? null : value),
  emailSchema.nullable().optional(),
);

const phoneValueSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^\+?[0-9().\s-]+$/, 'El teléfono solo puede incluir números, espacios y + ( ) . -')
  .refine((value) => {
    const digits = value.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
  }, 'El teléfono debe contener entre 7 y 15 dígitos');

const optionalPhone = z.preprocess(
  (value) => (isBlank(value) ? undefined : value),
  phoneValueSchema.optional(),
);

const clearablePhone = z.preprocess(
  (value) => (isBlank(value) ? null : value),
  phoneValueSchema.nullable().optional(),
);

const optionalMexicanPostalCode = z.preprocess(
  (value) => (isBlank(value) ? undefined : value),
  z.string().trim().regex(/^\d{5}$/, 'El código postal debe tener 5 dígitos').optional(),
);

/** Dirección opcional: todos sus componentes son opcionales. */
export const addressSchema = z.object({
  street: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  zipCode: optionalText(20),
});

const customerAddressSchema = addressSchema.extend({ zipCode: optionalMexicanPostalCode });

const customerFields = {
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  email: optionalEmail,
  phone: optionalPhone,
  dni: optionalText(20),
  address: customerAddressSchema.optional(),
  notes: optionalText(1000),
};

export const createCustomerSchema = z.object(customerFields);
export type CreateCustomerInput = z.output<typeof createCustomerSchema>;

/**
 * UPDATE: los campos opcionales en blanco (`''`, solo espacios o `null`)
 * significan "borrar" y se envían como `null`; un cuerpo sin campos se rechaza.
 */
export const updateCustomerSchema = z
  .object({
    name: customerFields.name.optional(),
    email: clearableEmail,
    phone: clearablePhone,
    dni: clearableText(20),
    // La dirección se reemplaza completa (envía todos los campos que quieras conservar).
    address: customerAddressSchema.optional(),
    notes: clearableText(1000),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debes indicar al menos un campo a actualizar',
  });
export type UpdateCustomerInput = z.output<typeof updateCustomerSchema>;

export const listCustomersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum(['name', 'email', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListCustomersQueryInput = z.output<typeof listCustomersQuerySchema>;
