import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { toSupplierResponse } from './suppliers.service.js';
import type { SupplierDocument } from './suppliers.model.js';

function makeSupplier(overrides: Partial<Record<string, unknown>> = {}): SupplierDocument {
  const values = {
    _id: new Types.ObjectId(),
    companyId: new Types.ObjectId(),
    name: 'Distribuidora Norte',
    contactName: 'Carla Norte',
    email: 'carla@norte.com',
    phone: '55 9999 0000',
    ruc: 'XAXX010100000',
    address: { street: 'Blvd. Norte 42', city: 'Monterrey', state: 'NL', zipCode: '64000' },
    notes: undefined as string | undefined,
    isActive: true,
    createdAt: undefined as Date | undefined,
    updatedAt: undefined as Date | undefined,
    ...overrides,
  };
  return {
    id: values._id.toString(),
    companyId: values.companyId,
    name: values.name,
    contactName: values.contactName,
    email: values.email,
    phone: values.phone,
    ruc: values.ruc,
    address: values.address,
    notes: values.notes,
    isActive: values.isActive,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  } as unknown as SupplierDocument;
}

describe('toSupplierResponse', () => {
  it('mapea el proveedor con su dirección e ISO en fechas', () => {
    const supplier = makeSupplier({ createdAt: new Date('2026-02-01T00:00:00.000Z') });
    const response = toSupplierResponse(supplier);

    expect(response.name).toBe('Distribuidora Norte');
    expect(response.contactName).toBe('Carla Norte');
    expect(response.ruc).toBe('XAXX010100000');
    expect(response.address?.city).toBe('Monterrey');
    expect(response.createdAt).toBe('2026-02-01T00:00:00.000Z');
    expect(response.isActive).toBe(true);
  });

  it('devuelve null en campos opcionales, dirección y fechas ausentes', () => {
    const response = toSupplierResponse(
      makeSupplier({
        contactName: undefined,
        email: undefined,
        phone: undefined,
        ruc: undefined,
        address: undefined,
        notes: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      }),
    );

    expect(response.contactName).toBeNull();
    expect(response.email).toBeNull();
    expect(response.phone).toBeNull();
    expect(response.ruc).toBeNull();
    expect(response.address).toBeNull();
    expect(response.notes).toBeNull();
    expect(response.createdAt).toBeNull();
    expect(response.updatedAt).toBeNull();
  });

  it('normaliza la dirección parcial a nulls explícitos', () => {
    const response = toSupplierResponse(makeSupplier({ address: { street: 'Calle 5' } }));
    expect(response.address).toEqual({
      street: 'Calle 5',
      city: null,
      state: null,
      zipCode: null,
    });
  });

  it('nunca incluye passwordHash ni secretos', () => {
    const response = toSupplierResponse(makeSupplier());
    expect(Object.keys(response)).not.toContain('passwordHash');
    expect(JSON.stringify(response)).not.toContain('passwordHash');
  });
});
