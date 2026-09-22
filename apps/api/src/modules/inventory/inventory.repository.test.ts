import { describe, expect, it } from 'vitest';
import type { ListMovementsQueryInput, ListStockQueryInput } from '@erp/validation';
import { buildMovementFilter, buildStockFilter } from './inventory.repository.js';

const COMPANY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WAREHOUSE = 'cccccccccccccccccccccccc';
const PRODUCT = 'dddddddddddddddddddddddd';

function stockQuery(partial: Partial<ListStockQueryInput> = {}): ListStockQueryInput {
  return { page: 1, limit: 20, sort: 'createdAt', order: 'desc', ...partial };
}

function movementQuery(
  partial: Partial<ListMovementsQueryInput> = {},
): ListMovementsQueryInput {
  return { page: 1, limit: 20, sort: 'createdAt', order: 'desc', ...partial };
}

describe('buildStockFilter', () => {
  it('siempre aplica el scope multiempresa', () => {
    const filter = buildStockFilter(COMPANY, stockQuery());
    expect(filter.companyId?.toString()).toBe(COMPANY);
  });

  it('filtra por almacén y producto convirtiendo a ObjectId', () => {
    const filter = buildStockFilter(COMPANY, stockQuery({ warehouseId: WAREHOUSE, productId: PRODUCT }));
    expect(filter.warehouseId?.toString()).toBe(WAREHOUSE);
    expect(filter.productId?.toString()).toBe(PRODUCT);
  });

  it('mapea availability: in_stock > 0, out_of_stock = 0, low = quantity < minStock', () => {
    expect(buildStockFilter(COMPANY, stockQuery({ availability: 'in_stock' })).quantity).toEqual({
      $gt: 0,
    });
    expect(buildStockFilter(COMPANY, stockQuery({ availability: 'out_of_stock' })).quantity).toBe(0);
    const low = buildStockFilter(COMPANY, stockQuery({ availability: 'low' }));
    expect(low.$expr).toEqual({ $and: [{ $gt: ['$minStock', 0] }, { $lt: ['$quantity', '$minStock'] }] });
    expect(buildStockFilter(COMPANY, stockQuery()).quantity).toBeUndefined();
  });
});

describe('buildMovementFilter', () => {
  it('siempre aplica el scope multiempresa', () => {
    const filter = buildMovementFilter(COMPANY, movementQuery());
    expect(filter.companyId?.toString()).toBe(COMPANY);
  });

  it('filtra por almacén, producto y tipo', () => {
    const filter = buildMovementFilter(
      COMPANY,
      movementQuery({ warehouseId: WAREHOUSE, productId: PRODUCT, type: 'TRANSFER' }),
    );
    expect(filter.warehouseId?.toString()).toBe(WAREHOUSE);
    expect(filter.productId?.toString()).toBe(PRODUCT);
    expect(filter.type).toBe('TRANSFER');
  });

  it('sin filtros opcionales solo lleva el scope', () => {
    const filter = buildMovementFilter(COMPANY, movementQuery());
    expect(Object.keys(filter)).toEqual(['companyId']);
  });
});
