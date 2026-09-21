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
import { ProductModel } from '../../apps/api/src/modules/products/products.model.js';

let ctx: TestContext;
let app: Express;
let adminToken: string;
let catalogToken: string;
let limitedToken: string;
/** Producto creado por la suite para pruebas de edición. */
let tempProductId: string;
/** Producto de OTRA empresa creado directamente (aislamiento). */
let foreignProductId: string;

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

  // Dos productos base: uno activo y otro desactivado (para filtros de estado).
  await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      sku: 'SKU-BASE',
      name: 'Producto Base',
      description: 'Pruebas de listado',
      categoryId: ctx.baseCategory.id,
      purchasePrice: 100,
      salePrice: 150,
      unit: 'pza',
    })
    .expect(201);

  const hidden = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      sku: 'SKU-OCULTO',
      name: 'Producto Oculto',
      categoryId: ctx.baseCategory.id,
      purchasePrice: 50,
      salePrice: 80,
      unit: 'pza',
      isActive: false,
    });
  expect(hidden.status).toBe(201);

  // Producto perteneciente a otra empresa (directamente en BD).
  const foreign = await ProductModel.create({
    companyId: ctx.otherCompany.id,
    sku: 'FOREIGN-1',
    name: 'Producto Ajeno',
    categoryId: ctx.otherCompanyCategory.id,
    purchasePrice: 1,
    salePrice: 2,
    unit: 'pza',
  });
  foreignProductId = foreign.id;
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

