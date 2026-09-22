import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { toCustomerResponse } from './customers.service.js';
import type { CustomerDocument } from './customers.model.js';

function makeCustomer(overrides: Partial<Record<string, unknown>> = {}): CustomerDocument {
  const values = {
    _id: new Types.ObjectId(),
    companyId: new Types.ObjectId(),
    name: 'Ana López',
    email: 'ana@empresa.com',
    phone: '55 1234 5678',
    dni: 'AAA123456',
    address: { street: 'Av. Central 1', city: 'CDMX', state: 'CDMX', zipCode: '06000' },
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
    email: values.email,
    phone: values.phone,
    dni: values.dni,
    address: values.address,
    notes: values.notes,
    isActive: values.isActive,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  } as unknown as CustomerDocument;
}

describe('toCustomerResponse', () => {
  it('mapea el cliente con su dirección e ISO en fechas', () => {
    const customer = makeCustomer({ createdAt: new Date('2026-01-15T00:00:00.000Z') });
    const response = toCustomerResponse(customer);

    expect(response.name).toBe('Ana López');
    expect(response.email).toBe('ana@empresa.com');
    expect(response.address).toEqual({
      street: 'Av. Central 1',
      city: 'CDMX',
      state: 'CDMX',
      zipCode: '06000',
    });
    expect(response.createdAt).toBe('2026-01-15T00:00:00.000Z');
    expect(response.isActive).toBe(true);
  });

  it('devuelve null en campos opcionales, dirección y fechas ausentes', () => {
    const response = toCustomerResponse(
      makeCustomer({
        email: undefined,
        phone: undefined,
        dni: undefined,
        address: undefined,
        notes: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      }),
    );

    expect(response.email).toBeNull();
    expect(response.phone).toBeNull();
    expect(response.dni).toBeNull();
    expect(response.address).toBeNull();
    expect(response.notes).toBeNull();
    expect(response.createdAt).toBeNull();
    expect(response.updatedAt).toBeNull();
  });

  it('normaliza la dirección parcial a nulls explícitos', () => {
    const response = toCustomerResponse(makeCustomer({ address: { city: 'Puebla' } }));
    expect(response.address).toEqual({
      street: null,
      city: 'Puebla',
      state: null,
      zipCode: null,
    });
  });

  it('nunca incluye passwordHash ni secretos', () => {
    const response = toCustomerResponse(makeCustomer());
    expect(Object.keys(response)).not.toContain('passwordHash');
    expect(JSON.stringify(response)).not.toContain('passwordHash');
  });
});
