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

let ctx: TestContext;
let app: Express;
let adminToken: string;
let catalogToken: string;
let limitedToken: string;
/** Categoría creada por la suite para no mutar las categorías base. */
let tempCategoryId: string;

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
  catalogToken = await login('catalog@test.local');
  limitedToken = await login('limited@test.local');

  // Un producto en "General" para que `productCount` se verifique con valor real.
  const created = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      sku: 'SKU-CATCOUNT',
      name: 'Producto para contar',
      categoryId: ctx.baseCategory.id,
      purchasePrice: 10,
      salePrice: 20,
      unit: 'pza',
    });
  expect(created.status).toBe(201);
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

describe('GET /api/v1/categories — RBAC y listado', () => {
  it('devuelve 401 sin token y 403 sin categories.read', async () => {
    const noAuth = await request(app).get('/api/v1/categories');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('MISSING_TOKEN');

    const forbidden = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('lista solo categorías de la empresa con productCount y sin datos ajenos', async () => {
    // RBAC positivo: el rol catálogo sí tiene categories.read
    const res = await request(app)
      .get('/api/v1/categories?limit=100')
      .set('Authorization', `Bearer ${catalogToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      id: string;
      companyId: string;
      name: string;
      isActive: boolean;
      productCount: number;
    }>;
    expect(items.length).toBeGreaterThanOrEqual(2); // General + Obsoleta
    expect(JSON.stringify(res.body)).not.toContain('Ajena');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    for (const category of items) {
      expect(category.companyId).toBe(ctx.company.id);
      expect(category.productCount).toEqual(expect.any(Number));
    }
    const general = items.find((c) => c.name === 'General');
    expect(general?.isActive).toBe(true);
    expect(general?.productCount).toBeGreaterThanOrEqual(1); // producto base de la suite
    expect(res.body.data.meta.total).toBe(items.length);
  });

  it('filtra por estado', async () => {
    const res = await request(app)
      .get('/api/v1/categories?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{ name: string; isActive: boolean }>;
    expect(items.some((c) => c.name === 'Obsoleta')).toBe(true);
    expect(items.every((c) => c.isActive === false)).toBe(true);
  });

  it('busca por nombre o descripción sin permitir inyección de regex', async () => {
    const res = await request(app)
      .get('/api/v1/categories?search=Obsoleta')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const names = (res.body.data.items as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain('Obsoleta');
    expect(names).not.toContain('General');

    const hostile = await request(app)
      .get(`/api/v1/categories?search=${encodeURIComponent('(((')}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hostile.status).toBe(200);
  });

  it('pagina de forma consistente y rechaza parámetros no permitidos (400)', async () => {
    const all = await request(app)
      .get('/api/v1/categories?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const total = all.body.data.meta.total as number;

    const page = await request(app)
      .get('/api/v1/categories?page=2&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page.status).toBe(200);
    expect(page.body.data.meta).toEqual({
      page: 2,
      limit: 1,
      total,
      totalPages: total,
    });

    const sort = await request(app)
      .get('/api/v1/categories?sort=passwordHash')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sort.status).toBe(400);

    const limit = await request(app)
      .get('/api/v1/categories?limit=5000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(limit.status).toBe(400);
  });
});

describe('GET /api/v1/categories/:id', () => {
  it('devuelve la categoría con su productCount', async () => {
    const res = await request(app)
      .get(`/api/v1/categories/${ctx.baseCategory.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('General');
    expect(res.body.data.productCount).toBeGreaterThanOrEqual(1);
  });

  it('aislamiento y validación: otra empresa → 404, id inválido → 400, inexistente → 404', async () => {
    const foreign = await request(app)
      .get(`/api/v1/categories/${ctx.otherCompanyCategory.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');

    const invalid = await request(app)
      .get('/api/v1/categories/mala')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .get(`/api/v1/categories/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/v1/categories — creación', () => {
  it('crea una categoría válida', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '  Electrónica  ', description: 'Aparatos' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Electrónica'); // recortado
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.productCount).toBe(0);
    expect(res.body.data.companyId).toBe(ctx.company.id);
    tempCategoryId = res.body.data.id as string;
  });

  it('rechaza el nombre duplicado dentro de la empresa (409 NAME_IN_USE)', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Electrónica' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_IN_USE');
  });

  it('valida la entrada y exige categories.write', async () => {
    const invalid = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'x' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details.length).toBeGreaterThan(0);

    const forbidden = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'Sin permiso' });
    expect(forbidden.status).toBe(403);

    const noAuth = await request(app)
      .post('/api/v1/categories')
      .send({ name: 'Sin token' });
    expect(noAuth.status).toBe(401);
  });
});

describe('PATCH /api/v1/categories/:id — edición y estado', () => {
  it('actualiza nombre, descripción y estado', async () => {
    expect(tempCategoryId).toEqual(expect.any(String));

    const renamed = await request(app)
      .patch(`/api/v1/categories/${tempCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Electrónica y Hogar', description: 'Actualizada' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('Electrónica y Hogar');
    expect(renamed.body.data.description).toBe('Actualizada');

    const disabled = await request(app)
      .patch(`/api/v1/categories/${tempCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.isActive).toBe(false);

    // El filtro por estado refleja el cambio
    const filtered = await request(app)
      .get('/api/v1/categories?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const names = (filtered.body.data.items as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain('Electrónica y Hogar');

    // Reactivar para no afectar a otros módulos
    await request(app)
      .patch(`/api/v1/categories/${tempCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
  });

  it('valida cuerpo, duplicados, permisos y alcance', async () => {
    const empty = await request(app)
      .patch(`/api/v1/categories/${tempCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const duplicate = await request(app)
      .patch(`/api/v1/categories/${tempCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'General' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('NAME_IN_USE');

    // Renombrarse a sí misma no es duplicado
    const sameName = await request(app)
      .patch(`/api/v1/categories/${tempCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Electrónica y Hogar' });
    expect(sameName.status).toBe(200);

    const forbidden = await request(app)
      .patch(`/api/v1/categories/${tempCategoryId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'Hackeada' });
    expect(forbidden.status).toBe(403);

    const crossTenant = await request(app)
      .patch(`/api/v1/categories/${ctx.otherCompanyCategory.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fuera' });
    expect(crossTenant.status).toBe(404);
  });
});
