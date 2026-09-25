import { describe, expect, it } from 'vitest';
import { createCompanySchema, updateCompanySchema } from './company.schema.js';

describe('company schemas', () => {
  it('acepta datos completos y normaliza texto', () => {
    const result = createCompanySchema.safeParse({
      name: '  Acme  ',
      email: '  contacto@acme.test ',
      settings: { currency: 'USD' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Acme');
      expect(result.data.email).toBe('contacto@acme.test');
      expect(result.data.status).toBe('active');
    }
  });

  it('rechaza nombre, correo y actualización vacía', () => {
    expect(createCompanySchema.safeParse({ name: '' }).success).toBe(false);
    expect(createCompanySchema.safeParse({ name: 'Acme', email: 'no-es-correo' }).success).toBe(false);
    expect(updateCompanySchema.safeParse({}).success).toBe(false);
  });
});