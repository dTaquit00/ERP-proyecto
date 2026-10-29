import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestContext, teardownTestContext, TEST_PASSWORD, type TestContext } from '../helpers/integration.js';
import { RoleModel } from '../../apps/api/src/modules/roles/roles.model.js';
import { UserModel } from '../../apps/api/src/modules/users/users.model.js';
import { hashPassword } from '../../apps/api/src/shared/security/password.js';
import { SYSTEM_ROLES } from '../../apps/api/src/modules/roles/roles.system.js';

let ctx: TestContext;
const tokens = new Map<string, string>();
const reports = ['sales', 'purchases', 'inventory', 'inventory-movements', 'products', 'customers', 'suppliers'];
const combined = [
  ['auditor', 'finanzas'], ['gerente', 'compras'], ['auditor', 'almacen'], ['vendedor', 'almacen'],
];
const definitions = [
  ...SYSTEM_ROLES,
  ...combined.map((names) => ({
    name: names.join('-'), displayName: names.join(' + '),
    permissions: [...new Set(SYSTEM_ROLES.filter((role) => names.includes(role.name)).flatMap((role) => role.permissions))],
  })),
];
const allowed: Record<string, string[]> = {
  administrador: reports, gerente: reports, auditor: reports,
  vendedor: ['sales', 'inventory', 'inventory-movements', 'products', 'customers'],
  almacen: ['purchases', 'inventory', 'inventory-movements', 'products', 'customers', 'suppliers'],
  compras: ['purchases', 'inventory', 'inventory-movements', 'products', 'customers', 'suppliers'],
  finanzas: ['sales', 'purchases', 'products', 'customers', 'suppliers'],
  'auditor-finanzas': reports, 'gerente-compras': reports, 'auditor-almacen': reports, 'vendedor-almacen': reports,
};

beforeAll(async () => {
  ctx = await setupTestContext();
  const passwordHash = await hashPassword(TEST_PASSWORD);
  for (const definition of definitions) {
    const role = await RoleModel.findOne({ companyId: ctx.company.id, name: definition.name })
      ?? await RoleModel.create({ companyId: ctx.company.id, name: definition.name, displayName: definition.displayName, permissions: definition.permissions, isSystem: false });
    const email = `${definition.name}@visibility.test`;
    await UserModel.create({ companyId: ctx.company.id, roleId: role!.id, email, firstName: definition.name, lastName: 'Visibilidad', passwordHash, isActive: true });
    const login = await request(ctx.app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    tokens.set(definition.name, login.body.data.accessToken as string);
  }
});
afterAll(async () => { if (ctx) await teardownTestContext(ctx); });

describe('visibilidad según rol en dashboard y reportes', () => {
  it.each(definitions.map((role) => role.name))('%s recibe solo los indicadores de sus módulos', async (role) => {
    const response = await request(ctx.app).get('/api/v1/dashboard/summary').auth(tokens.get(role)!, { type: 'bearer' });
    expect(response.status).toBe(200);
    const modules = allowed[role]!;
    for (const [module, fields] of [
      ['sales', ['ventasHoy', 'ventasMes', 'ventasRecientes']],
      ['purchases', ['comprasMes', 'comprasRecientes']],
      ['inventory', ['stockBajo', 'productosAgotados', 'movimientosRecientes']],
      ['customers', ['clientesActivos']], ['suppliers', ['proveedoresActivos']], ['products', ['productosActivos']],
    ] as const) {
      for (const field of fields) expect(Object.hasOwn(response.body.data, field)).toBe(modules.includes(module));
    }
    expect(Object.hasOwn(response.body.data, 'inventarioValorizado')).toBe(modules.includes('inventory') && modules.includes('purchases'));
  });

  it.each(definitions.map((role) => role.name))('%s no puede consultar ni exportar reportes ajenos', async (roleName) => {
    const role = definitions.find((candidate) => candidate.name === roleName)!;
    for (const type of reports) {
      for (const suffix of ['', '.csv', '.pdf']) {
        const operation = suffix ? 'reports.export' : 'reports.read';
        const permitted = role.permissions.includes(operation) && allowed[roleName]!.includes(type);
        const response = await request(ctx.app).get(`/api/v1/reports/${type}${suffix}`).auth(tokens.get(roleName)!, { type: 'bearer' });
        expect(response.status, `${roleName}: ${type}${suffix}`).toBe(permitted ? 200 : 403);
        if (!permitted) expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      }
    }
  });

  it('un permiso de dashboard aislado no expone ningún dato de negocio', async () => {
    const login = await request(ctx.app).post('/api/v1/auth/login').send({ email: 'limited@test.local', password: TEST_PASSWORD });
    const response = await request(ctx.app).get('/api/v1/dashboard/summary').auth(login.body.data.accessToken as string, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({});
  });

  it('los permisos de reportes solos no permiten obtener datos de otros módulos', async () => {
    await RoleModel.updateOne({ _id: ctx.limitedRole.id }, { $set: { permissions: ['reports.read', 'reports.export'] } });
    const login = await request(ctx.app).post('/api/v1/auth/login').send({ email: 'limited@test.local', password: TEST_PASSWORD });
    for (const suffix of ['', '.csv', '.pdf']) {
      const response = await request(ctx.app).get(`/api/v1/reports/sales${suffix}`).auth(login.body.data.accessToken as string, { type: 'bearer' });
      expect(response.status).toBe(403);
    }
  });
});
