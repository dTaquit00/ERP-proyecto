import { describe, expect, it } from 'vitest';
import type { ListCustomersQueryInput } from '@erp/validation';
import { buildCustomerFilter } from './customers.repository.js';

const COMPANY = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function query(partial: Partial<ListCustomersQueryInput> = {}): ListCustomersQueryInput {
  return {
    page: 1,
    limit: 20,
    sort: 'createdAt',
    order: 'desc',
    ...partial,
  };
}

describe('buildCustomerFilter', () => {
  it('siempre aplica el scope multiempresa', () => {
    const filter = buildCustomerFilter(COMPANY, query());
    expect(filter.companyId?.toString()).toBe(COMPANY);
  });

  it('filtra por estado', () => {
    expect(buildCustomerFilter(COMPANY, query({ status: 'inactive' })).isActive).toBe(false);
    expect(buildCustomerFilter(COMPANY, query({ status: 'active' })).isActive).toBe(true);
    expect(buildCustomerFilter(COMPANY, query()).isActive).toBeUndefined();
  });

  it('busca por nombre, correo, teléfono y DNI escapando la entrada', () => {
    const filter = buildCustomerFilter(COMPANY, query({ search: 'ana (mty)' }));
    expect(filter.$or).toEqual([
      { name: /ana \(mty\)/i },
      { email: /ana \(mty\)/i },
      { phone: /ana \(mty\)/i },
      { dni: /ana \(mty\)/i },
    ]);
  });

  it('una entrada hostil no produce una regex malformada', () => {
    const filter = buildCustomerFilter(COMPANY, query({ search: '[[' }));
    expect(filter.$or?.[3]).toEqual({ dni: /\[\[/i });
  });
});
