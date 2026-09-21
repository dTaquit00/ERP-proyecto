import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseOrThrow } from './parse.js';
import { ValidationError } from './errors.js';

const schema = z.object({
  email: z.string().email(),
  quantity: z.number().int().positive(),
});

describe('parseOrThrow', () => {
  it('devuelve los datos tipados cuando son válidos', () => {
    const result = parseOrThrow(schema, { email: 'a@b.co', quantity: 2 });
    expect(result).toEqual({ email: 'a@b.co', quantity: 2 });
  });

  it('lanza ValidationError (400) con detalles por campo', () => {
    try {
      parseOrThrow(schema, { email: 'no-correo', quantity: -1 });
      expect.unreachable('Debió lanzar ValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.status).toBe(400);
      expect(validationError.code).toBe('VALIDATION_ERROR');
      const paths = validationError.details?.map((detail) => detail.path);
      expect(paths).toContain('email');
      expect(paths).toContain('quantity');
    }
  });

  it('lanza ValidationError cuando falta un campo obligatorio', () => {
    expect(() => parseOrThrow(schema, {})).toThrow(ValidationError);
  });

  it('acepta inputs arbitrarios sin lanzar errores inesperados', () => {
    expect(() => parseOrThrow(schema, null)).toThrow(ValidationError);
    expect(() => parseOrThrow(schema, 'texto')).toThrow(ValidationError);
    expect(() => parseOrThrow(schema, [])).toThrow(ValidationError);
  });
});
