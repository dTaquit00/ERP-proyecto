import { describe, expect, it } from 'vitest';
import {
  createMovementSchema,
  listMovementsQuerySchema,
  listStockQuerySchema,
  updateStockSchema,
} from './inventory.schema.js';

const ID_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ID_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const BASE = { warehouseId: ID_A, productId: ID_A, quantity: 5 };

describe('createMovementSchema', () => {
  it('acepta IN/OUT/ADJUSTMENT/RETURN/TRANSFER válidos', () => {
    expect(createMovementSchema.safeParse({ type: 'IN', ...BASE }).success).toBe(true);
    expect(createMovementSchema.safeParse({ type: 'OUT', ...BASE }).success).toBe(true);
    expect(createMovementSchema.safeParse({ type: 'ADJUSTMENT', ...BASE }).success).toBe(true);
    expect(createMovementSchema.safeParse({ type: 'RETURN', ...BASE }).success).toBe(true);
    expect(
      createMovementSchema.safeParse({ type: 'TRANSFER', ...BASE, toWarehouseId: ID_B }).success,
    ).toBe(true);
  });

  it('TRANSFER exige toWarehouseId y los demás tipos lo rechazan', () => {
    const sinDestino = createMovementSchema.safeParse({ type: 'TRANSFER', ...BASE });
    expect(sinDestino.success).toBe(false);

    const inConDestino = createMovementSchema.safeParse({
      type: 'IN',
      ...BASE,
      toWarehouseId: ID_B,
    });
    expect(inConDestino.success).toBe(false);
  });

  it('valida cantidad, tipo desconocido e ids', () => {
    expect(createMovementSchema.safeParse({ type: 'IN', ...BASE, quantity: -1 }).success).toBe(false);
    expect(createMovementSchema.safeParse({ type: 'FLY', ...BASE }).success).toBe(false);
    expect(createMovementSchema.safeParse({ type: 'IN', ...BASE, warehouseId: 'x' }).success).toBe(
      false,
    );
    expect(createMovementSchema.safeParse({ type: 'IN', ...BASE, productId: 'x' }).success).toBe(
      false,
    );
    expect(createMovementSchema.safeParse({ type: 'IN', quantity: 1 }).success).toBe(false);
  });

  it('la cantidad 0 pasa la validación de esquema (solo ADJUSTMENT la acepta en el service)', () => {
    expect(createMovementSchema.safeParse({ type: 'ADJUSTMENT', ...BASE, quantity: 0 }).success).toBe(
      true,
    );
    expect(createMovementSchema.safeParse({ type: 'IN', ...BASE, quantity: 0 }).success).toBe(true);
  });

  it('limita reason y documentRef', () => {
    expect(
      createMovementSchema.safeParse({ type: 'IN', ...BASE, reason: 'a'.repeat(201) }).success,
    ).toBe(false);
    expect(
      createMovementSchema.safeParse({ type: 'IN', ...BASE, documentRef: 'a'.repeat(61) }).success,
    ).toBe(false);
  });
});

describe('updateStockSchema', () => {
  it('acepta minStock ≥ 0 y rechaza negativos o ausentes', () => {
    expect(updateStockSchema.safeParse({ minStock: 0 }).success).toBe(true);
    expect(updateStockSchema.safeParse({ minStock: 25.5 }).success).toBe(true);
    expect(updateStockSchema.safeParse({ minStock: -1 }).success).toBe(false);
    expect(updateStockSchema.safeParse({}).success).toBe(false);
  });
});

describe('listStockQuerySchema / listMovementsQuerySchema', () => {
  it('aplica defaults y valida enums, ids y límites', () => {
    const stock = listStockQuerySchema.safeParse({});
    expect(stock.success).toBe(true);
    if (stock.success) expect(stock.data.sort).toBe('createdAt');

    expect(listStockQuerySchema.safeParse({ availability: 'low' }).success).toBe(true);
    expect(listStockQuerySchema.safeParse({ availability: 'negative' }).success).toBe(false);
    expect(listStockQuerySchema.safeParse({ warehouseId: 'no-id' }).success).toBe(false);
    expect(listStockQuerySchema.safeParse({ sort: 'quantityHash' }).success).toBe(false);
    expect(listStockQuerySchema.safeParse({ limit: '0' }).success).toBe(false);

    const movements = listMovementsQuerySchema.safeParse({ type: 'TRANSFER' });
    expect(movements.success).toBe(true);
    expect(listMovementsQuerySchema.safeParse({ type: 'FLY' }).success).toBe(false);
    expect(listMovementsQuerySchema.safeParse({ sort: 'productId' }).success).toBe(false);
    expect(listMovementsQuerySchema.safeParse({ order: 'sideways' }).success).toBe(false);
  });
});
