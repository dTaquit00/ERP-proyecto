import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { UNKNOWN_CATEGORY, toProductSummary } from './products.service.js';
import type { ProductDocument } from './products.model.js';

function makeProduct(overrides: Partial<Record<string, unknown>> = {}): ProductDocument {
  const values = {
    _id: new Types.ObjectId(),
    companyId: new Types.ObjectId(),
    categoryId: new Types.ObjectId(),
    code: 'REF-1',
    sku: 'SKU-001',
    name: 'Teclado mecánico',
    description: undefined as string | undefined,
    purchasePrice: 100.5,
    salePrice: 150,
    taxes: [{ name: 'IVA', rate: 16 }],
    unit: 'pza',
    isActive: true,
    image: undefined as string | undefined,
    barcode: undefined as string | undefined,
    createdAt: undefined as Date | undefined,
    updatedAt: undefined as Date | undefined,
    ...overrides,
  };
  return {
    id: values._id.toString(),
    companyId: values.companyId,
    categoryId: values.categoryId,
    code: values.code,
    sku: values.sku,
    name: values.name,
    description: values.description,
    purchasePrice: values.purchasePrice,
    salePrice: values.salePrice,
    taxes: values.taxes,
    unit: values.unit,
    isActive: values.isActive,
    image: values.image,
    barcode: values.barcode,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  } as unknown as ProductDocument;
}

describe('toProductSummary', () => {
  it('mapea el producto con el nombre de categoría resuelto e ISO en fechas', () => {
    const product = makeProduct({ createdAt: new Date('2025-12-01T00:00:00.000Z') });
    const summary = toProductSummary(
      product,
      new Map([[product.categoryId.toString(), 'Electrónica']]),
    );

    expect(summary.categoryName).toBe('Electrónica');
    expect(summary.createdAt).toBe('2025-12-01T00:00:00.000Z');
    expect(summary.taxes).toEqual([{ name: 'IVA', rate: 16 }]);
    expect(summary.sku).toBe('SKU-001');
  });

  it('usa un fallback cuando la categoría no existe (BD alterada)', () => {
    const summary = toProductSummary(makeProduct(), new Map());
    expect(summary.categoryName).toBe(UNKNOWN_CATEGORY);
    expect(UNKNOWN_CATEGORY).toBe('sin-categoría');
  });

  it('devuelve null en campos opcionales y fechas ausentes', () => {
    const summary = toProductSummary(makeProduct({ code: undefined, taxes: [] }), new Map());
    expect(summary.code).toBeNull();
    expect(summary.description).toBeNull();
    expect(summary.image).toBeNull();
    expect(summary.barcode).toBeNull();
    expect(summary.taxes).toEqual([]);
    expect(summary.createdAt).toBeNull();
    expect(summary.updatedAt).toBeNull();
  });

  it('nunca incluye passwordHash ni secretos', () => {
    const summary = toProductSummary(makeProduct(), new Map());
    expect(Object.keys(summary)).not.toContain('passwordHash');
    expect(JSON.stringify(summary)).not.toContain('passwordHash');
  });
});
