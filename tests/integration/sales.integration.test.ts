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
import { CustomerModel } from '../../apps/api/src/modules/customers/customers.model.js';
import { RoleModel } from '../../apps/api/src/modules/roles/roles.model.js';
import { UserModel } from '../../apps/api/src/modules/users/users.model.js';
import { SaleModel } from '../../apps/api/src/modules/sales/sales.model.js';
import { hashPassword } from '../../apps/api/src/shared/security/password.js';

let ctx: TestContext;
let app: Express;
let adminToken: string;
/** Rol sistema `vendedor`: sales.read/write/return pero NO sales.cancel. */
let sellerToken: string;
let limitedToken: string;
let foreignAdminToken: string;

// Almacenes
let ventaId: string;
let cerradoId: string;
let tempId: string;
// Clientes
let clienteId: string;
let cliente2Id: string;
let bajaId: string;
let foreignCustomerId: string;
// Productos
let prod1: string;
let prod2: string;
let prod3: string;
let inactiveProdId: string;
let foreignProdId: string;
// Ventas creadas a lo largo de la suite (s1…s8)
let s1: string;
let s2: string;
let s3: string;
let s4: string;
let s5: string;
let s6: string;
let s7: string;
let s8: string;
let foreignSaleId: string;

/** Libro de existencias: P1=10, P2=5, P3=4 al inicio (ver beforeAll). */

