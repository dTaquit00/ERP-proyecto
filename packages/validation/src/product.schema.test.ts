import { describe, expect, it } from 'vitest';
import {
  createProductSchema,
  listProductsQuerySchema,
  productSkuSchema,
  updateProductSchema,
} from './product.schema.js';

const VALID_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const VALID_PRODUCT = {
  sku: ' sku-001 ',
  name: 'Teclado mecánico',
  categoryId: VALID_ID,
  purchasePrice: 100.5,
  salePrice: 150,
  unit: 'pza',
};

describe('productSkuSchema', () => {
  it('normaliza a mayúsculas y recorta espacios', () => {
    const result = productSkuSchema.safeParse('  abc-123 ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('ABC-123');
  });

  it('rechaza vacíos, caracteres inválidos y largos', () => {
    expect(productSkuSchema.safeParse('').success).toBe(false);
    expect(productSkuSchema.safeParse('SKU con espacio').success).toBe(false);
    expect(productSkuSchema.safeParse('SKU/¿?').success).toBe(false);
    expect(productSkuSchema.safeParse('a'.repeat(41)).success).toBe(false);
  });
});

describe('createProductSchema', () => {
  it('acepta un producto válido con defaults de taxes e isActive', () => {
    const result = createProductSchema.safeParse(VALID_PRODUCT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sku).toBe('SKU-001');
      expect(result.data.taxes).toEqual([]);
      expect(result.data.isActive).toBe(true);
    }
  });

  it('valida impuestos configurables (tasa 0–100)', () => {
    const ok = createProductSchema.safeParse({
      ...VALID_PRODUCT,
      taxes: [{ name: 'IVA', rate: 16 }],
    });
    expect(ok.success).toBe(true);

    const negative = createProductSchema.safeParse({
      ...VALID_PRODUCT,
      taxes: [{ name: 'IVA', rate: -1 }],
    });
    expect(negative.success).toBe(false);

    const tooHigh = createProductSchema.safeParse({
      ...VALID_PRODUCT,
      taxes: [{ name: 'IVA', rate: 101 }],
    });
    expect(tooHigh.success).toBe(false);

    const emptyName = createProductSchema.safeParse({
      ...VALID_PRODUCT,
      taxes: [{ name: '  ', rate: 16 }],
    });
    expect(emptyName.success).toBe(false);
  });

  it('rechaza precios negativos y campos obligatorios ausentes', () => {
    expect(
      createProductSchema.safeParse({ ...VALID_PRODUCT, purchasePrice: -1 }).success,
    ).toBe(false);
    expect(createProductSchema.safeParse({ ...VALID_PRODUCT, salePrice: -0.01 }).success).toBe(
      false,
    );
    expect(createProductSchema.safeParse({ ...VALID_PRODUCT, unit: '' }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...VALID_PRODUCT, categoryId: 'no-id' }).success).toBe(
      false,
    );
    const { sku: _sku, ...withoutSku } = VALID_PRODUCT;
    expect(createProductSchema.safeParse(withoutSku).success).toBe(false);
  });

  it('valida la imagen como URL opcional', () => {
    expect(
      createProductSchema.safeParse({ ...VALID_PRODUCT, image: 'https://x.dev/i.png' }).success,
    ).toBe(true);
    expect(
      createProductSchema.safeParse({ ...VALID_PRODUCT, image: 'no-es-url' }).success,
    ).toBe(false);
  });
});

describe('updateProductSchema', () => {
  it('acepta cambios parciales', () => {
    expect(updateProductSchema.safeParse({ name: 'Otro' }).success).toBe(true);
    expect(updateProductSchema.safeParse({ sku: 'otro-sku' }).success).toBe(true);
    expect(updateProductSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(
      updateProductSchema.safeParse({ taxes: [{ name: 'IVA', rate: 21 }] }).success,
    ).toBe(true);
  });

  it('rechaza cuerpos vacíos y valores inválidos', () => {
    expect(updateProductSchema.safeParse({}).success).toBe(false);
    expect(updateProductSchema.safeParse({ salePrice: -5 }).success).toBe(false);
    expect(updateProductSchema.safeParse({ sku: 'con espacios' }).success).toBe(false);
  });
});

describe('listProductsQuerySchema', () => {
  it('aplica defaults', () => {
    const result = listProductsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
    }
  });

  it('valida enums, ids y límites de paginación', () => {
    expect(listProductsQuerySchema.safeParse({ categoryId: VALID_ID }).success).toBe(true);
    expect(listProductsQuerySchema.safeParse({ categoryId: 'no-id' }).success).toBe(false);
    expect(listProductsQuerySchema.safeParse({ sort: 'passwordHash' }).success).toBe(false);
    expect(listProductsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listProductsQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
  });
});
