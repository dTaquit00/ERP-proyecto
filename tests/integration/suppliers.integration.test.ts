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
import { SupplierModel } from '../../apps/api/src/modules/suppliers/suppliers.model.js';
import { RoleModel } from '../../apps/api/src/modules/roles/roles.model.js';
import { UserModel } from '../../apps/api/src/modules/users/users.model.js';
import { hashPassword } from '../../apps/api/src/shared/security/password.js';

let ctx: TestContext;
let app: Express;
let adminToken: string;
let purchasingToken: string;
let limitedToken: string;
/** Proveedor base (activo, con dirección) de la empresa. */
let baseSupplierId: string;
/** Proveedor creado por la suite para pruebas de edición. */
let tempSupplierId: string;
/** Proveedor de OTRA empresa creado directamente (aislamiento). */
let foreignSupplierId: string;

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

  // Rol propio con suppliers.read/write (RBAC positivo sin usar admin).
  // Nombre distinto a los 7 roles del sistema: `compras` ya existe (índice único).
  const purchasingRole = await RoleModel.create({
    companyId: ctx.company.id,
    name: 'proveeduria',
    displayName: 'Proveeduría',
    permissions: ['suppliers.read', 'suppliers.write'],
    isSystem: false,
  });
  await UserModel.create({
    companyId: ctx.company.id,
    email: 'purchasing@test.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Pablo',
    lastName: 'Compras',
    roleId: purchasingRole.id,
    isActive: true,
  });
  purchasingToken = await login('purchasing@test.local');

  // Fixtures: uno activo con dirección, uno desactivado y uno de otra empresa.
  const base = await SupplierModel.create({
    companyId: ctx.company.id,
    name: 'Distribuidora Norte',
    contactName: 'Carla Norte',
    email: 'CARLA@NORTE.TEST',
    phone: '55 9999 0000',
    ruc: 'XAXX010100000',
    address: { street: 'Blvd. Norte 42', city: 'Monterrey', state: 'NL', zipCode: '64000' },
    isActive: true,
  });
  baseSupplierId = base.id;

  await SupplierModel.create({
    companyId: ctx.company.id,
    name: 'Proveedor Inactivo',
    email: 'inactivo@proveedor.test',
    isActive: false,
  });

  const foreign = await SupplierModel.create({
    companyId: ctx.otherCompany.id,
    name: 'Proveedor Ajeno',
    email: 'ajeno@otra.test',
  });
  foreignSupplierId = foreign.id;
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

