import { z } from 'zod';
import { idParamsSchema, paginationSchema } from './common.schema.js';

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const companySettingsSchema = z.record(z.string(), z.unknown());

const companyFieldsSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  legalName: optionalText(200),
  taxId: optionalText(50),
  phone: optionalText(50),
  email: z.string().trim().email('El correo no es válido').max(254).optional(),
  address: optionalText(300),
  status: z.enum(['active', 'inactive']),
  settings: companySettingsSchema.optional(),
});

export const createCompanySchema = companyFieldsSchema.extend({
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateCompanySchema = companyFieldsSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Debes indicar al menos un campo a actualizar',
);

export const listCompaniesQuerySchema = paginationSchema;
export const companyIdParamsSchema = idParamsSchema;

export type CreateCompanyInput = z.output<typeof createCompanySchema>;
export type UpdateCompanyInput = z.output<typeof updateCompanySchema>;
export type ListCompaniesQueryInput = z.output<typeof listCompaniesQuerySchema>;