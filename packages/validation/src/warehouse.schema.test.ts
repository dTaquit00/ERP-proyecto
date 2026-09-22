import { describe, expect, it } from 'vitest';
import {
  createWarehouseSchema,
  listWarehousesQuerySchema,
  updateWarehouseSchema,
} from './warehouse.schema.js';

const VALID_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

describe('createWarehouseSchema', () => {
  it('acepta un almacén válido, recorta y aplica defaults', () => {
    const result = createWarehouseSchema.safeParse({
      name: '  Almacén Central ',
      address: ' Av. Siempre Viva 742 ',
      branchId: VALID_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Almacén Central');
      expect(result.data.address).toBe('Av. Siempre Viva 742');
      expect(result.data.isActive).toBe(true);
    }
  });

  it('la dirección y la sucursal son opcionales', () => {
    expect(createWarehouseSchema.safeParse({ name: 'Norte' }).success).toBe(true);
  });

  it('rechaza nombres cortos/vacíos/largos y branchId inválido', () => {
    expect(createWarehouseSchema.safeParse({ name: 'x' }).success).toBe(false);
    expect(createWarehouseSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createWarehouseSchema.safeParse({ name: 'a'.repeat(81) }).success).toBe(false);
    expect(createWarehouseSchema.safeParse({ name: 'OK', branchId: 'no-id' }).success).toBe(false);
    expect(createWarehouseSchema.safeParse({}).success).toBe(false);
  });
});

describe('updateWarehouseSchema', () => {
  it('acepta cambios parciales y branchId nullable (desvincular)', () => {
    expect(updateWarehouseSchema.safeParse({ name: 'Otro nombre' }).success).toBe(true);
    expect(updateWarehouseSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateWarehouseSchema.safeParse({ branchId: null }).success).toBe(true);
    expect(updateWarehouseSchema.safeParse({ address: '' }).success).toBe(true);
  });

  it('rechaza cuerpos vacíos o inválidos', () => {
    expect(updateWarehouseSchema.safeParse({}).success).toBe(false);
    expect(updateWarehouseSchema.safeParse({ name: '' }).success).toBe(false);
    expect(updateWarehouseSchema.safeParse({ branchId: 'malo' }).success).toBe(false);
    expect(updateWarehouseSchema.safeParse({ isActive: 'si' }).success).toBe(false);
  });
});

describe('listWarehousesQuerySchema', () => {
  it('aplica defaults de orden y coage strings de query', () => {
    const result = listWarehousesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
    }
    expect(listWarehousesQuerySchema.safeParse({ page: '2', limit: '50' }).success).toBe(true);
  });

  it('valida enums y límites de paginación', () => {
    expect(listWarehousesQuerySchema.safeParse({ sort: 'passwordHash' }).success).toBe(false);
    expect(listWarehousesQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
    expect(listWarehousesQuerySchema.safeParse({ limit: '5000' }).success).toBe(false);
  });
});
