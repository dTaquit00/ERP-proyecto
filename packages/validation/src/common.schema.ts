import { z } from 'zod';

/** Identificador de documento MongoDB (24 hex). */
export const idSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/, 'Identificador inválido');

/** Correo normalizado: sin espacios, en minúsculas. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Correo electrónico inválido')
  .max(254, 'Correo electrónico demasiado largo')
  .email('Correo electrónico inválido');

/**
 * Política de contraseña: 8–128 caracteres con al menos una letra y un dígito.
 * (El hash nunca se calcula ni se almacena en texto plano.)
 */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede exceder 128 caracteres')
  .refine((value) => /[A-Za-z]/.test(value), {
    message: 'La contraseña debe contener al menos una letra',
  })
  .refine((value) => /\d/.test(value), {
    message: 'La contraseña debe contener al menos un dígito',
  });

/** Parámetros de paginación (acepta strings provenientes de la query string). */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