async function login(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

function auth(token: string): string {
  return `Bearer ${token}`;
}

function createSale(token: string, body: Record<string, unknown>) {
  return request(app).post('/api/v1/sales').set('Authorization', auth(token)).send(body);
}

function getSale(token: string, id: string) {
  return request(app).get(`/api/v1/sales/${id}`).set('Authorization', auth(token));
}

function transition(token: string, id: string, action: 'confirm' | 'cancel' | 'return') {
  return request(app)
    .post(`/api/v1/sales/${id}/${action}`)
    .set('Authorization', auth(token));
}

async function createProduct(token: string, body: Record<string, unknown>): Promise<string> {
  const res = await request(app)
    .post('/api/v1/products')
    .set('Authorization', auth(token))
    .send(body);
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

/** Existencia actual leyendo el listado oficial de inventario (0 si no existe). */
async function stockQty(warehouseId: string, productId: string): Promise<number> {
  const res = await request(app)
    .get(
      `/api/v1/inventory/stock?warehouseId=${warehouseId}&productId=${productId}&limit=100`,
    )
    .set('Authorization', auth(adminToken));
  expect(res.status).toBe(200);
  return (res.body.data.items as Array<{ quantity: number }>)[0]?.quantity ?? 0;
}

interface MovementView {
  type: string;
  quantity: number;
  reason: string | null;
  documentRef: string | null;
}

/** Movimientos de inventario asociados a un documento (`SALE:<id>`). */
async function movementsByRef(documentRef: string): Promise<MovementView[]> {
  const res = await request(app)
    .get('/api/v1/inventory/movements?limit=100')
    .set('Authorization', auth(adminToken));
  expect(res.status).toBe(200);
  return (res.body.data.items as MovementView[]).filter(
    (movement) => movement.documentRef === documentRef,
  );
}

beforeAll(async () => {
  ctx = await setupTestContext();
  app = ctx.app;
  adminToken = await login('admin@test.local');
  limitedToken = await login('limited@test.local');
  foreignAdminToken = await login('admin@other.local');

  // Vendedor del sistema (sin sales.cancel) para la matriz RBAC de Fase 11.
  const sellerRole = (await RoleModel.findOne({
    companyId: ctx.company.id,
    name: 'vendedor',
  }))!;
  const sellerUser = await UserModel.create({
    companyId: ctx.company.id,
    email: 'seller@test.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Sara',
    lastName: 'Vendedor',
    roleId: sellerRole.id,
    isActive: true,
  });
  expect(sellerUser.id).toBeTruthy();
  sellerToken = await login('seller@test.local');

  // Almacenes: uno activo, uno desactivado y uno temporal (se desactiva tras crear una venta).
  ventaId = (
    await WarehouseModel.create({ companyId: ctx.company.id, name: 'Depósito Venta', isActive: true })
  ).id;
  cerradoId = (
    await WarehouseModel.create({
      companyId: ctx.company.id,
      name: 'Cerrado Venta',
      isActive: false,
    })
  ).id;
  tempId = (
    await WarehouseModel.create({
      companyId: ctx.company.id,
      name: 'Temporal',
      isActive: true,
    })
  ).id;

  // Clientes: dos activos (el segundo con venta propia), uno baja y uno ajeno.
  clienteId = (
    await CustomerModel.create({
      companyId: ctx.company.id,
      name: 'Cliente Mostrador',
      isActive: true,
    })
  ).id;
  cliente2Id = (
    await CustomerModel.create({
      companyId: ctx.company.id,
      name: 'Cliente Alternativo',
      isActive: true,
    })
  ).id;
  bajaId = (
    await CustomerModel.create({
      companyId: ctx.company.id,
      name: 'Cliente Baja',
      isActive: false,
    })
  ).id;
  foreignCustomerId = (
    await CustomerModel.create({
      companyId: ctx.otherCompany.id,
      name: 'Cliente Ajeno',
      isActive: true,
    })
  ).id;

  // Productos por API (P1 con IVA 16%, P2 y P3 sin impuestos).
  prod1 = await createProduct(adminToken, {
    sku: 'SKU-SALE-01',
    name: 'Producto Uno',
    categoryId: ctx.baseCategory.id,
    purchasePrice: 10,
    salePrice: 20,
    unit: 'pza',
    taxes: [{ name: 'IVA', rate: 16 }],
  });
  prod2 = await createProduct(adminToken, {
    sku: 'SKU-SALE-02',
    name: 'Producto Dos',
    categoryId: ctx.baseCategory.id,
    purchasePrice: 3,
    salePrice: 5.5,
    unit: 'pza',
  });
  prod3 = await createProduct(adminToken, {
    sku: 'SKU-SALE-03',
    name: 'Producto Tres',
    categoryId: ctx.baseCategory.id,
    purchasePrice: 25,
    salePrice: 50,
    unit: 'pza',
  });
  const inactiveProduct = await createProduct(adminToken, {
    sku: 'SKU-SALE-INACT',
    name: 'Producto Dado de Baja',
    categoryId: ctx.baseCategory.id,
    purchasePrice: 10,
    salePrice: 20,
    unit: 'pza',
  });
  const patchInactive = await request(app)
    .patch(`/api/v1/products/${inactiveProduct}`)
    .set('Authorization', auth(adminToken))
    .send({ isActive: false });
  expect(patchInactive.status).toBe(200);
  inactiveProdId = inactiveProduct;

  foreignProdId = await createProduct(foreignAdminToken, {
    sku: 'SKU-SALE-F',
    name: 'Producto Ajeno',
    categoryId: ctx.otherCompanyCategory.id,
    purchasePrice: 1,
    salePrice: 5,
    unit: 'pza',
  });

  // Stock inicial en Depósito Venta: P1=10, P2=5, P3=4.
  for (const [productId, quantity] of [
    [prod1, 10],
    [prod2, 5],
    [prod3, 4],
  ] as const) {
    const res = await request(app)
      .post('/api/v1/inventory/movements')
      .set('Authorization', auth(adminToken))
      .send({
        type: 'IN',
        warehouseId: ventaId,
        productId,
        quantity,
        reason: 'Stock inicial',
      });
    expect(res.status).toBe(201);
  }

  // Venta de OTRA empresa (aislamiento en listado y detalle → 404).
  foreignSaleId = (
    await SaleModel.create({
      companyId: ctx.otherCompany.id,
      customerId: new Types.ObjectId(),
      customerName: 'Cliente Ajeno',
      userId: new Types.ObjectId(),
      userName: 'Bob Otro',
      warehouseId: new Types.ObjectId(),
      warehouseName: 'Almacén Ajeno',
      saleDate: new Date('2026-01-10T00:00:00.000Z'),
      status: 'pending',
      items: [
        {
          productId: new Types.ObjectId(),
          productSku: 'SKU-SALE-F',
          productName: 'Producto Ajeno',
          quantity: 1,
          unitPrice: 5,
          discount: 0,
          subtotal: 5,
          discountAmount: 0,
          total: 5,
        },
      ],
      subtotal: 5,
      discountTotal: 0,
      total: 5,
      history: [],
    })
  ).id;
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

describe('POST/GET /sales — RBAC (permisos de ventas)', () => {
  it('devuelve 401 sin token y 403 sin sales.read / sales.write', async () => {
    const noAuth = await request(app).get('/api/v1/sales');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('MISSING_TOKEN');

    const noAuthPost = await request(app).post('/api/v1/sales');
    expect(noAuthPost.status).toBe(401);

    const forbiddenList = await request(app)
      .get('/api/v1/sales')
      .set('Authorization', auth(limitedToken));
    expect(forbiddenList.status).toBe(403);
    expect(forbiddenList.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

    const forbiddenCreate = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', auth(limitedToken))
      .send({ customerId: clienteId, warehouseId: ventaId, items: [] });
    expect(forbiddenCreate.status).toBe(403);
  });

  it('vendedor lista y crea (sales.write) pero NO cancelar (sales.cancel)', async () => {
    const list = await request(app)
      .get('/api/v1/sales?limit=100')
      .set('Authorization', auth(sellerToken));
    expect(list.status).toBe(200);
    expect(list.body.data.meta.total).toBe(0); // la venta ajena no aparece

    const created = await createSale(sellerToken, {
      customerId: clienteId,
      warehouseId: ventaId,
      items: [{ productId: prod3, quantity: 1 }],
    });
    expect(created.status).toBe(201);
    s1 = created.body.data.id as string;
    expect(created.body.data.status).toBe('pending');
    expect(created.body.data.userName).toBe('Sara Vendedor');
    expect(created.body.data.history[0].userName).toBe('Sara Vendedor');
    expect(await stockQty(ventaId, prod3)).toBe(4); // sin efecto en stock

    const cancelForbidden = await transition(sellerToken, s1, 'cancel');
    expect(cancelForbidden.status).toBe(403);
    expect(cancelForbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect((await getSale(sellerToken, s1)).body.data.status).toBe('pending');
  });

  it('vendedor confirma (sales.write) y devuelve (sales.return)', async () => {
    const confirmed = await transition(sellerToken, s1, 'confirm');
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('confirmed');
    expect(await stockQty(ventaId, prod3)).toBe(3); // OUT de 1

    // 403 de cancelar NO altera la venta confirmada.
    expect((await transition(sellerToken, s1, 'cancel')).status).toBe(403);
    expect((await getSale(sellerToken, s1)).body.data.status).toBe('confirmed');

    const returned = await transition(sellerToken, s1, 'return');
    expect(returned.status).toBe(200);
    expect(returned.body.data.status).toBe('returned');
    expect(await stockQty(ventaId, prod3)).toBe(4); // RETURN repone 1
    // Ambos movimientos comparten milisegundo: se compara como conjunto (orden no determinista).
    expect(
      new Set((await movementsByRef(`SALE:${s1}`)).map((m) => m.type)),
    ).toEqual(new Set(['OUT', 'RETURN']));
  });
});

describe('POST /sales — totales calculados por el backend', () => {
  it('ignora precios enviados por el cliente y calcula subtotal, impuestos y total', async () => {
    const res = await createSale(adminToken, {
      customerId: clienteId,
      warehouseId: ventaId,
      notes: 'Venta mostrador',
      items: [
        { productId: prod1, quantity: 3, unitPrice: 999 }, // unitPrice debe ignorarse
        { productId: prod2, quantity: 2 },
      ],
    });
    expect(res.status).toBe(201);
    s2 = res.body.data.id as string;
    const sale = res.body.data;

    expect(sale.status).toBe('pending');
    expect(sale.customerName).toBe('Cliente Mostrador');
    expect(sale.userName).toBe('Ada Admin');
    expect(sale.warehouseName).toBe('Depósito Venta');
    expect(sale.branchId).toBeNull(); // sucursal opcional (Fase 13)
    expect(sale.notes).toBe('Venta mostrador');
    expect(typeof sale.saleDate).toBe('string');

    expect(sale.items[0]).toMatchObject({
      productSku: 'SKU-SALE-01',
      productName: 'Producto Uno',
      quantity: 3,
      unitPrice: 20, // precio de catálogo, NO el 999 enviado
      discount: 0,
      subtotal: 60,
      discountAmount: 0,
      taxes: [{ name: 'IVA', rate: 16, amount: 9.6 }],
      total: 69.6,
    });
    expect(sale.items[1]).toMatchObject({
      unitPrice: 5.5,
      subtotal: 11,
      taxes: [],
      total: 11,
    });

    expect(sale.subtotal).toBe(71);
    expect(sale.discountTotal).toBe(0);
    expect(sale.taxes).toEqual([{ name: 'IVA', rate: 16, amount: 9.6 }]);
    expect(sale.total).toBe(80.6); // 71 + 9.6

    expect(sale.history).toHaveLength(1);
    expect(sale.history[0].action).toBe('created');
    expect(sale.confirmedAt).toBeNull();
    expect(sale.cancelledAt).toBeNull();
    expect(sale.returnedAt).toBeNull();

    // pending no mueve stock.
    expect(await stockQty(ventaId, prod1)).toBe(10);
    expect(await stockQty(ventaId, prod2)).toBe(5);
  });

  it('aplica descuento de línea antes de los impuestos', async () => {
    const res = await createSale(adminToken, {
      customerId: clienteId,
      warehouseId: ventaId,
      items: [{ productId: prod1, quantity: 2, discount: 10 }],
    });
    expect(res.status).toBe(201);
    s3 = res.body.data.id as string;

    expect(res.body.data.items[0]).toMatchObject({
      subtotal: 40,
      discountAmount: 4,
      taxes: [{ name: 'IVA', rate: 16, amount: 5.76 }], // 16% de 36
      total: 41.76,
    });
    expect(res.body.data.subtotal).toBe(40);
    expect(res.body.data.discountTotal).toBe(4);
    expect(res.body.data.total).toBe(41.76);
    expect(await stockQty(ventaId, prod1)).toBe(10);
  });
});

describe('POST /sales — referencias y validación (casos negativos)', () => {
  const validBody = () => ({
    customerId: clienteId,
    warehouseId: ventaId,
    items: [{ productId: prod1, quantity: 1 }],
  });

  it('FK inexistentes o de otra empresa devuelven 400 con códigos propios', async () => {
    const customerMissing = await createSale(adminToken, {
      ...validBody(),
      customerId: new Types.ObjectId().toString(),
    });
    expect(customerMissing.status).toBe(400);
    expect(customerMissing.body.error.code).toBe('CUSTOMER_NOT_FOUND');

    const customerForeign = await createSale(adminToken, {
      ...validBody(),
      customerId: foreignCustomerId,
    });
    expect(customerForeign.status).toBe(400);
    expect(customerForeign.body.error.code).toBe('CUSTOMER_NOT_FOUND');

    const warehouseMissing = await createSale(adminToken, {
      ...validBody(),
      warehouseId: new Types.ObjectId().toString(),
    });
    expect(warehouseMissing.status).toBe(400);
    expect(warehouseMissing.body.error.code).toBe('WAREHOUSE_NOT_FOUND');

    const productMissing = await createSale(adminToken, {
      ...validBody(),
      items: [{ productId: new Types.ObjectId().toString(), quantity: 1 }],
    });
    expect(productMissing.status).toBe(400);
    expect(productMissing.body.error.code).toBe('PRODUCT_NOT_FOUND');

    const productForeign = await createSale(adminToken, {
      ...validBody(),
      items: [{ productId: foreignProdId, quantity: 1 }],
    });
    expect(productForeign.status).toBe(400);
    expect(productForeign.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('recursos desactivados devuelven 409 con códigos propios', async () => {
    const customerDisabled = await createSale(adminToken, {
      ...validBody(),
      customerId: bajaId,
    });
    expect(customerDisabled.status).toBe(409);
    expect(customerDisabled.body.error.code).toBe('CUSTOMER_DISABLED');

    const productInactive = await createSale(adminToken, {
      ...validBody(),
      items: [{ productId: inactiveProdId, quantity: 1 }],
    });
    expect(productInactive.status).toBe(409);
    expect(productInactive.body.error.code).toBe('PRODUCT_INACTIVE');

    const warehouseDisabled = await createSale(adminToken, {
      ...validBody(),
      warehouseId: cerradoId,
    });
    expect(warehouseDisabled.status).toBe(409);
    expect(warehouseDisabled.body.error.code).toBe('WAREHOUSE_DISABLED');
  });

  it('rechaza entradas inválidas con VALIDATION_ERROR', async () => {
    const noItems = await createSale(adminToken, { ...validBody(), items: [] });
    expect(noItems.status).toBe(400);
    expect(noItems.body.error.code).toBe('VALIDATION_ERROR');

    const badQuantity = await createSale(adminToken, {
      ...validBody(),
      items: [{ productId: prod1, quantity: 0 }],
    });
    expect(badQuantity.status).toBe(400);

    const duplicated = await createSale(adminToken, {
      ...validBody(),
      items: [
        { productId: prod1, quantity: 1 },
        { productId: prod1, quantity: 2 },
      ],
    });
    expect(duplicated.status).toBe(400);

    const badId = await createSale(adminToken, { ...validBody(), customerId: 'no-id' });
    expect(badId.status).toBe(400);

    const badDiscount = await createSale(adminToken, {
      ...validBody(),
      items: [{ productId: prod1, quantity: 1, discount: 101 }],
    });
    expect(badDiscount.status).toBe(400);

    const badNotes = await createSale(adminToken, { ...validBody(), notes: 'x'.repeat(501) });
    expect(badNotes.status).toBe(400);
  });
});

describe('POST /sales/:id/confirm — transacción con inventario (M12 + M11)', () => {
  it('confirma debita stock, crea OUT y registra el historial', async () => {
    const res = await transition(adminToken, s2, 'confirm');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');
    expect(res.body.data.confirmedAt).toBeTruthy();
    expect(res.body.data.history.map((event: { action: string }) => event.action)).toEqual([
      'created',
      'confirmed',
    ]);

    expect(await stockQty(ventaId, prod1)).toBe(7); // 10 − 3
    expect(await stockQty(ventaId, prod2)).toBe(3); // 5 − 2

    const out = await movementsByRef(`SALE:${s2}`);
    expect(out).toHaveLength(2);
    expect(out.every((movement) => movement.type === 'OUT')).toBe(true);
    expect(new Set(out.map((movement) => movement.quantity))).toEqual(new Set([3, 2]));
    expect(out.every((movement) => movement.reason === 'Confirmación de venta')).toBe(true);
  });

  it('stock insuficiente → 409 y ROLLBACK total (venta sigue pending)', async () => {
    const created = await createSale(adminToken, {
      customerId: clienteId,
      warehouseId: ventaId,
      items: [{ productId: prod2, quantity: 10 }], // stock real: 3
    });
    expect(created.status).toBe(201);
    s4 = created.body.data.id as string;

    const res = await transition(adminToken, s4, 'confirm');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

    // Revertido: ni estado, ni stock, ni movimientos.
    const after = await getSale(adminToken, s4);
    expect(after.body.data.status).toBe('pending');
    expect(after.body.data.confirmedAt).toBeNull();
    expect(after.body.data.history).toHaveLength(1);
    expect(await stockQty(ventaId, prod2)).toBe(3);
    expect(await movementsByRef(`SALE:${s4}`)).toHaveLength(0);
  });

  it('confirmar dos veces → 409 INVALID_SALE_STATE sin tocar stock', async () => {
    const res = await transition(adminToken, s2, 'confirm');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_SALE_STATE');
    expect(await stockQty(ventaId, prod1)).toBe(7);
    expect(await stockQty(ventaId, prod2)).toBe(3);
  });

  it('almacén desactivado tras crear la venta → 409 y rollback', async () => {
    const created = await createSale(adminToken, {
      customerId: clienteId,
      warehouseId: tempId,
      items: [{ productId: prod1, quantity: 1 }],
    });
    expect(created.status).toBe(201);
    s5 = created.body.data.id as string;

    await WarehouseModel.updateOne({ _id: tempId }, { $set: { isActive: false } });
    try {
      const res = await transition(adminToken, s5, 'confirm');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('WAREHOUSE_DISABLED');
      expect((await getSale(adminToken, s5)).body.data.status).toBe('pending');
      expect(await stockQty(ventaId, prod1)).toBe(7);
      expect(await movementsByRef(`SALE:${s5}`)).toHaveLength(0);
    } finally {
      await WarehouseModel.updateOne({ _id: tempId }, { $set: { isActive: true } });
    }
  });
});

describe('POST /sales/:id/cancel — anulación con permiso sales.cancel', () => {
  it('cancelar una venta pendiente no toca el stock', async () => {
    const res = await transition(adminToken, s3, 'cancel');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.cancelledAt).toBeTruthy();
    expect(res.body.data.history.at(-1).action).toBe('cancelled');
    expect(await stockQty(ventaId, prod1)).toBe(7); // sin cambios
    expect(await movementsByRef(`SALE:${s3}`)).toHaveLength(0);
  });

  it('cancelar una confirmada repone el stock con movimientos RETURN', async () => {
    const res = await transition(adminToken, s2, 'cancel');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');

    expect(await stockQty(ventaId, prod1)).toBe(10); // 7 + 3
    expect(await stockQty(ventaId, prod2)).toBe(5); // 3 + 2

    const restock = await movementsByRef(`SALE:${s2}`);
    expect(restock.filter((movement) => movement.type === 'RETURN')).toHaveLength(2);
    expect(
      restock
        .filter((movement) => movement.type === 'RETURN')
        .every((movement) => movement.reason === 'Cancelación de venta'),
    ).toBe(true);
  });

  it('cancelar algo ya cancelado o devuelto → 409 INVALID_SALE_STATE', async () => {
    const again = await transition(adminToken, s3, 'cancel');
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_SALE_STATE');

    const returned = await transition(adminToken, s1, 'cancel');
    expect(returned.status).toBe(409);
    expect(returned.body.error.code).toBe('INVALID_SALE_STATE');
  });
});

describe('POST /sales/:id/return — devolución con permiso sales.return', () => {
  it('devolver una confirmada repone stock y marca returned', async () => {
    const created = await createSale(adminToken, {
      customerId: clienteId,
      warehouseId: ventaId,
      items: [{ productId: prod1, quantity: 4 }],
    });
    expect(created.status).toBe(201);
    s6 = created.body.data.id as string;

    expect((await transition(adminToken, s6, 'confirm')).status).toBe(200);
    expect(await stockQty(ventaId, prod1)).toBe(6); // 10 − 4

    const res = await transition(adminToken, s6, 'return');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('returned');
    expect(res.body.data.returnedAt).toBeTruthy();
    expect(await stockQty(ventaId, prod1)).toBe(10); // 6 + 4

    const restock = await movementsByRef(`SALE:${s6}`);
    expect(restock.some((m) => m.type === 'RETURN' && m.reason === 'Devolución de venta')).toBe(
      true,
    );
    expect(res.body.data.history.map((event: { action: string }) => event.action)).toEqual([
      'created',
      'confirmed',
      'returned',
    ]);
  });

  it('devolver pendientes o devueltas → 409 INVALID_SALE_STATE', async () => {
    const created = await createSale(adminToken, {
      customerId: cliente2Id,
      warehouseId: ventaId,
      items: [{ productId: prod2, quantity: 1 }],
    });
    expect(created.status).toBe(201);
    s7 = created.body.data.id as string;

    const pending = await transition(adminToken, s7, 'return');
    expect(pending.status).toBe(409);
    expect(pending.body.error.code).toBe('INVALID_SALE_STATE');
    expect((await getSale(adminToken, s7)).body.data.status).toBe('pending');
    expect(await stockQty(ventaId, prod2)).toBe(5);

    const again = await transition(adminToken, s6, 'return');
    expect(again.status).toBe(409);
    expect((await getSale(adminToken, s6)).body.data.status).toBe('returned');
    expect(await stockQty(ventaId, prod1)).toBe(10);
  });
});

describe('GET /sales — historial, búsqueda y filtros', () => {
  beforeAll(async () => {
    // Una venta confirmada a secas para los filtros por estado/almacén.
    // Debe crearse en Depósito Venta: ahí está el stock (tempId está vacío y el
    // OUT fallaría con INSUFFICIENT_STOCK — comportamiento correcto de M11).
    const created = await createSale(adminToken, {
      customerId: clienteId,
      warehouseId: ventaId,
      items: [{ productId: prod1, quantity: 1 }],
    });
    expect(created.status).toBe(201);
    s8 = created.body.data.id as string;
    expect((await transition(adminToken, s8, 'confirm')).status).toBe(200);
    expect(await stockQty(ventaId, prod1)).toBe(9); // 10 − 1
  });

  it('filtra por estado, cliente, almacén, búsqueda y rango de fechas', async () => {
    const confirmed = await request(app)
      .get('/api/v1/sales?status=confirmed&limit=100')
      .set('Authorization', auth(adminToken));
    expect(confirmed.status).toBe(200);
    const confirmedIds = (confirmed.body.data.items as Array<{ id: string }>).map((s) => s.id);
    expect(confirmedIds).toContain(s8);
    expect(confirmedIds).not.toContain(s2);
    expect(
      (confirmed.body.data.items as Array<{ status: string }>).every((s) => s.status === 'confirmed'),
    ).toBe(true);

    const cancelled = await request(app)
      .get('/api/v1/sales?status=cancelled&limit=100')
      .set('Authorization', auth(adminToken));
    const cancelledIds = (cancelled.body.data.items as Array<{ id: string }>).map((s) => s.id);
    expect(cancelledIds).toContain(s2);
    expect(cancelledIds).toContain(s3);

    const byCustomer = await request(app)
      .get(`/api/v1/sales?customerId=${cliente2Id}&limit=100`)
      .set('Authorization', auth(adminToken));
    const byCustomerItems = byCustomer.body.data.items as Array<{ id: string }>;
    expect(byCustomerItems).toHaveLength(1);
    expect(byCustomerItems[0]?.id).toBe(s7);

    const byWarehouse = await request(app)
      .get(`/api/v1/sales?warehouseId=${tempId}&limit=100`)
      .set('Authorization', auth(adminToken));
    const warehouseIds = (byWarehouse.body.data.items as Array<{ id: string }>).map((s) => s.id);
    expect(new Set(warehouseIds)).toEqual(new Set([s5])); // solo la venta del almacén temporal

    const byWarehouseVenta = await request(app)
      .get(`/api/v1/sales?warehouseId=${ventaId}&limit=100`)
      .set('Authorization', auth(adminToken));
    const ventaIds = (byWarehouseVenta.body.data.items as Array<{ id: string }>).map((s) => s.id);
    expect(ventaIds).toContain(s2);
    expect(ventaIds).toContain(s8);
    expect(ventaIds).not.toContain(s5);

    const byName = await request(app)
      .get('/api/v1/sales?search=Cliente Mostrador&limit=100')
      .set('Authorization', auth(adminToken));
    const nameIds = (byName.body.data.items as Array<{ id: string }>).map((s) => s.id);
    expect(nameIds).toContain(s2);
    expect(nameIds).not.toContain(s7); // ese es del Cliente Alternativo

    const bySku = await request(app)
      .get('/api/v1/sales?search=SKU-SALE-02&limit=100')
      .set('Authorization', auth(adminToken));
    const skuIds = (bySku.body.data.items as Array<{ id: string }>).map((s) => s.id);
    expect(new Set(skuIds)).toEqual(new Set([s2, s4, s7]));

    // Rango de fechas: días completos inclusivos (ayer…hoy cubre todas las ventas de la suite).
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const byRange = await request(app)
      .get(`/api/v1/sales?dateFrom=${yesterday}&dateTo=${today}&limit=100`)
      .set('Authorization', auth(adminToken));
    expect(byRange.body.data.meta.total).toBe(8);
    expect(
      (byRange.body.data.items as Array<{ id: string }>).map((s) => s.id),
    ).toContain(s2);

    const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
    const emptyRange = await request(app)
      .get(`/api/v1/sales?dateFrom=${tomorrow}&dateTo=${tomorrow}&limit=100`)
      .set('Authorization', auth(adminToken));
    expect(emptyRange.body.data.meta.total).toBe(0);

    const sorted = await request(app)
      .get('/api/v1/sales?sort=total&order=asc&limit=100')
      .set('Authorization', auth(adminToken));
    const totals = (sorted.body.data.items as Array<{ total: number }>).map((s) => s.total);
    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
  });

  it('rechaza parámetros de listado inválidos', async () => {
    for (const query of [
      'sort=hack',
      'order=sideways',
      'limit=5000',
      'status=paid',
      'dateFrom=2026-02-31',
      'dateFrom=2026-09-10&dateTo=2026-09-01',
      'customerId=no-id',
    ]) {
      const res = await request(app)
        .get(`/api/v1/sales?${query}`)
        .set('Authorization', auth(adminToken));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('aislamiento: la venta de otra empresa nunca aparece ni se filtra', async () => {
    const res = await request(app)
      .get('/api/v1/sales?limit=100')
      .set('Authorization', auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.meta.total).toBe(8); // s1…s8
    expect(JSON.stringify(res.body)).not.toContain('Cliente Ajeno');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('Bob Otro');
  });
});

describe('GET /sales/:id — detalle, historial e inmutabilidad', () => {
  it('devuelve el detalle con snapshots e historial completo', async () => {
    const res = await getSale(adminToken, s6);
    expect(res.status).toBe(200);
    const sale = res.body.data;

    expect(sale.status).toBe('returned');
    expect(sale.customerName).toBe('Cliente Mostrador');
    expect(sale.warehouseName).toBe('Depósito Venta');
    expect(sale.items[0]?.productName).toBe('Producto Uno');
    expect(sale.confirmedAt).toBeTruthy();
    expect(sale.returnedAt).toBeTruthy();
    expect(sale.cancelledAt).toBeNull();
    expect(sale.history.map((event: { action: string }) => event.action)).toEqual([
      'created',
      'confirmed',
      'returned',
    ]);
    expect(sale.history.every((event: { userName: string }) => event.userName === 'Ada Admin')).toBe(
      true,
    );
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('no acepta PATCH ni DELETE (el documento solo transiciona de estado)', async () => {
    const patched = await request(app)
      .patch(`/api/v1/sales/${s6}`)
      .set('Authorization', auth(adminToken))
      .send({ status: 'cancelled', total: 1 });
    expect(patched.status).toBe(404);

    const deleted = await request(app)
      .delete(`/api/v1/sales/${s6}`)
      .set('Authorization', auth(adminToken));
    expect(deleted.status).toBe(404);

    const after = await getSale(adminToken, s6);
    expect(after.body.data.status).toBe('returned');
    expect(after.body.data.total).toBeGreaterThan(0);
  });

  it('detalle con id inválido → 400, inexistente o ajeno → 404', async () => {
    const invalid = await getSale(adminToken, 'no-id');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await getSale(adminToken, new Types.ObjectId().toString());
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    expect(missing.body.error.message).toBe('Venta no encontrada');

    const foreign = await getSale(adminToken, foreignSaleId);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.message).toBe('Venta no encontrada');

    const invalidTransition = await transition(adminToken, 'no-id', 'confirm');
    expect(invalidTransition.status).toBe(400);
  });
});
