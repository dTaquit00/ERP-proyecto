import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { ValidationError } from '../../shared/http/errors.js';
import {
  movementEffect,
  toMovementResponse,
  toStockResponse,
} from './inventory.service.js';
import type { InventoryMovementDocument, StockBalanceDocument } from './inventory.model.js';

function makeBalance(overrides: Partial<Record<string, unknown>> = {}): StockBalanceDocument {
  const values = {
    _id: new Types.ObjectId(),
    companyId: new Types.ObjectId(),
    warehouseId: new Types.ObjectId(),
    productId: new Types.ObjectId(),
    quantity: 5,
    minStock: 10,
    createdAt: undefined as Date | undefined,
    updatedAt: undefined as Date | undefined,
    ...overrides,
  };
  return {
    id: values._id.toString(),
    companyId: values.companyId,
    warehouseId: values.warehouseId,
    productId: values.productId,
    quantity: values.quantity,
    minStock: values.minStock,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  } as unknown as StockBalanceDocument;
}

function makeMovement(overrides: Partial<Record<string, unknown>> = {}): InventoryMovementDocument {
  const values = {
    _id: new Types.ObjectId(),
    companyId: new Types.ObjectId(),
    warehouseId: new Types.ObjectId(),
    toWarehouseId: undefined as Types.ObjectId | undefined,
    toWarehouseName: undefined as string | undefined,
    productId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    type: 'IN',
    warehouseName: 'Central',
    productName: 'Teclado',
    productSku: 'SKU-001',
    quantity: 3,
    quantityAfter: 8,
    reason: undefined as string | undefined,
    documentRef: undefined as string | undefined,
    userName: 'Ada Admin',
    createdAt: undefined as Date | undefined,
    updatedAt: undefined as Date | undefined,
    ...overrides,
  };
  return {
    id: values._id.toString(),
    companyId: values.companyId,
    type: values.type,
    warehouseId: values.warehouseId,
    warehouseName: values.warehouseName,
    toWarehouseId: values.toWarehouseId,
    toWarehouseName: values.toWarehouseName,
    productId: values.productId,
    productName: values.productName,
    productSku: values.productSku,
    quantity: values.quantity,
    quantityAfter: values.quantityAfter,
    reason: values.reason,
    documentRef: values.documentRef,
    userId: values.userId,
    userName: values.userName,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  } as unknown as InventoryMovementDocument;
}

describe('movementEffect', () => {
  it('IN y RETURN suman; OUT y TRANSFER restan; ADJUSTMENT fija', () => {
    expect(movementEffect('IN', 5)).toBe('increase');
    expect(movementEffect('RETURN', 5)).toBe('increase');
    expect(movementEffect('OUT', 5)).toBe('decrease');
    expect(movementEffect('TRANSFER', 5)).toBe('decrease');
    expect(movementEffect('ADJUSTMENT', 0)).toBe('set');
  });

  it('exige cantidad ≥ 1 en todo tipo salvo ADJUSTMENT', () => {
    expect(() => movementEffect('IN', 0)).toThrow(ValidationError);
    expect(() => movementEffect('OUT', 0)).toThrow(ValidationError);
    expect(() => movementEffect('TRANSFER', 0.5)).toThrow(ValidationError);
    expect(() => movementEffect('RETURN', -3)).toThrow(ValidationError);
    expect(movementEffect('ADJUSTMENT', 0)).toBe('set');
  });

  it('el error de cantidad es 400 VALIDATION_ERROR', () => {
    try {
      movementEffect('IN', 0);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.status).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
      }
    }
  });
});

describe('toStockResponse', () => {
  it('deriva lowStock: cantidad bajo el mínimo definido', () => {
    expect(toStockResponse(makeBalance({ quantity: 5, minStock: 10 }), 'C', 'P', 'S').lowStock).toBe(
      true,
    );
    expect(toStockResponse(makeBalance({ quantity: 10, minStock: 10 }), 'C', 'P', 'S').lowStock).toBe(
      false,
    );
    expect(toStockResponse(makeBalance({ quantity: 0, minStock: 0 }), 'C', 'P', 'S').lowStock).toBe(
      false,
    );
    expect(toStockResponse(makeBalance({ quantity: 0, minStock: 5 }), 'C', 'P', 'S').lowStock).toBe(
      true,
    );
  });

  it('mapea nombres, cantidades e ISO en fechas (sin fugas de hash)', () => {
    const response = toStockResponse(
      makeBalance({ createdAt: new Date('2025-12-01T00:00:00.000Z') }),
      'Central',
      'Teclado',
      'SKU-001',
    );
    expect(response.warehouseName).toBe('Central');
    expect(response.productName).toBe('Teclado');
    expect(response.productSku).toBe('SKU-001');
    expect(response.quantity).toBe(5);
    expect(response.minStock).toBe(10);
    expect(response.createdAt).toBe('2025-12-01T00:00:00.000Z');
    expect(JSON.stringify(response)).not.toContain('passwordHash');
  });
});

describe('toMovementResponse', () => {
  it('mapea un movimiento simple con nulls en campos opcionales', () => {
    const response = toMovementResponse(makeMovement());
    expect(response.type).toBe('IN');
    expect(response.toWarehouseId).toBeNull();
    expect(response.toWarehouseName).toBeNull();
    expect(response.reason).toBeNull();
    expect(response.documentRef).toBeNull();
    expect(response.quantityAfter).toBe(8);
    expect(response.userName).toBe('Ada Admin');
    expect(response.createdAt).toBeNull();
  });

  it('incluye el destino y los metadatos de un TRANSFER', () => {
    const to = new Types.ObjectId();
    const response = toMovementResponse(
      makeMovement({
        type: 'TRANSFER',
        toWarehouseId: to,
        toWarehouseName: 'Norte',
        reason: 'Reposición',
        documentRef: 'TRF-001',
        createdAt: new Date('2026-01-05T10:00:00.000Z'),
      }),
    );
    expect(response.type).toBe('TRANSFER');
    expect(response.toWarehouseId).toBe(to.toString());
    expect(response.toWarehouseName).toBe('Norte');
    expect(response.reason).toBe('Reposición');
    expect(response.documentRef).toBe('TRF-001');
    expect(response.createdAt).toBe('2026-01-05T10:00:00.000Z');
  });
});
