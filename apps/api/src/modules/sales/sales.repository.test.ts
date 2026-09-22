import { describe, expect, it } from 'vitest';
import type { ListSalesQueryInput } from '@erp/validation';
import { buildSaleFilter } from './sales.repository.js';

const COMPANY = '64b0000000000000000000aa';
const CUSTOMER = '64b0000000000000000000cc';
const WAREHOUSE = '64b0000000000000000000dd';

function baseQuery(overrides: Partial<ListSalesQueryInput> = {}): ListSalesQueryInput {
  return { page: 1, limit: 20, sort: 'saleDate', order: 'desc', ...overrides };
}

describe('buildSaleFilter', () => {
  it('siempre aplica el scope de empresa y no añade filtros con la query vacía', () => {
    const filter = buildSaleFilter(COMPANY, baseQuery());
    expect(filter.companyId?.toString()).toBe(COMPANY);
    expect(filter.status).toBeUndefined();
    expect(filter.$or).toBeUndefined();
    expect(filter.saleDate).toBeUndefined();
  });

  it('traduce estado y referencias a ObjectIds', () => {
    const filter = buildSaleFilter(
      COMPANY,
      baseQuery({ status: 'confirmed', customerId: CUSTOMER, warehouseId: WAREHOUSE }),
    );
    expect(filter.status).toBe('confirmed');
    expect(filter.customerId?.toString()).toBe(CUSTOMER);
    expect(filter.warehouseId?.toString()).toBe(WAREHOUSE);
  });

  it('dateFrom es desde medianoche UTC y dateTo hasta el día siguiente (inclusivo)', () => {
    const filter = buildSaleFilter(COMPANY, baseQuery({ dateFrom: '2026-09-01' }));
    expect(filter.saleDate).toEqual({ $gte: new Date('2026-09-01T00:00:00.000Z') });

    const range = buildSaleFilter(COMPANY, baseQuery({ dateTo: '2026-09-22' })).saleDate;
    expect(range).toEqual({ $lt: new Date('2026-09-23T00:00:00.000Z') });

    const both = buildSaleFilter(
      COMPANY,
      baseQuery({ dateFrom: '2026-09-01', dateTo: '2026-09-22' }),
    ).saleDate as { $gte: Date; $lt: Date };
    expect(both.$gte).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    expect(both.$lt).toEqual(new Date('2026-09-23T00:00:00.000Z'));
  });

  it('busca en snapshots escapando regex peligrosos', () => {
    const filter = buildSaleFilter(COMPANY, baseQuery({ search: 'a.c(' }));
    const orClauses = filter.$or as unknown as Array<Record<string, unknown>>;
    expect(orClauses).toHaveLength(3);

    const customerPattern = orClauses[0]?.customerName as RegExp;
    expect(customerPattern.test('a.c(')).toBe(true); // el punto es literal
    expect(customerPattern.test('abc')).toBe(false); // no lo interpreta como comodín
    expect(orClauses[1]?.['items.productName']).toBeDefined();
    expect(orClauses[2]?.['items.productSku']).toBeDefined();
  });
});
