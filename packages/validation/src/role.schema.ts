import { z } from 'zod';
import { isPermission } from '@erp/types';
import { paginationSchema } from './common.schema.js';

/** Valida que el permiso pertenezca al catálogo del sistema (RBAC). */
export const permissionSchema = z
  .string()
  .refine((value) => isPermission(value), { message: 'Permiso no reconocido' });

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(60)
    .regex(/^[a-z0-9_-]+$/, 'Usa solo minúsculas, números, guiones o guiones bajos'),
  displayName: z.string().trim().min(1, 'El nombre visible es obligatorio').max(100),
  permissions: z.array(permissionSchema).default([]),
});
export type CreateRoleInput = z.output<typeof createRoleSchema>;

export const updateRoleSchema = z
  .object({
    displayName: z.string().trim().min(1, 'El nombre visible es obligatorio').max(100).optional(),
    permissions: z.array(permissionSchema).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Debes indicar al menos un campo a actualizar',
  });
export type UpdateRoleInput = z.output<typeof updateRoleSchema>;

export const listRolesQuerySchema = paginationSchema;
export type ListRolesQueryInput = z.output<typeof listRolesQuerySchema>;
