import { describe, expect, it } from 'vitest';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from './user.schema.js';

describe('createUserSchema', () => {
  it('acepta datos válidos y activa el usuario por defecto', () => {
    const result = createUserSchema.safeParse({
      email: '  Nuevo@TEST.local ',
      password: 'Clave1234',
      firstName: ' Nuevo ',
      lastName: 'Usuario',
      roleId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('nuevo@test.local');
      expect(result.data.firstName).toBe('Nuevo');
      expect(result.data.isActive).toBe(true);
    }
  });

  it('rechaza correo inválido, contraseña débil e ID de rol malformado', () => {
    const base = { password: 'Clave1234', firstName: 'A', lastName: 'B', roleId: 'aaaaaaaaaaaaaaaaaaaaaaaa' };
    expect(createUserSchema.safeParse({ ...base, email: 'no-correo' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, email: 'a@b.co', password: '123' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, email: 'a@b.co', password: 'clave sin numeros' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, email: 'a@b.co', roleId: 'no-valido' }).success).toBe(false);
  });

  it('rechaza campos vacíos', () => {
    const result = createUserSchema.safeParse({
      email: 'a@b.co',
      password: 'Clave1234',
      firstName: '   ',
      lastName: '',
      roleId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('acepta actualizaciones parciales', () => {
    expect(updateUserSchema.safeParse({ firstName: 'Otro' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ roleId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }).success).toBe(true);
  });

  it('rechaza un cuerpo vacío o sin campos reconocidos', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(updateUserSchema.safeParse({ unknownField: 'x' }).success).toBe(false);
  });
});

describe('listUsersQuerySchema', () => {
  it('aplica paginación y orden por defecto', () => {
    const result = listUsersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
    }
  });

  it('convierte la query string a números', () => {
    const result = listUsersQuerySchema.safeParse({ page: '3', limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(10);
    }
  });

  it('rechaza campos de orden no permitidos (inyección de sort) y límites excesivos', () => {
    expect(listUsersQuerySchema.safeParse({ sort: 'passwordHash' }).success).toBe(false);
    expect(listUsersQuerySchema.safeParse({ order: 'sideways' }).success).toBe(false);
    expect(listUsersQuerySchema.safeParse({ limit: '5000' }).success).toBe(false);
    expect(listUsersQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});
