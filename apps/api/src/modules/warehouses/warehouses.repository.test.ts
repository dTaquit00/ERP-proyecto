import { describe, expect, it } from 'vitest';
import type { ListWarehousesQueryInput } from '@erp/validation';
import { buildWarehouseFilter } from './warehouses.repository.js';

const COMPANY = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function query(partial: Partial<ListWarehousesQueryInput> = {}): ListWarehousesQueryInput {
  return {
    page: 1,
    limit: 20,
    sort: 'createdAt',
    order: 'desc',
    ...partial,
  };
}

describe('buildWarehouseFilter', () => {
  it('siempre aplica el scope multiempresa', () => {
    const filter = buildWarehouseFilter(COMPANY, query());
    expect(filter.companyId?.toString()).toBe(COMPANY);
  });

  it('filtra por estado', () => {
    expect(buildWarehouseFilter(COMPANY, query({ status: 'active' })).isActive).toBe(true);
    expect(buildWarehouseFilter(COMPANY, query({ status: 'inactive' })).isActive).toBe(false);
    expect(buildWarehouseFilter(COMPANY, query()).isActive).toBeUndefined();
  });

  it('busca en nombre y dirección escapando la entrada', () => {
    const filter = buildWarehouseFilter(COMPANY, query({ search: ' Cen+ral (norte) ' }));
    expect(filter.$or).toEqual([
      { name: / Cen\+ral \(norte\) /i },
      { address: / Cen\+ral \(norte\) /i },
    ]);
  });

  it('una entrada hostil no produce una regex malformada', () => {
    const filter = buildWarehouseFilter(COMPANY, query({ search: '[[*' }));
    expect(filter.$or?.[0]).toEqual({ name: /\[\[\*/i });
    expect(() => new RegExp('\\[\\[\\*')).not.toThrow();
  });
});
