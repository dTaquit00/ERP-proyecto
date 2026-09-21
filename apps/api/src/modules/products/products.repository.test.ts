import { describe, expect, it } from 'vitest';
import type { ListProductsQueryInput } from '@erp/validation';
import { buildProductFilter } from './products.repository.js';

const COMPANY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const CATEGORY = 'cccccccccccccccccccccccc';

function query(partial: Partial<ListProductsQueryInput> = {}): ListProductsQueryInput {
  return {
    page: 1,
    limit: 20,
    sort: 'createdAt',
    order: 'desc',
    ...partial,
  };
}

describe('buildProductFilter', () => {
  it('siempre aplica el scope multiempresa', () => {
    const filter = buildProductFilter(COMPANY, query());
    expect(filter.companyId?.toString()).toBe(COMPANY);
  });

  it('filtra por categoría y estado', () => {
    const filter = buildProductFilter(COMPANY, query({ categoryId: CATEGORY, status: 'inactive' }));
    expect(filter.categoryId?.toString()).toBe(CATEGORY);
    expect(filter.isActive).toBe(false);
    expect(buildProductFilter(COMPANY, query({ status: 'active' })).isActive).toBe(true);
    expect(buildProductFilter(COMPANY, query()).isActive).toBeUndefined();
  });

  it('busca por nombre, SKU, código y código de barras escapando la entrada', () => {
    const filter = buildProductFilter(COMPANY, query({ search: 'tv (55")' }));
    expect(filter.$or).toEqual([
      { name: /tv \(55"\)/i },
      { sku: /tv \(55"\)/i },
      { code: /tv \(55"\)/i },
      { barcode: /tv \(55"\)/i },
    ]);
  });

  it('una entrada hostil no produce una regex malformada', () => {
    const filter = buildProductFilter(COMPANY, query({ search: '[[' }));
    expect(filter.$or?.[1]).toEqual({ sku: /\[\[/i });
  });
});
