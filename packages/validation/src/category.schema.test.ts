import { describe, expect, it } from 'vitest';
import {
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from './category.schema.js';

describe('createCategorySchema', () => {
  it('acepta una categoría válida y recorta espacios', () => {
    const result = createCategorySchema.safeParse({
      name: '  Electrónica ',
      description: ' Aparatos y accesorios ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Electrónica');
      expect(result.data.description).toBe('Aparatos y accesorios');
    }
  });

  it('la descripción es opcional', () => {
    expect(createCategorySchema.safeParse({ name: 'Ropa' }).success).toBe(true);
  });

  it('rechaza nombres demasiado cortos, vacíos o largos', () => {
    expect(createCategorySchema.safeParse({ name: 'x' }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: '' }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'a'.repeat(81) }).success).toBe(false);
  });

  it('descarta campos desconocidos y valida los tipos de los conocidos', () => {
    // Comportamiento Zod por defecto: las claves ajenas al schema se eliminan
    // (nadie puede inyectar `isActive` u otros campos de más).
    const result = createCategorySchema.safeParse({ name: 'Ropa', isActive: 'si' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ name: 'Ropa' });

    expect(createCategorySchema.safeParse({ name: 123 }).success).toBe(false);
    expect(createCategorySchema.safeParse({}).success).toBe(false);
  });
});

describe('updateCategorySchema', () => {
  it('acepta cambios parciales (nombre, descripción o estado)', () => {
    expect(updateCategorySchema.safeParse({ name: 'Nuevo nombre' }).success).toBe(true);
    expect(updateCategorySchema.safeParse({ description: '' }).success).toBe(true);
    expect(updateCategorySchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('rechaza cuerpos vacíos o inválidos', () => {
    expect(updateCategorySchema.safeParse({}).success).toBe(false);
    expect(updateCategorySchema.safeParse({ isActive: 'no' }).success).toBe(false);
    expect(updateCategorySchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('listCategoriesQuerySchema', () => {
  it('aplica defaults de paginación y orden', () => {
    const result = listCategoriesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
    }
  });

  it('coage strings de la query string y valida enums y límites', () => {
    expect(listCategoriesQuerySchema.safeParse({ page: '3', limit: '50' }).success).toBe(true);
    expect(listCategoriesQuerySchema.safeParse({ limit: '5000' }).success).toBe(false);
    expect(listCategoriesQuerySchema.safeParse({ sort: 'passwordHash' }).success).toBe(false);
    expect(listCategoriesQuerySchema.safeParse({ status: 'unknown' }).success).toBe(false);
  });
});
