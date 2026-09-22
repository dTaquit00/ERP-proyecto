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
import {
  InventoryMovementModel,
  StockBalanceModel,
} from '../../apps/api/src/modules/inventory/inventory.model.js';

let ctx: TestContext;
let app: Express;
let adminToken: string;
let stockToken: string;
let limitedToken: string;
let centralId: string;
let norteId: string;
let cerradoId: string;
let productId: string;
/** Registro de OTRA empresa (aislamiento de stock y movimientos). */
let foreignBalanceId: string;
let foreignMovementId: string;
/** Primer movimiento IN de la suite (detalles e inmutabilidad). */
let firstMovementId: string;

async function login(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

/** Cantidad actual de un (almacén, producto) leyendo el listado oficial. */
async function stockQuantity(
  token: string,
  warehouseId: string,
  prodId = productId,
): Promise<number | null> {
  const res = await request(app)
    .get(`/api/v1/inventory/stock?warehouseId=${warehouseId}&productId=${prodId}&limit=100`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return (res.body.data.items as Array<{ quantity: number }>)[0]?.quantity ?? null;
}

function move(token: string, body: Record<string, unknown>) {
  return request(app)
    .post('/api/v1/inventory/movements')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

beforeAll(async () => {
  ctx = await setupTestContext();
  app = ctx.app;
  adminToken = await login('admin@test.local');
  stockToken = await login('stock@test.local');
  limitedToken = await login('limited@test.local');

  centralId = (await WarehouseModel.create({
    companyId: ctx.company.id,
    name: 'Central',
    isActive: true,
  })).id;
  norteId = (await WarehouseModel.create({
    companyId: ctx.company.id,
    name: 'Norte',
    isActive: true,
  })).id;
  cerradoId = (await WarehouseModel.create({
    companyId: ctx.company.id,
    name: 'Cerrado',
    isActive: false,
  })).id;

  const product = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      sku: 'SKU-INV-01',
      name: 'Producto Inventario',
      categoryId: ctx.baseCategory.id,
      purchasePrice: 10,
      salePrice: 20,
      unit: 'pza',
    });
  expect(product.status).toBe(201);
  productId = product.body.data.id as string;

  // Registros de OTRA empresa para probar el aislamiento (404).
  const foreignWarehouse = await WarehouseModel.create({
    companyId: ctx.otherCompany.id,
    name: 'Extranjero',
    isActive: true,
  });
  const foreignBalance = await StockBalanceModel.create({
    companyId: ctx.otherCompany.id,
    warehouseId: foreignWarehouse.id,
    productId: new Types.ObjectId(),
    quantity: 9,
    minStock: 0,
  });
  foreignBalanceId = foreignBalance.id;
  const foreignMovement = await InventoryMovementModel.create({
    companyId: ctx.otherCompany.id,
    type: 'IN',
    warehouseId: foreignWarehouse.id,
    warehouseName: 'Extranjero',
    productId: new Types.ObjectId(),
    productName: 'Ajeno',
    productSku: 'SKU-F',
    quantity: 5,
    quantityAfter: 5,
    userId: new Types.ObjectId(),
    userName: 'Bob Otro',
  });
  foreignMovementId = foreignMovement.id;
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

describe('GET /inventory/stock y /inventory/movements — RBAC', () => {
  it('devuelve 401 sin token y 403 sin inventory.read', async () => {
    const noAuthStock = await request(app).get('/api/v1/inventory/stock');
    expect(noAuthStock.status).toBe(401);
    expect(noAuthStock.body.error.code).toBe('MISSING_TOKEN');

    const forbiddenStock = await request(app)
      .get('/api/v1/inventory/stock')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbiddenStock.status).toBe(403);
    expect(forbiddenStock.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

    const noAuthMovements = await request(app).get('/api/v1/inventory/movements');
    expect(noAuthMovements.status).toBe(401);

    const forbiddenMovements = await request(app)
      .get('/api/v1/inventory/movements')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbiddenMovements.status).toBe(403);
  });

  it('listados iniciales aislados con rol almacenero (RBAC positivo)', async () => {
    const stock = await request(app)
      .get('/api/v1/inventory/stock?limit=100')
      .set('Authorization', `Bearer ${stockToken}`);
    expect(stock.status).toBe(200);
    expect(stock.body.data.meta.total).toBe(0); // la existencia ajena no aparece
    expect(JSON.stringify(stock.body)).not.toContain('Extranjero');
    expect(JSON.stringify(stock.body)).not.toContain('passwordHash');

    const movements = await request(app)
      .get('/api/v1/inventory/movements?limit=100')
      .set('Authorization', `Bearer ${stockToken}`);
    expect(movements.status).toBe(200);
    expect(movements.body.data.meta.total).toBe(0);
    expect(JSON.stringify(movements.body)).not.toContain('Bob Otro');
  });
});

describe('POST /inventory/movements — entrada, salidas y recuentos', () => {
  it('IN crea movimiento con stock resultante y actualiza la existencia', async () => {
    const res = await move(adminToken, {
      type: 'IN',
      warehouseId: centralId,
      productId,
      quantity: 7,
      reason: 'Reposición inicial',
      documentRef: 'PURCHASE:001',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('IN');
    expect(res.body.data.quantity).toBe(7);
    expect(res.body.data.quantityAfter).toBe(7);
    expect(res.body.data.warehouseName).toBe('Central');
    expect(res.body.data.productName).toBe('Producto Inventario');
    expect(res.body.data.productSku).toBe('SKU-INV-01');
    expect(res.body.data.userName).toBe('Ada Admin');
    expect(res.body.data.reason).toBe('Reposición inicial');
    expect(res.body.data.toWarehouseId).toBeNull();
    firstMovementId = res.body.data.id as string;

    expect(await stockQuantity(adminToken, centralId)).toBe(7);

    const filtered = await request(app)
      .get('/api/v1/inventory/movements?type=IN&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filtered.status).toBe(200);
    const ids = (filtered.body.data.items as Array<{ id: string }>).map((m) => m.id);
    expect(ids).toContain(firstMovementId);
  });

  it('suma IN con inventory.write (RBAC positivo) y registra el resultado', async () => {
    const res = await move(stockToken, {
      type: 'IN',
      warehouseId: centralId,
      productId,
      quantity: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.quantityAfter).toBe(10);
    expect(res.body.data.userName).toBe('Santi Stock');
    expect(await stockQuantity(adminToken, centralId)).toBe(10);
  });

  it('OUT sin existencias suficientes → 409 INSUFFICIENT_STOCK y no cambia el stock', async () => {
    const res = await move(adminToken, {
      type: 'OUT',
      warehouseId: centralId,
      productId,
      quantity: 100,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await stockQuantity(adminToken, centralId)).toBe(10);
  });

  it('OUT válido descuenta y refleja el stock resultante', async () => {
    const res = await move(adminToken, {
      type: 'OUT',
      warehouseId: centralId,
      productId,
      quantity: 4,
      reason: 'Venta mostrador',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.quantityAfter).toBe(6);
    expect(await stockQuantity(adminToken, centralId)).toBe(6);
  });

  it('RETURN devuelve mercancía al almacén', async () => {
    const res = await move(adminToken, {
      type: 'RETURN',
      warehouseId: centralId,
      productId,
      quantity: 2,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.quantityAfter).toBe(8);
    expect(await stockQuantity(adminToken, centralId)).toBe(8);
  });

  it('ADJUSTMENT fija el recuento absoluto (admite 0)', async () => {
    const zero = await move(adminToken, {
      type: 'ADJUSTMENT',
      warehouseId: centralId,
      productId,
      quantity: 0,
      reason: 'Reconteo: vacío',
    });
    expect(zero.status).toBe(201);
    expect(zero.body.data.quantityAfter).toBe(0);
    expect(await stockQuantity(adminToken, centralId)).toBe(0);

    const recount = await move(adminToken, {
      type: 'ADJUSTMENT',
      warehouseId: centralId,
      productId,
      quantity: 5,
      reason: 'Reconteo físico',
    });
    expect(recount.status).toBe(201);
    expect(recount.body.data.quantityAfter).toBe(5);
    expect(await stockQuantity(adminToken, centralId)).toBe(5);
  });
});

describe('POST /inventory/movements — transferencias (inventory.transfer)', () => {
  it('sin inventory.transfer → 403 INSUFFICIENT_PERMISSIONS', async () => {
    const res = await move(stockToken, {
      type: 'TRANSFER',
      warehouseId: centralId,
      toWarehouseId: norteId,
      productId,
      quantity: 1,
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(await stockQuantity(adminToken, centralId)).toBe(5);
  });

  it('con inventory.transfer mueve stock entre almacenes', async () => {
    const res = await move(adminToken, {
      type: 'TRANSFER',
      warehouseId: centralId,
      toWarehouseId: norteId,
      productId,
      quantity: 2,
      reason: 'Reposición sucursal',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('TRANSFER');
    expect(res.body.data.toWarehouseId).toBe(norteId);
    expect(res.body.data.toWarehouseName).toBe('Norte');
    expect(res.body.data.quantityAfter).toBe(3); // origen tras restar
    expect(await stockQuantity(adminToken, centralId)).toBe(3);
    expect(await stockQuantity(adminToken, norteId)).toBe(2);
  });

  it('almacén desactivado: bloquea OUT/TRANSFER pero admite ADJUSTMENT', async () => {
    const out = await move(adminToken, {
      type: 'OUT',
      warehouseId: cerradoId,
      productId,
      quantity: 1,
    });
    expect(out.status).toBe(409);
    expect(out.body.error.code).toBe('WAREHOUSE_DISABLED');

    const toDisabled = await move(adminToken, {
      type: 'TRANSFER',
      warehouseId: centralId,
      toWarehouseId: cerradoId,
      productId,
      quantity: 1,
    });
    expect(toDisabled.status).toBe(409);
    expect(toDisabled.body.error.code).toBe('WAREHOUSE_DISABLED');
    expect(await stockQuantity(adminToken, centralId)).toBe(3);

    const adjustment = await move(adminToken, {
      type: 'ADJUSTMENT',
      warehouseId: cerradoId,
      productId,
      quantity: 0,
      reason: 'Cierre de almacén',
    });
    expect(adjustment.status).toBe(201);
    expect(adjustment.body.data.quantityAfter).toBe(0);
    expect(await stockQuantity(adminToken, cerradoId)).toBe(0);
  });
});

describe('POST /inventory/movements — validaciones y referencias', () => {
  it('valida cantidad por tipo, enum y presencia/ausencia de destino', async () => {
    const zeroIn = await move(adminToken, {
      type: 'IN',
      warehouseId: centralId,
      productId,
      quantity: 0,
    });
    expect(zeroIn.status).toBe(400);
    expect(zeroIn.body.error.code).toBe('VALIDATION_ERROR');

    const badType = await move(adminToken, {
      type: 'FLY',
      warehouseId: centralId,
      productId,
      quantity: 1,
    });
    expect(badType.status).toBe(400);

    const inWithDest = await move(adminToken, {
      type: 'IN',
      warehouseId: centralId,
      toWarehouseId: norteId,
      productId,
      quantity: 1,
    });
    expect(inWithDest.status).toBe(400);

    const transferWithoutDest = await move(adminToken, {
      type: 'TRANSFER',
      warehouseId: centralId,
      productId,
      quantity: 1,
    });
    expect(transferWithoutDest.status).toBe(400);

    const sameWarehouse = await move(adminToken, {
      type: 'TRANSFER',
      warehouseId: centralId,
      toWarehouseId: centralId,
      productId,
      quantity: 1,
    });
    expect(sameWarehouse.status).toBe(400);
    expect(sameWarehouse.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('referencias: almacén/producto ajeno o inexistente → 400 con código propio', async () => {
    const foreignWarehouse = await move(adminToken, {
      type: 'IN',
      warehouseId: (await WarehouseModel.findOne({ companyId: ctx.otherCompany.id }))!.id,
      productId,
      quantity: 1,
    });
    expect(foreignWarehouse.status).toBe(400);
    expect(foreignWarehouse.body.error.code).toBe('WAREHOUSE_NOT_FOUND');

    const missingWarehouse = await move(adminToken, {
      type: 'IN',
      warehouseId: new Types.ObjectId().toString(),
      productId,
      quantity: 1,
    });
    expect(missingWarehouse.status).toBe(400);
    expect(missingWarehouse.body.error.code).toBe('WAREHOUSE_NOT_FOUND');

    const missingProduct = await move(adminToken, {
      type: 'IN',
      warehouseId: centralId,
      productId: new Types.ObjectId().toString(),
      quantity: 1,
    });
    expect(missingProduct.status).toBe(400);
    expect(missingProduct.body.error.code).toBe('PRODUCT_NOT_FOUND');

    const foreignProduct = await move(adminToken, {
      type: 'IN',
      warehouseId: centralId,
      productId: new Types.ObjectId().toString(), // producto inexistente = misma rama de validación
      quantity: 1,
    });
    expect(foreignProduct.status).toBe(400);
    expect(foreignProduct.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('listados de inventario — filtros, paginación y mínimos', () => {
  it('filtra movimientos por tipo/almacén y valida sort/limit', async () => {
    const byType = await request(app)
      .get('/api/v1/inventory/movements?type=TRANSFER&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byType.status).toBe(200);
    const typed = byType.body.data.items as Array<{ type: string }>;
    expect(typed.length).toBeGreaterThanOrEqual(1);
    expect(typed.every((m) => m.type === 'TRANSFER')).toBe(true);

    const byWarehouse = await request(app)
      .get(`/api/v1/inventory/movements?warehouseId=${centralId}&limit=100`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byWarehouse.status).toBe(200);
    expect(byWarehouse.body.data.meta.total).toBeGreaterThanOrEqual(5); // IN×2, OUT, RETURN, ADJ×2, TRANSFER

    const sort = await request(app)
      .get('/api/v1/inventory/movements?sort=productId')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sort.status).toBe(400);

    const limit = await request(app)
      .get('/api/v1/inventory/stock?limit=5000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(limit.status).toBe(400);
  });

  it('minStock con inventory.write y filtros availability (low / out_of_stock / in_stock)', async () => {
    const centralBalance = await request(app)
      .get(`/api/v1/inventory/stock?warehouseId=${centralId}&productId=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const balanceId = (centralBalance.body.data.items as Array<{ id: string }>)[0]?.id as string;
    expect(balanceId).toEqual(expect.any(String));

    // stockUser tiene inventory.write → RBAC positivo; lowStock se deriva en backend.
    const patched = await request(app)
      .patch(`/api/v1/inventory/stock/${balanceId}`)
      .set('Authorization', `Bearer ${stockToken}`)
      .send({ minStock: 20 });
    expect(patched.status).toBe(200);
    expect(patched.body.data.minStock).toBe(20);
    expect(patched.body.data.quantity).toBe(3);
    expect(patched.body.data.lowStock).toBe(true);

    const forbidden = await request(app)
      .patch(`/api/v1/inventory/stock/${balanceId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ minStock: 1 });
    expect(forbidden.status).toBe(403);

    const invalid = await request(app)
      .patch(`/api/v1/inventory/stock/${balanceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minStock: -1 });
    expect(invalid.status).toBe(400);

    const low = await request(app)
      .get('/api/v1/inventory/stock?availability=low&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(low.status).toBe(200);
    const lowIds = (low.body.data.items as Array<{ id: string }>).map((b) => b.id);
    expect(lowIds).toContain(balanceId);

    const out = await request(app)
      .get('/api/v1/inventory/stock?availability=out_of_stock&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(out.status).toBe(200);
    const outWarehouses = (out.body.data.items as Array<{ warehouseName: string }>).map(
      (b) => b.warehouseName,
    );
    expect(outWarehouses).toContain('Cerrado'); // recuento a 0
    expect(outWarehouses).not.toContain('Central'); // quantity 3 > 0

    const inStock = await request(app)
      .get('/api/v1/inventory/stock?availability=in_stock&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(inStock.status).toBe(200);
    expect(
      (inStock.body.data.items as Array<{ warehouseName: string }>).map((b) => b.warehouseName),
    ).toEqual(expect.arrayContaining(['Central', 'Norte']));
  });
});

describe('detalle e inmutabilidad', () => {
  it('GET /inventory/stock/:id — 404 inexistente o ajeno y 400 id inválido', async () => {
    const missing = await request(app)
      .get(`/api/v1/inventory/stock/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404); // inexistente

    const invalid = await request(app)
      .get('/api/v1/inventory/stock/no-id')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);

    const foreign = await request(app)
      .get(`/api/v1/inventory/stock/${foreignBalanceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(foreign.status).toBe(404);
  });

  it('GET /inventory/movements/:id — detalle propio y aislamiento', async () => {
    const own = await request(app)
      .get(`/api/v1/inventory/movements/${firstMovementId}`)
      .set('Authorization', `Bearer ${stockToken}`);
    expect(own.status).toBe(200);
    expect(own.body.data.quantityAfter).toBe(7);
    expect(own.body.data.documentRef).toBe('PURCHASE:001');

    const foreign = await request(app)
      .get(`/api/v1/inventory/movements/${foreignMovementId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(foreign.status).toBe(404);

    const noAuth = await request(app).get(`/api/v1/inventory/movements/${firstMovementId}`);
    expect(noAuth.status).toBe(401);
  });

  it('los movimientos no tienen rutas de edición/borrado (documento inmutable)', async () => {
    const patch = await request(app)
      .patch(`/api/v1/inventory/movements/${firstMovementId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 999 });
    expect(patch.status).toBe(404);

    const del = await request(app)
      .delete(`/api/v1/inventory/movements/${firstMovementId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(404);

    const stillOriginal = await request(app)
      .get(`/api/v1/inventory/movements/${firstMovementId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stillOriginal.body.data.quantityAfter).toBe(7);
  });
});
