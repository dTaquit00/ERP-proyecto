import { describe, expect, it } from 'vitest';
import { createRoleSchema, permissionSchema, updateRoleSchema } from './role.schema.js';

describe('permissionSchema', () => {
  it('acepta permisos del catálogo', () => {
    expect(permissionSchema.safeParse('sales.write').success).toBe(true);
    expect(permissionSchema.safeParse('audit.read').success).toBe(true);
  });

  it('rechaza permisos desconocidos', () => {
    expect(permissionSchema.safeParse('sales.delete_everything').success).toBe(false);
    expect(permissionSchema.safeParse('').success).toBe(false);
    expect(permissionSchema.safeParse('SALES.READ').success).toBe(false);
  });
});

describe('createRoleSchema', () => {
  it('normaliza el nombre a minúsculas y aplica permisos vacíos por defecto', () => {
    const result = createRoleSchema.safeParse({
      name: '  JefeDeVenta ',
      displayName: ' Jefe de Venta ',
      permissions: ['sales.read'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('jefedeventa');
      expect(result.data.displayName).toBe('Jefe de Venta');
      expect(result.data.permissions).toEqual(['sales.read']);
    }
  });

  it('rechaza nombres con espacios o caracteres inválidos', () => {
    expect(createRoleSchema.safeParse({ name: 'mi rol', displayName: 'MR' }).success).toBe(false);
    expect(createRoleSchema.safeParse({ name: 'x', displayName: 'MR' }).success).toBe(false);
    expect(createRoleSchema.safeParse({ name: 'rol invalido!', displayName: 'MR' }).success).toBe(false);
  });

  it('rechaza listas de permisos con valores ajenos al catálogo', () => {
    const result = createRoleSchema.safeParse({
      name: 'rol-valido',
      displayName: 'Rol',
      permissions: ['sales.read', 'hacker.permission'],
    });
    expect(result.success).toBe(false);
  });
});

describe('updateRoleSchema', () => {
  it('acepta cambios parciales', () => {
    expect(updateRoleSchema.safeParse({ displayName: 'Nuevo' }).success).toBe(true);
    expect(updateRoleSchema.safeParse({ permissions: ['users.read'] }).success).toBe(true);
  });

  it('rechaza cuerpos vacíos', () => {
    expect(updateRoleSchema.safeParse({}).success).toBe(false);
  });
});
