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
import { WarehouseModel } from '../../apps/api/src/modules/warehouses/warehouses.model.js';
import { BranchModel } from '../../apps/api/src/modules/branches/branches.model.js';

let ctx: TestContext;
let app: Express;
let adminToken: string;
let stockToken: string;
let limitedToken: string;
/** Almacén activo base (creado directamente para filtros/búsquedas previas). */
let baseWarehouseId: string;
/** Almacén desactivado (filtro `status=inactive`). */
let inactiveWarehouseId: string;
/** Almacén de OTRA empresa (aislamiento). */
let foreignWarehouseId: string;
/** Almacén creado vía API en la suite (sujeto de edición). */
let tempWarehouseId: string;
let productId: string;
let branchId: string;

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
  stockToken = await login('stock@test.local');
  limitedToken = await login('limited@test.local');

  const branch = await BranchModel.create({
    companyId: ctx.company.id,
    code: 'BASE',
    name: 'Sucursal Base',
  });
  branchId = branch.id;

  const base = await WarehouseModel.create({
    companyId: ctx.company.id,
    name: 'Base',
    address: 'Calle Mayor 1',
    isActive: true,
  });
  baseWarehouseId = base.id;

  const inactive = await WarehouseModel.create({
    companyId: ctx.company.id,
    name: 'Retirado',
    isActive: false,
  });
  inactiveWarehouseId = inactive.id;

  const foreign = await WarehouseModel.create({
    companyId: ctx.otherCompany.id,
    name: 'Extranjero',
    isActive: true,
  });
  foreignWarehouseId = foreign.id;

  const product = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      sku: 'SKU-WH-01',
      name: 'Producto para almacén',
      categoryId: ctx.baseCategory.id,
      purchasePrice: 10,
      salePrice: 20,
      unit: 'pza',
    });
  expect(product.status).toBe(201);
  productId = product.body.data.id as string;
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

