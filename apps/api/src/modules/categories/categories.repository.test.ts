import { describe, expect, it } from 'vitest';
import type { ListCategoriesQueryInput } from '@erp/validation';
import { escapeRegExp } from '../../shared/utils/regex.js';
import { buildCategoryFilter } from './categories.repository.js';

const COMPANY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';

function query(partial: Partial<ListCategoriesQueryInput> = {}): ListCategoriesQueryInput {
  return {
    page: 1,
    limit: 20,
    sort: 'createdAt',
    order: 'desc',
    ...partial,
  };
}

describe('buildCategoryFilter', () => {
  it('siempre aplica el scope multiempresa', () => {
    const filter = buildCategoryFilter(COMPANY, query());
    expect(filter.companyId?.toString()).toBe(COMPANY);
    expect(filter.companyId?.toString()).not.toBe(OTHER);
  });

  it('filtra por estado', () => {
    expect(buildCategoryFilter(COMPANY, query({ status: 'active' })).isActive).toBe(true);
    expect(buildCategoryFilter(COMPANY, query({ status: 'inactive' })).isActive).toBe(false);
    expect(buildCategoryFilter(COMPANY, query()).isActive).toBeUndefined();
  });

  it('busca en nombre y descripción escapando la entrada', () => {
    const filter = buildCategoryFilter(COMPANY, query({ search: ' TV (4k) ' }));
    expect(filter.$or).toEqual([
      { name: / TV \(4k\) /i },
      { description: / TV \(4k\) /i },
    ]);
  });

  it('una entrada hostil no produce una regex malformada', () => {
    const filter = buildCategoryFilter(COMPANY, query({ search: '(((*' }));
    expect(filter.$or?.[0]).toEqual({ name: /\(\(\(\*/i });
    expect(() => new RegExp(escapeRegExp('(((*'))).not.toThrow();
  });
});
