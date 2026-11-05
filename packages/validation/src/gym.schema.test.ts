import { describe, expect, it } from 'vitest';
import { createGymMemberSchema, updateGymMemberSchema, createMembershipPlanSchema, updateMembershipPlanSchema, createEnrollmentSchema, gymDateSchema } from './gym.schema.js';

describe('validación de Gym OMH', () => {
  it('normaliza contactos y no admite números de socio vacíos ni teléfonos inválidos', () => {
    const input = { memberNumber: 'OMH-001', firstName: ' Ana ', lastName: ' López ', email: ' ANA@EXAMPLE.COM ' };
    expect(createGymMemberSchema.parse(input)).toMatchObject({ firstName: 'Ana', email: 'ana@example.com', isActive: true });
    expect(createGymMemberSchema.safeParse({ ...input, memberNumber: '  ' }).success).toBe(false);
    expect(createGymMemberSchema.safeParse({ ...input, phone: '123' }).success).toBe(false);
  });
  it('las actualizaciones parciales no borran contactos ni reactivan registros', () => {
    expect(updateGymMemberSchema.parse({ firstName: 'Eva' })).toEqual({ firstName: 'Eva' });
    expect(updateMembershipPlanSchema.parse({ price: 250 })).toEqual({ price: 250 });
    expect(updateGymMemberSchema.safeParse({}).success).toBe(false);
    expect(updateMembershipPlanSchema.safeParse({}).success).toBe(false);
  });
  it('rechaza duraciones fraccionarias, precios negativos y montos con más de dos decimales', () => {
    const plan = { name: 'Mensual', durationDays: 30, price: 350 };
    expect(createMembershipPlanSchema.safeParse(plan).success).toBe(true);
    for (const values of [{ durationDays: 0 }, { durationDays: 1.5 }, { price: -1 }, { price: 35.123 }]) expect(createMembershipPlanSchema.safeParse({ ...plan, ...values }).success).toBe(false);
  });
  it('valida las fechas de calendario y no permite sobrescribir vigencia o precio de inscripción', () => {
    expect(gymDateSchema.safeParse('2024-02-29').success).toBe(true);
    expect(gymDateSchema.safeParse('2026-02-29').success).toBe(false);
    expect(gymDateSchema.safeParse('2026-04-31').success).toBe(false);
    const parsed = createEnrollmentSchema.parse({ memberId: 'a'.repeat(24), planId: 'b'.repeat(24), startDate: '2026-11-04', endDate: '2030-01-01', price: 0 });
    expect(parsed).not.toHaveProperty('endDate'); expect(parsed).not.toHaveProperty('price');
  });
});
