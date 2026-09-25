import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  setupTestContext,
  teardownTestContext,
  TEST_PASSWORD,
  type TestContext,
} from '../helpers/integration.js';

let ctx: TestContext;
let app: Express;
let token: string;
let productId: string;
let warehouseId: string;
let purchaseId: string;

async function login(): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.local', password: TEST_PASSWORD });
  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
}

beforeAll(async () => {
  ctx = await setupTestContext();
  app = ctx.app;
  token = await login();

  const supplier = await request(app).post('/api/v1/suppliers').set('Authorization', `Bearer ${token}`).send({ name: 'Proveedor Compras' });
  expect(supplier.status).toBe(201);
  const warehouse = await request(app).post('/api/v1/warehouses').set('Authorization', `Bearer ${token}`).send({ name: 'Almacén Compras' });
  expect(warehouse.status).toBe(201);
  warehouseId = warehouse.body.data.id as string;
  const product = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({
    sku: 'PURCHASE-001', name: 'Producto Comprado', categoryId: ctx.baseCategory.id,
    purchasePrice: 10, salePrice: 15, unit: 'pza',
  });
  expect(product.status).toBe(201);
  productId = product.body.data.id as string;

  const created = await request(app).post('/api/v1/purchases').set('Authorization', `Bearer ${token}`).send({
    supplierId: supplier.body.data.id,
    warehouseId,
    items: [{ productId, quantity: 10, unitCost: 10, taxes: [] }],
  });
  expect(created.status).toBe(201);
  purchaseId = created.body.data.id as string;
});

afterAll(async () => teardownTestContext(ctx));

describe('M13 Compras', () => {
  it('confirma y recibe parcialmente hasta completar inventario', async () => {
    const confirmed = await request(app).post(`/api/v1/purchases/${purchaseId}/confirm`).set('Authorization', `Bearer ${token}`);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('confirmed');

    const partial = await request(app).post(`/api/v1/purchases/${purchaseId}/receive`).set('Authorization', `Bearer ${token}`).send({ items: [{ productId, quantity: 4 }] });
    expect(partial.status).toBe(200);
    expect(partial.body.data.status).toBe('partially_received');
    expect(partial.body.data.items[0].receivedQuantity).toBe(4);

    const complete = await request(app).post(`/api/v1/purchases/${purchaseId}/receive`).set('Authorization', `Bearer ${token}`).send({ items: [{ productId, quantity: 6 }] });
    expect(complete.status).toBe(200);
    expect(complete.body.data.status).toBe('received');
    expect(complete.body.data.items[0].receivedQuantity).toBe(10);

    const stock = await request(app).get(`/api/v1/warehouses/${warehouseId}/inventory`).set('Authorization', `Bearer ${token}`);
    expect(stock.status).toBe(200);
    expect(stock.body.data.items.find((item: { productId: string }) => item.productId === productId).quantity).toBe(10);
  });

  it('rechaza recibir más de lo comprado y registra devolución', async () => {
    const exceeded = await request(app).post(`/api/v1/purchases/${purchaseId}/receive`).set('Authorization', `Bearer ${token}`).send({ items: [{ productId, quantity: 1 }] });
    expect(exceeded.status).toBe(409);
    expect(exceeded.body.error.code).toBe('INVALID_PURCHASE_STATE');

    const returned = await request(app).post(`/api/v1/purchases/${purchaseId}/return`).set('Authorization', `Bearer ${token}`);
    expect(returned.status).toBe(200);
    expect(returned.body.data.status).toBe('returned');
  });
});