describe('GET /api/v1/warehouses — RBAC y listado', () => {
  it('devuelve 401 sin token y 403 sin warehouses.read', async () => {
    const noAuth = await request(app).get('/api/v1/warehouses');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('MISSING_TOKEN');

    const forbidden = await request(app)
      .get('/api/v1/warehouses')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('lista solo almacenes de la empresa con el rol almacenero (RBAC positivo)', async () => {
    const res = await request(app)
      .get('/api/v1/warehouses?limit=100')
      .set('Authorization', `Bearer ${stockToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      id: string;
      companyId: string;
      name: string;
      branchId: string | null;
    }>;
    expect(items.length).toBeGreaterThanOrEqual(2); // Base + Retirado
    expect(JSON.stringify(res.body)).not.toContain('Extranjero');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    for (const warehouse of items) {
      expect(warehouse.companyId).toBe(ctx.company.id);
      expect(warehouse.branchId === null || typeof warehouse.branchId === 'string').toBe(true);
    }
    expect(res.body.data.meta.total).toBe(items.length);
  });

  it('filtra por estado y busca por nombre/dirección sin inyección de regex', async () => {
    const inactive = await request(app)
      .get('/api/v1/warehouses?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(inactive.status).toBe(200);
    const names = (inactive.body.data.items as Array<{ id: string; name: string }>).map(
      (w) => w.name,
    );
    expect(names).toContain('Retirado');
    expect(names).not.toContain('Base');
    const ids = (inactive.body.data.items as Array<{ id: string }>).map((w) => w.id);
    expect(ids).toContain(inactiveWarehouseId);

    const search = await request(app)
      .get('/api/v1/warehouses?search=Retira')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(search.status).toBe(200);
    expect((search.body.data.items as Array<{ name: string }>).map((w) => w.name)).toEqual([
      'Retirado',
    ]);

    const hostile = await request(app)
      .get(`/api/v1/warehouses?search=${encodeURIComponent('((')}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hostile.status).toBe(200);
  });

  it('pagina de forma consistente y rechaza sort/limit no permitidos (400)', async () => {
    const all = await request(app)
      .get('/api/v1/warehouses?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const total = all.body.data.meta.total as number;

    const page = await request(app)
      .get('/api/v1/warehouses?page=2&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page.status).toBe(200);
    expect(page.body.data.meta).toEqual({ page: 2, limit: 1, total, totalPages: total });

    const sort = await request(app)
      .get('/api/v1/warehouses?sort=passwordHash')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sort.status).toBe(400);

    const limit = await request(app)
      .get('/api/v1/warehouses?limit=5000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(limit.status).toBe(400);
  });
});

describe('GET /api/v1/warehouses/:id', () => {
  it('devuelve el almacén con dirección y sucursal', async () => {
    const res = await request(app)
      .get(`/api/v1/warehouses/${baseWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Base');
    expect(res.body.data.address).toBe('Calle Mayor 1');
    expect(res.body.data.branchId).toBeNull();
    expect(res.body.data.isActive).toBe(true);
  });

  it('otra empresa → 404, :id inválido → 400, inexistente → 404', async () => {
    const foreign = await request(app)
      .get(`/api/v1/warehouses/${foreignWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');

    const invalid = await request(app)
      .get('/api/v1/warehouses/malo')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .get(`/api/v1/warehouses/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/v1/warehouses — creación', () => {
  it('crea un almacén con el rol almacenero (RBAC positivo)', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${stockToken}`)
      .send({
        name: '  Principal ',
        address: ' Av. Central 100 ',
        branchId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Principal');
    expect(res.body.data.address).toBe('Av. Central 100');
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.branchId).toEqual(expect.any(String));
    expect(res.body.data.companyId).toBe(ctx.company.id);
    tempWarehouseId = res.body.data.id as string;
  });

  it('rechaza el nombre duplicado en la empresa (409 NAME_IN_USE)', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Base' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_IN_USE');
  });

  it('valida la entrada y exige warehouses.write', async () => {
    const invalid = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'x' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details.length).toBeGreaterThan(0);

    const forbidden = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'Sin permiso' });
    expect(forbidden.status).toBe(403);

    const noAuth = await request(app)
      .post('/api/v1/warehouses')
      .send({ name: 'Sin token' });
    expect(noAuth.status).toBe(401);
  });
});

describe('PATCH /api/v1/warehouses/:id — edición y estado', () => {
  it('actualiza nombre, dirección y estado (con reflejo en filtros)', async () => {
    expect(tempWarehouseId).toEqual(expect.any(String));

    const renamed = await request(app)
      .patch(`/api/v1/warehouses/${tempWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Principal Centro', address: 'Av. Central 120' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('Principal Centro');

    const disabled = await request(app)
      .patch(`/api/v1/warehouses/${tempWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.isActive).toBe(false);

    const filtered = await request(app)
      .get('/api/v1/warehouses?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const names = (filtered.body.data.items as Array<{ name: string }>).map((w) => w.name);
    expect(names).toContain('Principal Centro');

    await request(app)
      .patch(`/api/v1/warehouses/${tempWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
  });

  it('valida cuerpo, duplicados, permisos y alcance', async () => {
    const empty = await request(app)
      .patch(`/api/v1/warehouses/${tempWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const duplicate = await request(app)
      .patch(`/api/v1/warehouses/${tempWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Base' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('NAME_IN_USE');

    const sameName = await request(app)
      .patch(`/api/v1/warehouses/${tempWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Principal Centro' });
    expect(sameName.status).toBe(200);

    const forbidden = await request(app)
      .patch(`/api/v1/warehouses/${tempWarehouseId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'Hackeada' });
    expect(forbidden.status).toBe(403);

    const crossTenant = await request(app)
      .patch(`/api/v1/warehouses/${foreignWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fuera' });
    expect(crossTenant.status).toBe(404);
  });
});

describe('GET /api/v1/warehouses/:id/inventory — consultar inventario (M10)', () => {
  it('devuelve las existencias del almacén tras registrar un movimiento', async () => {
    const movement = await request(app)
      .post('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'IN',
        warehouseId: tempWarehouseId,
        productId,
        quantity: 7,
        reason: 'Entrada inicial',
      });
    expect(movement.status).toBe(201);

    const res = await request(app)
      .get(`/api/v1/warehouses/${tempWarehouseId}/inventory`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      warehouseName: string;
      productName: string;
      productSku: string;
      quantity: number;
      lowStock: boolean;
    }>;
    expect(items).toHaveLength(1);
    expect(items[0]?.warehouseName).toBe('Principal Centro');
    expect(items[0]?.productSku).toBe('SKU-WH-01');
    expect(items[0]?.quantity).toBe(7);
    expect(items[0]?.lowStock).toBe(false);
  });

  it('RBAC y alcance: sin token 401, sin inventory.read 403, otra empresa 404', async () => {
    const noAuth = await request(app).get(`/api/v1/warehouses/${tempWarehouseId}/inventory`);
    expect(noAuth.status).toBe(401);

    const forbidden = await request(app)
      .get(`/api/v1/warehouses/${tempWarehouseId}/inventory`)
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

    const crossTenant = await request(app)
      .get(`/api/v1/warehouses/${foreignWarehouseId}/inventory`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(crossTenant.status).toBe(404);

    const invalid = await request(app)
      .get('/api/v1/warehouses/no-id/inventory')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
  });
});
