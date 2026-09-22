import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { Types } from 'mongoose';
import {
  setupTestContext,
  teardownTestContext,
  TEST_PASSWORD,
  type TestContext,
} from '../helpers/integration.js';
import { CustomerModel } from '../../apps/api/src/modules/customers/customers.model.js';
import { RoleModel } from '../../apps/api/src/modules/roles/roles.model.js';
import { UserModel } from '../../apps/api/src/modules/users/users.model.js';
import { hashPassword } from '../../apps/api/src/shared/security/password.js';

let ctx: TestContext;
let app: Express;
let adminToken: string;
let salesToken: string;
let limitedToken: string;
/** Cliente base (activo, con dirección) de la empresa. */
let baseCustomerId: string;
/** Cliente creado por la suite para pruebas de edición. */
let tempCustomerId: string;
/** Cliente de OTRA empresa creado directamente (aislamiento). */
let foreignCustomerId: string;

async function login(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

beforeAll(async () => {
  ctx = await setupTestContext();
  app = ctx.app;
  adminToken = await login('admin@test.local');
  limitedToken = await login('limited@test.local');

  // Rol comercial con customers.read/write (RBAC positivo sin usar admin).
  const salesRole = await RoleModel.create({
    companyId: ctx.company.id,
    name: 'comercial',
    displayName: 'Comercial',
    permissions: ['customers.read', 'customers.write'],
    isSystem: false,
  });
  await UserModel.create({
    companyId: ctx.company.id,
    email: 'sales@test.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Sara',
    lastName: 'Ventas',
    roleId: salesRole.id,
    isActive: true,
  });
  salesToken = await login('sales@test.local');

  // Fixtures: uno activo con dirección, uno desactivado y uno de otra empresa.
  const base = await CustomerModel.create({
    companyId: ctx.company.id,
    name: 'Ana López',
    email: 'ana@cliente.test',
    phone: '55 1234 5678',
    dni: 'AAA123456',
    address: { street: 'Av. Reforma 100', city: 'CDMX', state: 'CDMX', zipCode: '06000' },
    isActive: true,
  });
  baseCustomerId = base.id;

  await CustomerModel.create({
    companyId: ctx.company.id,
    name: 'Zoe Inactivo',
    email: 'zoe@inactivo.test',
    isActive: false,
  });

  const foreign = await CustomerModel.create({
    companyId: ctx.otherCompany.id,
    name: 'Cliente Ajeno',
    email: 'ajeno@otra.test',
  });
  foreignCustomerId = foreign.id;
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

describe('GET /api/v1/customers — RBAC y listado', () => {
  it('devuelve 401 sin token y 403 sin customers.read', async () => {
    const noAuth = await request(app).get('/api/v1/customers');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('MISSING_TOKEN');

    const forbidden = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('lista solo clientes de la empresa con su dirección y sin datos sensibles', async () => {
    // RBAC positivo: el rol comercial sí tiene customers.read
    const res = await request(app)
      .get('/api/v1/customers?limit=100')
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      id: string;
      companyId: string;
      name: string;
      address: { street: string | null } | null;
      isActive: boolean;
    }>;
    expect(items.length).toBeGreaterThanOrEqual(2); // Ana + Zoe
    expect(JSON.stringify(res.body)).not.toContain('Cliente Ajeno');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    for (const customer of items) {
      expect(customer.companyId).toBe(ctx.company.id);
    }
    const ana = items.find((c) => c.name === 'Ana López');
    expect(ana?.address?.street).toBe('Av. Reforma 100');
    expect(ana?.isActive).toBe(true);
  });

  it('pagina de forma consistente (meta calculada en backend)', async () => {
    const all = await request(app)
      .get('/api/v1/customers?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const total = all.body.data.meta.total as number;
    expect(total).toBeGreaterThanOrEqual(2);

    const page = await request(app)
      .get('/api/v1/customers?page=2&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page.status).toBe(200);
    expect(page.body.data.meta).toEqual({ page: 2, limit: 1, total, totalPages: total });
    expect(page.body.data.items.length).toBeLessThanOrEqual(1);
  });

  it('busca por nombre o correo y sobrevive a regex hostiles', async () => {
    const byName = await request(app)
      .get('/api/v1/customers?search=Ana')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byName.status).toBe(200);
    const names = (byName.body.data.items as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain('Ana López');
    expect(names).not.toContain('Zoe Inactivo');

    const byEmail = await request(app)
      .get('/api/v1/customers?search=ana@cliente')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byEmail.status).toBe(200);
    expect((byEmail.body.data.items as Array<{ name: string }>).map((c) => c.name)).toContain(
      'Ana López',
    );

    const hostile = await request(app)
      .get(`/api/v1/customers?search=${encodeURIComponent('(((')}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hostile.status).toBe(200);
  });

  it('filtra por estado y valida sort/limit', async () => {
    const inactive = await request(app)
      .get('/api/v1/customers?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(inactive.status).toBe(200);
    const inactiveItems = inactive.body.data.items as Array<{ name: string; isActive: boolean }>;
    expect(inactiveItems.some((c) => c.name === 'Zoe Inactivo')).toBe(true);
    expect(inactiveItems.every((c) => c.isActive === false)).toBe(true);

    const sort = await request(app)
      .get('/api/v1/customers?sort=passwordHash')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sort.status).toBe(400);

    const limit = await request(app)
      .get('/api/v1/customers?limit=5000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(limit.status).toBe(400);
  });
});

describe('GET /api/v1/customers/:id', () => {
  it('devuelve el cliente con su dirección completa', async () => {
    const res = await request(app)
      .get(`/api/v1/customers/${baseCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Ana López');
    expect(res.body.data.dni).toBe('AAA123456');
    expect(res.body.data.address).toEqual({
      street: 'Av. Reforma 100',
      city: 'CDMX',
      state: 'CDMX',
      zipCode: '06000',
    });
  });

  it('aislamiento y validación: otra empresa → 404, id inválido → 400, inexistente → 404', async () => {
    const foreign = await request(app)
      .get(`/api/v1/customers/${foreignCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');

    const invalid = await request(app)
      .get('/api/v1/customers/malo')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .get(`/api/v1/customers/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/v1/customers — creación', () => {
  it('crea un cliente completo normalizando correo y dirección', async () => {
    // RBAC positivo: el rol comercial también tiene customers.write
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        name: '  Mariana Cruz ',
        email: ' MARIANA@Demo.COM ',
        phone: '55 0000 1111',
        dni: 'AAA998877',
        address: { street: 'Calle 10', city: 'Puebla', state: '', zipCode: '72000' },
        notes: 'Cliente nuevo',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Mariana Cruz');
    expect(res.body.data.email).toBe('mariana@demo.com');
    expect(res.body.data.address.state).toBeNull(); // '' → sin valor
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.companyId).toBe(ctx.company.id);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    tempCustomerId = res.body.data.id as string;
  });

  it('acepta un cliente mínimo y trata cadenas vacías como ausentes', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Solo Nombre', email: '', phone: '' });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBeNull();
    expect(res.body.data.phone).toBeNull();
    expect(res.body.data.address).toBeNull();
  });

  it('valida la entrada y exige customers.write', async () => {
    const tooShort = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'A' });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.error.code).toBe('VALIDATION_ERROR');
    expect(tooShort.body.error.details.length).toBeGreaterThan(0);

    const badEmail = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Cliente', email: 'no-correo' });
    expect(badEmail.status).toBe(400);

    const forbidden = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'Sin permiso' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

    const noAuth = await request(app)
      .post('/api/v1/customers')
      .send({ name: 'Sin token' });
    expect(noAuth.status).toBe(401);
  });
});

describe('PATCH /api/v1/customers/:id — edición y estado', () => {
  it('actualiza nombre, dirección (reemplazo completo) y estado', async () => {
    expect(tempCustomerId).toEqual(expect.any(String));

    const updated = await request(app)
      .patch(`/api/v1/customers/${tempCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mariana C. Ruiz', address: { city: 'CDMX' } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Mariana C. Ruiz');
    expect(updated.body.data.address).toEqual({
      street: null, // la dirección se reemplaza completa
      city: 'CDMX',
      state: null,
      zipCode: null,
    });

    const disabled = await request(app)
      .patch(`/api/v1/customers/${tempCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.isActive).toBe(false);

    const filtered = await request(app)
      .get('/api/v1/customers?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const names = (filtered.body.data.items as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain('Mariana C. Ruiz');

    // Reactivar para no afectar a otros casos
    await request(app)
      .patch(`/api/v1/customers/${tempCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
  });

  it('limpia opcionales con cadena vacía o solo espacios (persiste null)', async () => {
    // Diseño B: `''` / solo espacios → null explícito (≠ undefined: sí cuenta
    // para el refine de "al menos un campo" y sí se persiste en MongoDB).
    const res = await request(app)
      .patch(`/api/v1/customers/${tempCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: '', notes: '   ' });
    expect(res.status).toBe(200);

    // Re-lectura desde la BD: canonical `null` (aplicable en {field: null}).
    const persisted = await CustomerModel.findById(tempCustomerId);
    expect(persisted).not.toBeNull();
    if (persisted === null) return;
    expect(persisted.email).toBeNull();
    expect(persisted.notes).toBeNull();

    // Y en la respuesta del detalle; los no enviados quedan intactos.
    const detail = await request(app)
      .get(`/api/v1/customers/${tempCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.email).toBeNull();
    expect(detail.body.data.notes).toBeNull();
    expect(detail.body.data.name).toBe('Mariana C. Ruiz');
  });

  it('valida cuerpo, permisos y alcance', async () => {
    const empty = await request(app)
      .patch(`/api/v1/customers/${tempCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const forbidden = await request(app)
      .patch(`/api/v1/customers/${tempCustomerId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'Hackeado' });
    expect(forbidden.status).toBe(403);

    const crossTenant = await request(app)
      .patch(`/api/v1/customers/${foreignCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fuera' });
    expect(crossTenant.status).toBe(404);
  });
});

describe('DELETE /api/v1/customers/:id', () => {
  it('no existe: la desactivación se hace con PATCH isActive (404)', async () => {
    const res = await request(app)
      .delete(`/api/v1/customers/${tempCustomerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
