import { beforeAll, afterAll, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestContext, teardownTestContext, TEST_PASSWORD, type TestContext } from '../helpers/integration.js';
import { CompanyModel } from '../../apps/api/src/modules/companies/companies.model.js';
import { ProductModel } from '../../apps/api/src/modules/products/products.model.js';
import { GymMemberModel } from '../../apps/api/src/modules/gym/gym.model.js';
import { UserModel } from '../../apps/api/src/modules/users/users.model.js';
import { gymService } from '../../apps/api/src/modules/gym/gym.service.js';
import { gymToday } from '../../apps/api/src/modules/gym/gym.repository.js';
import { portalService } from '../../apps/api/src/modules/portal/portal.service.js';

let ctx: TestContext; let admin: string; let limited: string; let memberId: string; let token: string;
async function login(email: string) { const response = await request(ctx.app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD }); expect(response.status).toBe(200); return response.body.data.accessToken as string; }
beforeAll(async () => {
  ctx = await setupTestContext(); await gymService.initialize();
  admin = await login('admin@test.local'); limited = await login('limited@test.local');
});
afterAll(async () => { if (ctx) await teardownTestContext(ctx); });

it('mantiene el catálogo privado hasta habilitar una única empresa', async () => {
  const response = await request(ctx.app).get('/api/v1/public/store/products');
  expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ enabled: false, items: [] });
});
it('publica únicamente productos marcados y expone solo campos públicos', async () => {
  await CompanyModel.updateOne({ _id: ctx.company.id }, { $set: { 'settings.publicStoreEnabled': true } });
  for (const [sku, flags] of [['PUBLIC', { isPublic: true }], ['PRIVATE', { isPublic: false }], ['INACTIVE', { isPublic: true, isActive: false }]] as const) {
    await ProductModel.create({ companyId: ctx.company.id, sku, name: sku, categoryId: ctx.baseCategory.id, purchasePrice: 10, salePrice: 100, unit: 'pza', isActive: true, taxes: [{ name: 'IVA', rate: 16 }], ...flags });
  }
  await ProductModel.create({ companyId: ctx.otherCompany.id, sku: 'OTHER', name: 'Ajeno', categoryId: ctx.otherCompanyCategory.id, purchasePrice: 10, salePrice: 100, unit: 'pza', isPublic: true });
  const response = await request(ctx.app).get(`/api/v1/public/store/products?companyId=${ctx.otherCompany.id}`);
  expect(response.status).toBe(200); expect(response.body.data.items).toHaveLength(1);
  expect(response.body.data.items[0]).toMatchObject({ name: 'PUBLIC', price: 116 });
  expect(Object.keys(response.body.data.items[0]).sort()).toEqual(['category', 'description', 'id', 'image', 'name', 'price', 'unit']);
  expect((await request(ctx.app).get('/api/v1/public/store/products?search=%5B')).status).toBe(200);
  expect((await request(ctx.app).get('/api/v1/public/store/products?limit=999')).status).toBe(400);
});
it('no mezcla empresas si se habilita más de una tienda', async () => {
  await CompanyModel.updateOne({ _id: ctx.otherCompany.id }, { $set: { 'settings.publicStoreEnabled': true } });
  expect((await request(ctx.app).get('/api/v1/public/store/products')).body.data.items).toEqual([]);
  await CompanyModel.updateOne({ _id: ctx.otherCompany.id }, { $set: { 'settings.publicStoreEnabled': false } });
});
it('crea una cuenta de socio sin permisos administrativos y vincula su membresía', async () => {
  const member = await gymService.createMember(ctx.company.id, { memberNumber: 'PORTAL-001', firstName: 'Ana', lastName: 'Socio', email: 'ana@portal.test', phone: '', notes: 'NOTA ADMINISTRATIVA', isActive: true }); memberId = member.id;
  const plan = await gymService.createPlan(ctx.company.id, { name: 'Plan portal', description: '', durationDays: 30, price: 350, isActive: true });
  await gymService.createEnrollment(ctx.company.id, { memberId, planId: plan.id, startDate: gymToday(), notes: 'NO PUBLICAR' }, ctx.admin.id);
  const response = await request(ctx.app).post(`/api/v1/gym/members/${memberId}/account`).auth(admin, { type: 'bearer' }).send({ email: 'ana@portal.test', password: TEST_PASSWORD });
  expect(response.status).toBe(201); expect(response.body.data).toEqual({ email: 'ana@portal.test', linked: true });
  const loginResult = await request(ctx.app).post('/api/v1/auth/login').send({ email: 'ana@portal.test', password: TEST_PASSWORD });
  expect(loginResult.status).toBe(200); expect(loginResult.body.data.user.permissions).toEqual(['portal.read']); token = loginResult.body.data.accessToken as string;
  expect((await GymMemberModel.findById(memberId))?.userId).toBeTruthy();
  const own = await request(ctx.app).get('/api/v1/portal/me').auth(token, { type: 'bearer' });
  expect(own.status).toBe(200); expect(own.body.data.currentMembership).toMatchObject({ planName: 'Plan portal', remainingDays: 30 });
  expect(JSON.stringify(own.body)).not.toContain('NO PUBLICAR'); expect(JSON.stringify(own.body)).not.toContain('NOTA ADMINISTRATIVA');
});
it('ignora IDs de otro socio y prohíbe módulos administrativos, reportes y exportaciones', async () => {
  const otherMember = await gymService.createMember(ctx.company.id, { memberNumber: 'PORTAL-OTHER', firstName: 'Otro', lastName: 'Privado', email: '', phone: '', notes: '', isActive: true });
  const own = await request(ctx.app).get(`/api/v1/portal/me?memberId=${otherMember.id}&companyId=${ctx.otherCompany.id}`).auth(token, { type: 'bearer' });
  expect(own.body.data.member.memberNumber).toBe('PORTAL-001');
  for (const path of ['/users', '/roles', '/products', '/gym/members', `/gym/members/${otherMember.id}`, '/gym/enrollments', '/dashboard/summary', '/reports/sales', '/reports/sales.csv']) expect((await request(ctx.app).get(`/api/v1${path}`).auth(token, { type: 'bearer' })).status, path).toBe(403);
});
it('no crea cuentas si falta autorización y evita duplicados o secuestrar cuentas existentes', async () => {
  const count = await UserModel.countDocuments({ companyId: ctx.company.id });
  const data = { email: 'another@portal.test', password: TEST_PASSWORD };
  expect((await request(ctx.app).post(`/api/v1/gym/members/${memberId}/account`).auth(limited, { type: 'bearer' }).send(data)).status).toBe(403);
  expect((await request(ctx.app).post(`/api/v1/gym/members/${memberId}/account`).auth(admin, { type: 'bearer' }).send(data)).status).toBe(409);
  expect(await UserModel.countDocuments({ companyId: ctx.company.id })).toBe(count);
  const member = await gymService.createMember(ctx.company.id, { memberNumber: 'PORTAL-CONFLICT', firstName: 'Sin', lastName: 'Acceso', email: '', phone: '', notes: '', isActive: true });
  expect((await request(ctx.app).post(`/api/v1/gym/members/${member.id}/account`).auth(admin, { type: 'bearer' }).send({ email: 'admin@test.local', password: TEST_PASSWORD })).status).toBe(409);
  expect((await GymMemberModel.findById(member.id))?.userId).toBeFalsy();
  await expect(portalService.createAccount(ctx.otherCompany.id, member.id, data)).rejects.toThrow('Socio no encontrado');
});
it('un socio inactivo conserva su historial pero no aparece con membresía habilitada', async () => {
  await GymMemberModel.updateOne({ _id: memberId }, { $set: { isActive: false } });
  const own = await request(ctx.app).get('/api/v1/portal/me').auth(token, { type: 'bearer' });
  expect(own.status).toBe(200); expect(own.body.data.member.isActive).toBe(false); expect(own.body.data.currentMembership).toBeNull();
});