describe('GET /api/v1/suppliers — RBAC y listado', () => {
  it('devuelve 401 sin token y 403 sin suppliers.read', async () => {
    const noAuth = await request(app).get('/api/v1/suppliers');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('MISSING_TOKEN');

    const forbidden = await request(app)
      .get('/api/v1/suppliers')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('lista solo proveedores de la empresa con su dirección y sin datos sensibles', async () => {
    // RBAC positivo: el rol proveeduria sí tiene suppliers.read
    const res = await request(app)
      .get('/api/v1/suppliers?limit=100')
      .set('Authorization', `Bearer ${purchasingToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      id: string;
      companyId: string;
      name: string;
      ruc: string | null;
      address: { street: string | null } | null;
      isActive: boolean;
    }>;
    expect(items.length).toBeGreaterThanOrEqual(2); // Norte + Inactivo
    expect(JSON.stringify(res.body)).not.toContain('Proveedor Ajeno');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    for (const supplier of items) {
      expect(supplier.companyId).toBe(ctx.company.id);
    }
    const norte = items.find((s) => s.name === 'Distribuidora Norte');
    expect(norte?.ruc).toBe('XAXX010100000');
    expect(norte?.address?.street).toBe('Blvd. Norte 42');
    expect(norte?.isActive).toBe(true);
  });

  it('pagina de forma consistente (meta calculada en backend)', async () => {
    const all = await request(app)
      .get('/api/v1/suppliers?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const total = all.body.data.meta.total as number;
    expect(total).toBeGreaterThanOrEqual(2);

    const page = await request(app)
      .get('/api/v1/suppliers?page=2&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page.status).toBe(200);
    expect(page.body.data.meta).toEqual({ page: 2, limit: 1, total, totalPages: total });
    expect(page.body.data.items.length).toBeLessThanOrEqual(1);
  });

  it('busca por nombre, contacto o RUC y sobrevive a regex hostiles', async () => {
    const byName = await request(app)
      .get('/api/v1/suppliers?search=Norte')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byName.status).toBe(200);
    const names = (byName.body.data.items as Array<{ name: string }>).map((s) => s.name);
    expect(names).toContain('Distribuidora Norte');
    expect(names).not.toContain('Proveedor Inactivo');

    const byRuc = await request(app)
      .get('/api/v1/suppliers?search=XAXX010100000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byRuc.status).toBe(200);
    expect((byRuc.body.data.items as Array<{ name: string }>).map((s) => s.name)).toContain(
      'Distribuidora Norte',
    );

    const hostile = await request(app)
      .get(`/api/v1/suppliers?search=${encodeURIComponent('[[)')}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hostile.status).toBe(200);
  });

  it('filtra por estado y valida sort/limit', async () => {
    const inactive = await request(app)
      .get('/api/v1/suppliers?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(inactive.status).toBe(200);
    const inactiveItems = inactive.body.data.items as Array<{ name: string; isActive: boolean }>;
    expect(inactiveItems.some((s) => s.name === 'Proveedor Inactivo')).toBe(true);
    expect(inactiveItems.every((s) => s.isActive === false)).toBe(true);

    const sort = await request(app)
      .get('/api/v1/suppliers?sort=passwordHash')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sort.status).toBe(400);

    const limit = await request(app)
      .get('/api/v1/suppliers?limit=5000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(limit.status).toBe(400);
  });
});

describe('GET /api/v1/suppliers/:id', () => {
  it('devuelve el proveedor con su dirección completa (correo en minúsculas)', async () => {
    const res = await request(app)
      .get(`/api/v1/suppliers/${baseSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Distribuidora Norte');
    expect(res.body.data.contactName).toBe('Carla Norte');
    expect(res.body.data.email).toBe('carla@norte.test'); // normalizado
    expect(res.body.data.address).toEqual({
      street: 'Blvd. Norte 42',
      city: 'Monterrey',
      state: 'NL',
      zipCode: '64000',
    });
  });

  it('aislamiento y validación: otra empresa → 404, id inválido → 400, inexistente → 404', async () => {
    const foreign = await request(app)
      .get(`/api/v1/suppliers/${foreignSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');

    const invalid = await request(app)
      .get('/api/v1/suppliers/malo')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .get(`/api/v1/suppliers/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/v1/suppliers — creación', () => {
  it('crea un proveedor completo normalizando correo y dirección', async () => {
    // RBAC positivo: el rol proveeduria también tiene suppliers.write
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${purchasingToken}`)
      .send({
        name: '  Importadora del Sur ',
        contactName: ' Luis Sur ',
        email: ' LUIS@SUR.TEST ',
        phone: '55 1111 2222',
        ruc: 'XEXX010101010',
        address: { street: 'Av. Sur 7', city: 'Mérida', state: 'YUC', zipCode: '97000' },
        notes: 'Entrega los martes',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Importadora del Sur');
    expect(res.body.data.contactName).toBe('Luis Sur');
    expect(res.body.data.email).toBe('luis@sur.test');
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.companyId).toBe(ctx.company.id);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    tempSupplierId = res.body.data.id as string;
  });

  it('permite nombres duplicados (decisión de negocio: sin unicidad)', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Distribuidora Norte', email: 'otro@norte.test' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe(baseSupplierId);
  });

  it('valida la entrada y exige suppliers.write', async () => {
    const tooShort = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.error.code).toBe('VALIDATION_ERROR');
    expect(tooShort.body.error.details.length).toBeGreaterThan(0);

    const badEmail = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Proveedor', email: 'no-correo' });
    expect(badEmail.status).toBe(400);

    const forbidden = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'Sin permiso' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

    const noAuth = await request(app)
      .post('/api/v1/suppliers')
      .send({ name: 'Sin token' });
    expect(noAuth.status).toBe(401);
  });
});

describe('PATCH /api/v1/suppliers/:id — edición y estado', () => {
  it('actualiza contacto, dirección (reemplazo completo) y estado', async () => {
    expect(tempSupplierId).toEqual(expect.any(String));

    const updated = await request(app)
      .patch(`/api/v1/suppliers/${tempSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contactName: 'Luis R. Sur', address: { city: 'Mérida' } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.contactName).toBe('Luis R. Sur');
    expect(updated.body.data.address).toEqual({
      street: null, // la dirección se reemplaza completa
      city: 'Mérida',
      state: null,
      zipCode: null,
    });

    const disabled = await request(app)
      .patch(`/api/v1/suppliers/${tempSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.isActive).toBe(false);

    const filtered = await request(app)
      .get('/api/v1/suppliers?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const names = (filtered.body.data.items as Array<{ name: string }>).map((s) => s.name);
    expect(names).toContain('Importadora del Sur');

    // Reactivar para no afectar a otros casos
    await request(app)
      .patch(`/api/v1/suppliers/${tempSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
  });

  it('limpia opcionales con cadena vacía o solo espacios (persiste null)', async () => {
    // Diseño B: `''` / solo espacios → null explícito (≠ undefined: sí cuenta
    // para el refine de "al menos un campo" y sí se persiste en MongoDB).
    const res = await request(app)
      .patch(`/api/v1/suppliers/${tempSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: '', ruc: '', notes: '   ' });
    expect(res.status).toBe(200);

    // Re-lectura desde la BD: canonical `null` (aplicable en {field: null}).
    const persisted = await SupplierModel.findById(tempSupplierId);
    expect(persisted).not.toBeNull();
    if (persisted === null) return;
    expect(persisted.email).toBeNull();
    expect(persisted.ruc).toBeNull();
    expect(persisted.notes).toBeNull();

    // Y en la respuesta del detalle; los no enviados quedan intactos.
    const detail = await request(app)
      .get(`/api/v1/suppliers/${tempSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.email).toBeNull();
    expect(detail.body.data.ruc).toBeNull();
    expect(detail.body.data.notes).toBeNull();
    expect(detail.body.data.name).toBe('Importadora del Sur');
  });

  it('valida cuerpo, permisos y alcance', async () => {
    const empty = await request(app)
      .patch(`/api/v1/suppliers/${tempSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const forbidden = await request(app)
      .patch(`/api/v1/suppliers/${tempSupplierId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'Hackeado' });
    expect(forbidden.status).toBe(403);

    const crossTenant = await request(app)
      .patch(`/api/v1/suppliers/${foreignSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fuera' });
    expect(crossTenant.status).toBe(404);
  });
});

describe('DELETE /api/v1/suppliers/:id', () => {
  it('no existe: la desactivación se hace con PATCH isActive (404)', async () => {
    const res = await request(app)
      .delete(`/api/v1/suppliers/${tempSupplierId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
