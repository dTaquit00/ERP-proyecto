import { describe, expect, it } from 'vitest';
import {
  createSupplierSchema,
  listSuppliersQuerySchema,
  updateSupplierSchema,
} from './supplier.schema.js';

const VALID_SUPPLIER = {
  name: 'Distribuidora Norte',
  contactName: ' Carla Norte ',
  email: ' CARLA@NORTE.COM ',
  phone: '55 9999 0000',
  ruc: 'XAXX010100000',
  address: { street: 'Blvd. Norte 42', city: 'Monterrey', state: 'NL' },
  notes: 'Crédito a 30 días',
};

describe('createSupplierSchema', () => {
  it('acepta un proveedor completo normalizando espacios y correo', () => {
    const result = createSupplierSchema.safeParse(VALID_SUPPLIER);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contactName).toBe('Carla Norte');
      expect(result.data.email).toBe('carla@norte.com');
      expect(result.data.address?.state).toBe('NL');
    }
  });

  it('acepta un proveedor mínimo con solo el nombre', () => {
    expect(createSupplierSchema.safeParse({ name: 'Básico' }).success).toBe(true);
  });

  it('exige nombre de 2 a 120 caracteres', () => {
    expect(createSupplierSchema.safeParse({}).success).toBe(false);
    expect(createSupplierSchema.safeParse({ name: 'X' }).success).toBe(false);
    expect(createSupplierSchema.safeParse({ name: 'y'.repeat(121) }).success).toBe(false);
  });

  it('valida correo, contacto, teléfono, RUC y notas', () => {
    expect(
      createSupplierSchema.safeParse({ ...VALID_SUPPLIER, email: 'no-correo' }).success,
    ).toBe(false);
    expect(
      createSupplierSchema.safeParse({ ...VALID_SUPPLIER, contactName: 'c'.repeat(121) }).success,
    ).toBe(false);
    expect(
      createSupplierSchema.safeParse({ ...VALID_SUPPLIER, phone: 'p'.repeat(31) }).success,
    ).toBe(false);
    expect(createSupplierSchema.safeParse({ ...VALID_SUPPLIER, ruc: 'r'.repeat(21) }).success).toBe(
      false,
    );
    expect(
      createSupplierSchema.safeParse({ ...VALID_SUPPLIER, notes: 'n'.repeat(1001) }).success,
    ).toBe(false);
  });
});

describe('updateSupplierSchema', () => {
  it('acepta cambios parciales, dirección nueva e isActive', () => {
    expect(updateSupplierSchema.safeParse({ contactName: 'Nuevo Contacto' }).success).toBe(true);
    expect(updateSupplierSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateSupplierSchema.safeParse({ address: { city: 'Puebla' } }).success).toBe(true);
    expect(updateSupplierSchema.safeParse({ email: '' }).success).toBe(true); // '' → sin valor
  });

  it('rechaza cuerpos vacíos y valores inválidos', () => {
    expect(updateSupplierSchema.safeParse({}).success).toBe(false);
    expect(updateSupplierSchema.safeParse({ name: 'X' }).success).toBe(false);
    expect(updateSupplierSchema.safeParse({ ruc: 'r'.repeat(21) }).success).toBe(false);
  });
});

describe('listSuppliersQuerySchema', () => {
  it('aplica defaults de paginación y orden', () => {
    const result = listSuppliersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
    }
  });

  it('rechaza sort no permitido, estado inválido y límites fuera de rango', () => {
    expect(listSuppliersQuerySchema.safeParse({ sort: 'passwordHash' }).success).toBe(false);
    expect(listSuppliersQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
    expect(listSuppliersQuerySchema.safeParse({ limit: '5000' }).success).toBe(false);
  });
});
