import { describe, expect, it } from 'vitest';
import type { ListSuppliersQueryInput } from '@erp/validation';
import { buildSupplierFilter } from './suppliers.repository.js';

const COMPANY = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function query(partial: Partial<ListSuppliersQueryInput> = {}): ListSuppliersQueryInput {
  return {
    page: 1,
    limit: 20,
    sort: 'createdAt',
    order: 'desc',
    ...partial,
  };
}

describe('buildSupplierFilter', () => {
  it('siempre aplica el scope multiempresa', () => {
    const filter = buildSupplierFilter(COMPANY, query());
    expect(filter.companyId?.toString()).toBe(COMPANY);
  });

  it('filtra por estado', () => {
    expect(buildSupplierFilter(COMPANY, query({ status: 'inactive' })).isActive).toBe(false);
    expect(buildSupplierFilter(COMPANY, query({ status: 'active' })).isActive).toBe(true);
    expect(buildSupplierFilter(COMPANY, query()).isActive).toBeUndefined();
  });

  it('busca por nombre, contacto, correo, teléfono y RUC escapando la entrada', () => {
    const filter = buildSupplierFilter(COMPANY, query({ search: 'norte (MX)' }));
    expect(filter.$or).toEqual([
      { name: /norte \(MX\)/i },
      { contactName: /norte \(MX\)/i },
      { email: /norte \(MX\)/i },
      { phone: /norte \(MX\)/i },
      { ruc: /norte \(MX\)/i },
    ]);
  });

  it('una entrada hostil no produce una regex malformada', () => {
    const filter = buildSupplierFilter(COMPANY, query({ search: '[[' }));
    expect(filter.$or?.[4]).toEqual({ ruc: /\[\[/i });
  });
});
