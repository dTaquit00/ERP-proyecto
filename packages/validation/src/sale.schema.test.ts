import { describe, expect, it } from 'vitest';
import { createSaleSchema, listSalesQuerySchema } from './sale.schema.js';

const PRODUCT_A = '64b000000000000000000001';
const PRODUCT_B = '64b000000000000000000002';
const CUSTOMER = '64b00000000000000000000a';
const WAREHOUSE = '64b00000000000000000000b';

const VALID_SALE = {
  customerId: CUSTOMER,
  warehouseId: WAREHOUSE,
  notes: ' Cliente mostrador ',
  items: [
    { productId: PRODUCT_A, quantity: 2, discount: 10 },
    { productId: PRODUCT_B, quantity: 1 },
  ],
};

describe('createSaleSchema', () => {
  it('acepta una venta válida normalizando notas y aplicando discount por defecto', () => {
    const result = createSaleSchema.safeParse(VALID_SALE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe('Cliente mostrador');
      expect(result.data.items[0]?.discount).toBe(10);
      expect(result.data.items[1]?.discount).toBe(0); // default
      expect(result.data.saleDate).toBeUndefined();
    }
  });

  it('acepta saleDate ISO y branchId opcional (FK de sucursal se valida en Fase 13)', () => {
    expect(
      createSaleSchema.safeParse({
        ...VALID_SALE,
        branchId: '64b00000000000000000000c',
        saleDate: '2026-09-22T10:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('exige referencias de cliente y almacén con formato de id válido', () => {
    expect(createSaleSchema.safeParse({ ...VALID_SALE, customerId: 'no-id' }).success).toBe(false);
    expect(createSaleSchema.safeParse({ ...VALID_SALE, warehouseId: '' }).success).toBe(false);
    expect(createSaleSchema.safeParse({ items: VALID_SALE.items }).success).toBe(false);
  });

  it('exige al menos una línea y un máximo de 100', () => {
    expect(createSaleSchema.safeParse({ ...VALID_SALE, items: [] }).success).toBe(false);
    const many = Array.from({ length: 101 }, (_, index) => ({
      productId: `64b00000000000000000${index.toString().padStart(5, '0')}`,
      quantity: 1,
    }));
    expect(createSaleSchema.safeParse({ ...VALID_SALE, items: many }).success).toBe(false);
  });

  it('valida cantidad entera ≥ 1 y descuento 0–100', () => {
    expect(
      createSaleSchema.safeParse({
        ...VALID_SALE,
        items: [{ productId: PRODUCT_A, quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      createSaleSchema.safeParse({
        ...VALID_SALE,
        items: [{ productId: PRODUCT_A, quantity: 1.5 }],
      }).success,
    ).toBe(false);
    expect(
      createSaleSchema.safeParse({
        ...VALID_SALE,
        items: [{ productId: PRODUCT_A, quantity: 1, discount: -1 }],
      }).success,
    ).toBe(false);
    expect(
      createSaleSchema.safeParse({
        ...VALID_SALE,
        items: [{ productId: PRODUCT_A, quantity: 1, discount: 101 }],
      }).success,
    ).toBe(false);
  });

  it('rechaza un producto repetido en la misma venta', () => {
    const result = createSaleSchema.safeParse({
      ...VALID_SALE,
      items: [
        { productId: PRODUCT_A, quantity: 1 },
        { productId: PRODUCT_A, quantity: 2 },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('items'))).toBe(true);
    }
  });

  it('valida notas y saleDate inválidos', () => {
    expect(createSaleSchema.safeParse({ ...VALID_SALE, notes: 'x'.repeat(501) }).success).toBe(
      false,
    );
    expect(createSaleSchema.safeParse({ ...VALID_SALE, saleDate: 'ayer' }).success).toBe(false);
  });
});

describe('listSalesQuerySchema', () => {
  it('aplica defaults de paginación, orden y sort por fecha de venta', () => {
    const result = listSalesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe('saleDate');
      expect(result.data.order).toBe('desc');
      expect(result.data.limit).toBe(20);
    }
  });

  it('acepta filtros válidos de estado y rango de fechas', () => {
    expect(
      listSalesQuerySchema.safeParse({
        status: 'confirmed',
        customerId: CUSTOMER,
        warehouseId: WAREHOUSE,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-22',
      }).success,
    ).toBe(true);
  });

  it('rechaza estado, sort, fechas fuera de formato y rangos invertidos', () => {
    expect(listSalesQuerySchema.safeParse({ status: 'paid' }).success).toBe(false);
    expect(listSalesQuerySchema.safeParse({ sort: 'passwordHash' }).success).toBe(false);
    expect(listSalesQuerySchema.safeParse({ dateFrom: '01/09/2026' }).success).toBe(false);
    expect(listSalesQuerySchema.safeParse({ dateTo: '2026-9-1' }).success).toBe(false);
    expect(listSalesQuerySchema.safeParse({ dateFrom: '2026-02-31' }).success).toBe(false);
    expect(
      listSalesQuerySchema.safeParse({ dateFrom: '2026-09-10', dateTo: '2026-09-01' }).success,
    ).toBe(false);
    expect(listSalesQuerySchema.safeParse({ limit: '5000' }).success).toBe(false);
  });
});
