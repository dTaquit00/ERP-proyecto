import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { toUserSummary } from './users.service.js';
import type { UserDocument } from './users.model.js';

function makeUser(overrides: Partial<Record<string, unknown>> = {}): UserDocument {
  const values = {
    _id: new Types.ObjectId(),
    companyId: new Types.ObjectId(),
    roleId: new Types.ObjectId(),
    email: 'ana@empresa.local',
    firstName: 'Ana',
    lastName: 'Torres',
    isActive: true,
    lastLoginAt: undefined as Date | undefined,
    createdAt: undefined as Date | undefined,
    updatedAt: undefined as Date | undefined,
    ...overrides,
  };
  return {
    id: values._id.toString(),
    email: values.email,
    firstName: values.firstName,
    lastName: values.lastName,
    companyId: values.companyId,
    roleId: values.roleId,
    isActive: values.isActive,
    lastLoginAt: values.lastLoginAt,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  } as unknown as UserDocument;
}

describe('toUserSummary', () => {
  it('mapea el usuario con el nombre de rol correcto e ISO en fechas', () => {
    const user = makeUser({
      lastLoginAt: new Date('2026-01-02T03:04:05.000Z'),
      createdAt: new Date('2025-12-01T00:00:00.000Z'),
    });
    const summary = toUserSummary(user, new Map([[user.roleId.toString(), 'vendedor']]));

    expect(summary.roleName).toBe('vendedor');
    expect(summary.lastLoginAt).toBe('2026-01-02T03:04:05.000Z');
    expect(summary.createdAt).toBe('2025-12-01T00:00:00.000Z');
    expect(summary.email).toBe('ana@empresa.local');
  });

  it('usa un fallback cuando el rol no existe (BD alterada)', () => {
    const summary = toUserSummary(makeUser(), new Map());
    expect(summary.roleName).toBe('desconocido');
  });

  it('devuelve null en fechas ausentes', () => {
    const summary = toUserSummary(makeUser(), new Map());
    expect(summary.lastLoginAt).toBeNull();
    expect(summary.createdAt).toBeNull();
    expect(summary.updatedAt).toBeNull();
  });

  it('nunca incluye passwordHash', () => {
    const summary = toUserSummary(makeUser(), new Map());
    expect(Object.keys(summary)).not.toContain('passwordHash');
    expect(JSON.stringify(summary)).not.toContain('passwordHash');
  });
});
