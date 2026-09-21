import { describe, expect, it } from 'vitest';
import { buildUserFilter, escapeRegExp } from './users.repository.js';

const COMPANY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ROLE = 'bbbbbbbbbbbbbbbbbbbbbbbb';

function query(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    sort: 'createdAt',
    order: 'desc',
    ...overrides,
  } as Parameters<typeof buildUserFilter>[1];
}

describe('escapeRegExp', () => {
  it('escapa los metacaracteres de regex', () => {
    expect(escapeRegExp('a(b[c].*+?^${}')).toBe('a\\(b\\[c\\]\\.\\*\\+\\?\\^\\$\\{\\}');
  });

  it('permite construir un patrón de búsqueda sin errores con entradas hostiles', () => {
    expect(() => new RegExp(escapeRegExp('((('), 'i')).not.toThrow();
    expect(new RegExp(escapeRegExp('a+b'), 'i').test('a+b')).toBe(true);
    expect(new RegExp(escapeRegExp('a+b'), 'i').test('aab')).toBe(false);
  });
});

describe('buildUserFilter', () => {
  it('aplica SIEMPRE el scope de empresa (aislamiento multiempresa)', () => {
    const filter = buildUserFilter(COMPANY, query());
    expect(filter.companyId?.toString()).toBe(COMPANY);
  });

  it('añade rol y estado solo cuando se solicitan', () => {
    const filter = buildUserFilter(COMPANY, query({ roleId: ROLE, status: 'inactive' }));
    expect(filter.roleId?.toString()).toBe(ROLE);
    expect(filter.isActive).toBe(false);

    const empty = buildUserFilter(COMPANY, query());
    expect(empty.roleId).toBeUndefined();
    expect(empty.isActive).toBeUndefined();
  });

  it('la búsqueda case-insensitive escanea email, nombre y apellido sin inyectar regex', () => {
    const filter = buildUserFilter(COMPANY, query({ search: 'U$er(o)' }));
    expect(filter.$or).toHaveLength(3);
    const pattern = (filter.$or?.[0] as { email: RegExp }).email;
    expect(pattern.ignoreCase).toBe(true);
    expect(pattern.source).toBe('U\\$er\\(o\\)');
  });

  it('convierte status active a isActive=true', () => {
    const filter = buildUserFilter(COMPANY, query({ status: 'active' }));
    expect(filter.isActive).toBe(true);
  });
});