describe('GET /api/v1/products — RBAC y listado', () => {
  it('devuelve 401 sin token y 403 sin products.read', async () => {
    const noAuth = await request(app).get('/api/v1/products');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('MISSING_TOKEN');

    const forbidden = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('lista solo productos de la empresa con categoryName y sin datos sensibles', async () => {
    const res = await request(app)
      .get('/api/v1/products?limit=100')
      .set('Authorization', `Bearer ${catalogToken}`); // RBAC positivo: products.read

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      id: string;
      companyId: string;
      sku: string;
      categoryName: string;
      isActive: boolean;
      taxes: unknown[];
    }>;
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(res.body)).not.toContain('FOREIGN-1');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('tokenHash');
    for (const product of items) {
      expect(product.companyId).toBe(ctx.company.id);
      expect(product.categoryName).toBe('General');
      expect(Array.isArray(product.taxes)).toBe(true);
    }
  });

  it('pagina de forma consistente (meta calculada en backend)', async () => {
    const all = await request(app)
      .get('/api/v1/products?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const total = all.body.data.meta.total as number;
    expect(total).toBeGreaterThanOrEqual(2);

    const page = await request(app)
      .get('/api/v1/products?page=2&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page.status).toBe(200);
    expect(page.body.data.meta).toEqual({ page: 2, limit: 1, total, totalPages: total });
    expect(page.body.data.items.length).toBeLessThanOrEqual(1);
  });

  it('busca por nombre o SKU y sobrevive a regex hostiles', async () => {
    const res = await request(app)
      .get('/api/v1/products?search=SKU-BASE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const skus = (res.body.data.items as Array<{ sku: string }>).map((p) => p.sku);
    expect(skus).toContain('SKU-BASE');
    expect(skus).not.toContain('SKU-OCULTO');

    const hostile = await request(app)
      .get(`/api/v1/products?search=${encodeURIComponent('[[')}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hostile.status).toBe(200);
  });

  it('filtra por categoría y estado, y valida sort/limit', async () => {
    const byCategory = await request(app)
      .get(`/api/v1/products?categoryId=${ctx.baseCategory.id}&limit=100`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byCategory.status).toBe(200);
    for (const product of byCategory.body.data.items as Array<{ categoryId: string }>) {
      expect(product.categoryId).toBe(ctx.baseCategory.id);
    }

    const inactive = await request(app)
      .get('/api/v1/products?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(inactive.status).toBe(200);
    const inactiveItems = inactive.body.data.items as Array<{ sku: string; isActive: boolean }>;
    expect(inactiveItems.some((p) => p.sku === 'SKU-OCULTO')).toBe(true);
    expect(inactiveItems.every((p) => p.isActive === false)).toBe(true);

    const sort = await request(app)
      .get('/api/v1/products?sort=passwordHash')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sort.status).toBe(400);

    const limit = await request(app)
      .get('/api/v1/products?limit=5000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(limit.status).toBe(400);
  });
});

describe('GET /api/v1/products/:id', () => {
  it('devuelve el producto con sus impuestos y precios', async () => {
    const res = await request(app)
      .get('/api/v1/products?search=SKU-BASE&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    const id = (res.body.data.items as Array<{ id: string }>)[0]?.id as string;

    const detail = await request(app)
      .get(`/api/v1/products/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.sku).toBe('SKU-BASE');
    expect(detail.body.data.purchasePrice).toBe(100);
    expect(detail.body.data.salePrice).toBe(150);
    expect(detail.body.data.categoryName).toBe('General');
  });

  it('aislamiento y validación: otra empresa → 404, id inválido → 400, inexistente → 404', async () => {
    const foreign = await request(app)
      .get(`/api/v1/products/${foreignProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');

    const invalid = await request(app)
      .get('/api/v1/products/malo')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .get(`/api/v1/products/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/v1/products — creación', () => {
  it('crea un producto normalizando el SKU en mayúsculas', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'REF-9',
        sku: 'nuevo-sku-01',
        name: ' Monitor 24"',
        categoryId: ctx.baseCategory.id,
        purchasePrice: 1200.5,
        salePrice: 1800,
        taxes: [{ name: 'IVA', rate: 16 }],
        unit: 'pza',
        barcode: '7501234567890',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.sku).toBe('NUEVO-SKU-01'); // normalizado
    expect(res.body.data.name).toBe('Monitor 24"');
    expect(res.body.data.categoryName).toBe('General');
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.taxes).toEqual([{ name: 'IVA', rate: 16 }]);
    expect(res.body.data.companyId).toBe(ctx.company.id);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    tempProductId = res.body.data.id as string;
  });

  it('rechaza SKU duplicado dentro de la empresa (409 SKU_IN_USE)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'nuevo-sku-01', // repetido con distinta caja: normalización lo detecta
        name: 'Duplicado',
        categoryId: ctx.baseCategory.id,
        purchasePrice: 1,
        salePrice: 2,
        unit: 'pza',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SKU_IN_USE');
  });

  it('rechaza categoría de otra empresa o inexistente (400 CATEGORY_NOT_FOUND)', async () => {
    const foreignCategory = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'SKU-X-1',
        name: 'Con categoría ajena',
        categoryId: ctx.otherCompanyCategory.id,
        purchasePrice: 1,
        salePrice: 2,
        unit: 'pza',
      });
    expect(foreignCategory.status).toBe(400);
    expect(foreignCategory.body.error.code).toBe('CATEGORY_NOT_FOUND');

    const missingCategory = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'SKU-X-2',
        name: 'Con categoría inexistente',
        categoryId: new Types.ObjectId().toString(),
        purchasePrice: 1,
        salePrice: 2,
        unit: 'pza',
      });
    expect(missingCategory.status).toBe(400);
    expect(missingCategory.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('valida precios, impuestos, unidad y SKU', async () => {
    const base = {
      sku: 'SKU-BAD',
      name: 'Producto malo',
      categoryId: ctx.baseCategory.id,
      purchasePrice: 10,
      salePrice: 20,
      unit: 'pza',
    };

    const negativePrice = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, purchasePrice: -1 });
    expect(negativePrice.status).toBe(400);
    expect(negativePrice.body.error.code).toBe('VALIDATION_ERROR');

    const badTax = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, taxes: [{ name: 'IVA', rate: 101 }] });
    expect(badTax.status).toBe(400);

    const emptyUnit = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, unit: '' });
    expect(emptyUnit.status).toBe(400);

    const badSku = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, sku: 'SKU con espacios' });
    expect(badSku.status).toBe(400);
    expect(badSku.body.error.details.length).toBeGreaterThan(0);
  });

  it('exige products.write (403) y token (401)', async () => {
    const forbidden = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${catalogToken}`) // catálogo tiene products.read pero NO write
      .send({
        sku: 'SKU-403',
        name: 'Sin permiso',
        categoryId: ctx.baseCategory.id,
        purchasePrice: 1,
        salePrice: 2,
        unit: 'pza',
      });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

    const noAuth = await request(app)
      .post('/api/v1/products')
      .send({ sku: 'SKU-401', name: 'Sin token', categoryId: ctx.baseCategory.id });
    expect(noAuth.status).toBe(401);
  });
});

describe('PATCH /api/v1/products/:id — edición y estado', () => {
  it('actualiza nombre, precios, impuestos y estado', async () => {
    expect(tempProductId).toEqual(expect.any(String));

    const updated = await request(app)
      .patch(`/api/v1/products/${tempProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Monitor 27"',
        salePrice: 2000,
        taxes: [
          { name: 'IVA', rate: 16 },
          { name: 'IEPS', rate: 5 },
        ],
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Monitor 27"');
    expect(updated.body.data.salePrice).toBe(2000);
    expect(updated.body.data.taxes).toHaveLength(2);

    const disabled = await request(app)
      .patch(`/api/v1/products/${tempProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.isActive).toBe(false);

    const filtered = await request(app)
      .get('/api/v1/products?status=inactive&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const skus = (filtered.body.data.items as Array<{ sku: string }>).map((p) => p.sku);
    expect(skus).toContain('NUEVO-SKU-01');
  });

  it('valida cuerpo, duplicados de SKU, categoría ajena, permisos y alcance', async () => {
    const empty = await request(app)
      .patch(`/api/v1/products/${tempProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const duplicateSku = await request(app)
      .patch(`/api/v1/products/${tempProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sku: 'SKU-BASE' });
    expect(duplicateSku.status).toBe(409);
    expect(duplicateSku.body.error.code).toBe('SKU_IN_USE');

    const foreignCategory = await request(app)
      .patch(`/api/v1/products/${tempProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: ctx.otherCompanyCategory.id });
    expect(foreignCategory.status).toBe(400);
    expect(foreignCategory.body.error.code).toBe('CATEGORY_NOT_FOUND');

    const forbidden = await request(app)
      .patch(`/api/v1/products/${tempProductId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ name: 'Hackeado' });
    expect(forbidden.status).toBe(403);

    const crossTenant = await request(app)
      .patch(`/api/v1/products/${foreignProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fuera' });
    expect(crossTenant.status).toBe(404);
  });
});
