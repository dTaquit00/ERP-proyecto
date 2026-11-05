import { beforeAll, afterAll, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestContext, teardownTestContext, TEST_PASSWORD, type TestContext } from '../helpers/integration.js';
import { CompanyModel } from '../../apps/api/src/modules/companies/companies.model.js';
import { gymService } from '../../apps/api/src/modules/gym/gym.service.js';
import { gymToday } from '../../apps/api/src/modules/gym/gym.repository.js';

let ctx: TestContext; let admin: string; let limited: string; let other: string;
async function login(email: string) { const result = await request(ctx.app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD }); expect(result.status).toBe(200); return result.body.data.accessToken as string; }
beforeAll(async () => { ctx = await setupTestContext(); await gymService.initialize(); admin = await login('admin@test.local'); limited = await login('limited@test.local'); other = await login('admin@other.local'); });
afterAll(async () => { if (ctx) await teardownTestContext(ctx); });

it('el administrador habilita la tienda desde el ERP, conservando los otros ajustes', async () => {
  expect((await request(ctx.app).get('/api/v1/store/settings')).status).toBe(401);
  expect((await request(ctx.app).get('/api/v1/store/settings').auth(limited, { type: 'bearer' })).status).toBe(403);
  await CompanyModel.updateOne({ _id: ctx.company.id }, { $set: { 'settings.currency': 'MXN' } });
  expect((await request(ctx.app).patch('/api/v1/store/settings').auth(limited, { type: 'bearer' }).send({ enabled: true })).status).toBe(403);
  const result = await request(ctx.app).patch('/api/v1/store/settings').auth(admin, { type: 'bearer' }).send({ enabled: true, companyId: ctx.otherCompany.id });
  expect(result.status).toBe(200); expect(result.body.data).toMatchObject({ enabled: true, ready: true, published: 0 });
  expect((await CompanyModel.findById(ctx.company.id))?.settings.currency).toBe('MXN');
  expect((await CompanyModel.findById(ctx.otherCompany.id))?.settings.publicStoreEnabled).not.toBe(true);
  expect(result.headers['cache-control']).toBe('no-store');
});

it('un producto creado y editado mediante el ERP aparece y desaparece del catálogo público', async () => {
  const product = await request(ctx.app).post('/api/v1/products').auth(admin, { type: 'bearer' }).send({ name: 'Proteína prueba ERP', sku: 'PUBLIC-ERP', categoryId: ctx.baseCategory.id, purchasePrice: 120, salePrice: 250, unit: 'pza', isPublic: true });
  expect(product.status).toBe(201); expect(product.body.data.isPublic).toBe(true);
  const url = `/api/v1/public/store/products?search=${encodeURIComponent('Proteína prueba ERP')}`;
  const catalog = await request(ctx.app).get(url);
  expect(catalog.status).toBe(200); expect(catalog.body.data.items).toHaveLength(1);
  expect(catalog.body.data.items[0]).toMatchObject({ id: product.body.data.id, name: 'Proteína prueba ERP', price: 250 });
  expect(catalog.body.data.items[0]).not.toHaveProperty('purchasePrice');
  expect(catalog.headers['cache-control']).toBe('no-store');
  await request(ctx.app).patch(`/api/v1/products/${product.body.data.id}`).auth(admin, { type: 'bearer' }).send({ salePrice: 300, description: 'Descripción actualizada' });
  expect((await request(ctx.app).get(url)).body.data.items[0]).toMatchObject({ price: 300, description: 'Descripción actualizada' });
  const status = await request(ctx.app).get('/api/v1/store/settings').auth(admin, { type: 'bearer' });
  expect(status.body.data).toMatchObject({ products: 1, published: 1 });
  await request(ctx.app).patch(`/api/v1/products/${product.body.data.id}`).auth(admin, { type: 'bearer' }).send({ isPublic: false });
  expect((await request(ctx.app).get(url)).body.data.items).toEqual([]);
  await request(ctx.app).patch(`/api/v1/products/${product.body.data.id}`).auth(admin, { type: 'bearer' }).send({ isPublic: true, isActive: false });
  expect((await request(ctx.app).get(url)).body.data.items).toEqual([]);
});

it('no permite habilitar una segunda empresa ni publicar una empresa inactiva', async () => {
  const conflict = await request(ctx.app).patch('/api/v1/store/settings').auth(other, { type: 'bearer' }).send({ enabled: true });
  expect(conflict.status).toBe(409); expect(conflict.body.error.code).toBe('STORE_ALREADY_ENABLED');
  const otherSettings = await request(ctx.app).get('/api/v1/store/settings').auth(other, { type: 'bearer' });
  expect(otherSettings.body.data).toMatchObject({ products: 0, published: 0, enabled: false });
  await CompanyModel.updateOne({ _id: ctx.otherCompany.id }, { $set: { status: 'inactive' } });
  expect((await request(ctx.app).patch('/api/v1/store/settings').auth(other, { type: 'bearer' }).send({ enabled: true })).status).toBe(400);
  expect((await request(ctx.app).patch('/api/v1/store/settings').auth(admin, { type: 'bearer' }).send({ enabled: 'true' })).status).toBe(400);
});

it('el ERP crea socio, cuenta y membresía que se consultan con el nuevo inicio de sesión', async () => {
  const member = await request(ctx.app).post('/api/v1/gym/members').auth(admin, { type: 'bearer' }).send({ memberNumber: 'FLOW-001', firstName: 'Socio', lastName: 'De prueba', email: 'socioflow@test.local' });
  expect(member.status).toBe(201);
  const account = await request(ctx.app).post(`/api/v1/gym/members/${member.body.data.id}/account`).auth(admin, { type: 'bearer' }).send({ email: 'socioflow@test.local', password: TEST_PASSWORD });
  expect(account.status).toBe(201);
  const plan = await request(ctx.app).post('/api/v1/gym/plans').auth(admin, { type: 'bearer' }).send({ name: 'Quincena de prueba', durationDays: 15, price: 180 });
  expect(plan.status).toBe(201);
  const enrollment = await request(ctx.app).post('/api/v1/gym/enrollments').auth(admin, { type: 'bearer' }).send({ memberId: member.body.data.id, planId: plan.body.data.id, startDate: gymToday(), amountPaid: 180 });
  expect(enrollment.status).toBe(201);
  const token = await login('socioflow@test.local');
  const own = await request(ctx.app).get('/api/v1/portal/me').auth(token, { type: 'bearer' });
  expect(own.status).toBe(200); expect(own.body.data.currentMembership).toMatchObject({ planName: 'Quincena de prueba', remainingDays: 15 });
  expect(own.headers['cache-control']).toBe('no-store');
  expect((await request(ctx.app).get('/api/v1/store/settings').auth(token, { type: 'bearer' })).status).toBe(403);
  expect((await request(ctx.app).get('/api/v1/users').auth(token, { type: 'bearer' })).status).toBe(403);
});

it('Usuarios permite crear cuentas de personal con su rol y autenticación', async () => {
  const user = await request(ctx.app).post('/api/v1/users').auth(admin, { type: 'bearer' }).send({ firstName: 'Personal', lastName: 'De prueba', email: 'staffflow@test.local', password: TEST_PASSWORD, roleId: ctx.writerRole.id });
  expect(user.status).toBe(201);
  const token = await login('staffflow@test.local');
  expect((await request(ctx.app).get('/api/v1/users').auth(token, { type: 'bearer' })).status).toBe(200);
});
