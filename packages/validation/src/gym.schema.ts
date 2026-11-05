import { z } from 'zod';
import { emailSchema, idSchema, paginationSchema } from './common.schema.js';

const optionalText = (max: number) => z.string().trim().max(max).default('');
export const gymDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha válida')
  .refine((value) => { const date = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }, 'Fecha no válida');
const money = z.number().finite().min(0).max(1_000_000).multipleOf(0.01);
export const createGymMemberSchema = z.object({
  memberNumber: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Usa letras, números, guiones o guion bajo'),
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
  email: z.union([emailSchema, z.literal('')]).default(''),
  phone: z.string().trim().max(30).refine((value) => !value || (/^\+?[0-9(). -]+$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15), 'Usa entre 7 y 15 dígitos').default(''),
  notes: optionalText(1000), isActive: z.boolean().default(true),
});
export const updateGymMemberSchema = z.object({
  memberNumber: createGymMemberSchema.shape.memberNumber.optional(),
  firstName: createGymMemberSchema.shape.firstName.optional(), lastName: createGymMemberSchema.shape.lastName.optional(),
  email: createGymMemberSchema.shape.email.removeDefault().optional(),
  phone: createGymMemberSchema.shape.phone.removeDefault().optional(),
  notes: createGymMemberSchema.shape.notes.removeDefault().optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Indica los cambios');
export const createMembershipPlanSchema = z.object({
  name: z.string().trim().min(2).max(100), description: optionalText(500),
  durationDays: z.number().int().min(1).max(730), price: money, isActive: z.boolean().default(true),
});
export const updateMembershipPlanSchema = z.object({
  name: createMembershipPlanSchema.shape.name.optional(), description: createMembershipPlanSchema.shape.description.removeDefault().optional(),
  durationDays: createMembershipPlanSchema.shape.durationDays.optional(), price: createMembershipPlanSchema.shape.price.optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Indica los cambios');
export const createEnrollmentSchema = z.object({
  memberId: idSchema, planId: idSchema, startDate: gymDateSchema,
  amountPaid: money.optional(), notes: optionalText(500),
});
export const gymListSchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(), status: z.enum(['active', 'inactive']).optional(),
});
export const enrollmentListSchema = paginationSchema.extend({
  memberId: idSchema.optional(), status: z.enum(['scheduled', 'active', 'expired', 'cancelled']).optional(),
});
export type CreateGymMemberInput = z.output<typeof createGymMemberSchema>;
export type UpdateGymMemberInput = z.output<typeof updateGymMemberSchema>;
export type CreateMembershipPlanInput = z.output<typeof createMembershipPlanSchema>;
export type UpdateMembershipPlanInput = z.output<typeof updateMembershipPlanSchema>;
export type CreateEnrollmentInput = z.output<typeof createEnrollmentSchema>;
export type GymListInput = z.output<typeof gymListSchema>;
export type EnrollmentListInput = z.output<typeof enrollmentListSchema>;
