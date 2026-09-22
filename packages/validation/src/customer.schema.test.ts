import { describe, expect, it } from 'vitest';
import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from './customer.schema.js';

const VALID_CUSTOMER = {
  name: 'Acme ',
  email: ' CONTACTO@Acme.COM ',
  phone: '55 1234 5678',
  dni: 'AAA123456',
  address: { street: ' Av. Central 1 ', city: 'CDMX', state: '', zipCode: null },
  notes: '',
};

describe('createCustomerSchema', () => {
  it('acepta un cliente completo normalizando espacios y correo', () => {
    const result = createCustomerSchema.safeParse(VALID_CUSTOMER);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Acme');
      expect(result.data.email).toBe('contacto@acme.com');
      expect(result.data.address?.street).toBe('Av. Central 1');
      expect(result.data.address?.state).toBeUndefined(); // '' → sin valor
      expect(result.data.address?.zipCode).toBeUndefined(); // null → sin valor
      expect(result.data.notes).toBeUndefined(); // '' → sin valor
    }
  });

  it('acepta un cliente mínimo con solo el nombre', () => {
    expect(createCustomerSchema.safeParse({ name: 'Berta' }).success).toBe(true);
  });

  it('exige nombre de 2 a 120 caracteres', () => {
    expect(createCustomerSchema.safeParse({}).success).toBe(false);
    expect(createCustomerSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false);
  });

  it('valida correo, teléfono, DNI y notas', () => {
    expect(createCustomerSchema.safeParse({ ...VALID_CUSTOMER, email: 'no-correo' }).success).toBe(
      false,
    );
    expect(
      createCustomerSchema.safeParse({ ...VALID_CUSTOMER, phone: 'p'.repeat(31) }).success,
    ).toBe(false);
    expect(createCustomerSchema.safeParse({ ...VALID_CUSTOMER, dni: 'd'.repeat(21) }).success).toBe(
      false,
    );
    expect(
      createCustomerSchema.safeParse({ ...VALID_CUSTOMER, notes: 'n'.repeat(1001) }).success,
    ).toBe(false);
  });

  it('valida la dirección opcional componente por componente', () => {
    expect(
      createCustomerSchema.safeParse({ ...VALID_CUSTOMER, address: { street: 's'.repeat(201) } })
        .success,
    ).toBe(false);
    expect(
      createCustomerSchema.safeParse({ ...VALID_CUSTOMER, address: { zipCode: '1'.repeat(21) } })
        .success,
    ).toBe(false);
    expect(createCustomerSchema.safeParse({ ...VALID_CUSTOMER, address: 'sin objeto' }).success).toBe(
      false,
    );
  });
});

describe('updateCustomerSchema', () => {
  it('acepta cambios parciales, dirección nueva e isActive', () => {
    expect(updateCustomerSchema.safeParse({ name: 'Otro Nombre' }).success).toBe(true);
    expect(updateCustomerSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(
      updateCustomerSchema.safeParse({ address: { city: 'Guadalajara' } }).success,
    ).toBe(true);
    expect(updateCustomerSchema.safeParse({ email: '' }).success).toBe(true); // '' → sin valor
  });

  it('rechaza cuerpos vacíos y valores inválidos', () => {
    expect(updateCustomerSchema.safeParse({}).success).toBe(false);
    expect(updateCustomerSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(updateCustomerSchema.safeParse({ email: 'no-correo' }).success).toBe(false);
  });
});

describe('listCustomersQuerySchema', () => {
  it('aplica defaults de paginación y orden', () => {
    const result = listCustomersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
      expect(result.data.limit).toBe(20);
    }
  });

  it('rechaza sort no permitido, estado inválido y límites fuera de rango', () => {
    expect(listCustomersQuerySchema.safeParse({ sort: 'passwordHash' }).success).toBe(false);
    expect(listCustomersQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
    expect(listCustomersQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listCustomersQuerySchema.safeParse({ limit: '5000' }).success).toBe(false);
  });
});
