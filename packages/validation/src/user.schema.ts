import { z } from 'zod';
import { emailSchema, idSchema, paginationSchema, passwordSchema } from './common.schema.js';

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100),
  roleId: idSchema,
  isActive: z.boolean().default(true),
});
export type CreateUserInput = z.output<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    email: emailSchema.optional(),
    firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(100).optional(),
    lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(100).optional(),
    roleId: idSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debes indicar al menos un campo a actualizar',
  });
export type UpdateUserInput = z.output<typeof updateUserSchema>;

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  roleId: idSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum(['email', 'firstName', 'lastName', 'createdAt', 'lastLoginAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListUsersQueryInput = z.output<typeof listUsersQuerySchema>;
