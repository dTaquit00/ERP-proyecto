import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { BranchModel } from '../../apps/api/src/modules/branches/branches.model.js';
import {
  setupTestContext,
  teardownTestContext,
  TEST_PASSWORD,
  type TestContext,
} from '../helpers/integration.js';

let ctx: TestContext;
let app: Express;
let adminToken: string;
let limitedToken: string;
let branchId: string;

async function login(email: string): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });
  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
}

beforeAll(async () => {
  ctx = await setupTestContext();
  app = ctx.app;
  adminToken = await login('admin@test.local');
  limitedToken = await login('limited@test.local');
});

afterAll(async () => teardownTestContext(ctx));

describe('M05 Sucursales', () => {
  it('crea, lista y actualiza una sucursal con RBAC', async () => {
    const forbidden = await request(app).get('/api/v1/branches').set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);

    const created = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: ' centro ', name: 'Centro', email: 'centro@test.local' });
    expect(created.status).toBe(201);
    branchId = created.body.data.id as string;
    expect(created.body.data.code).toBe('CENTRO');

    const listed = await request(app).get('/api/v1/branches').set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.items.some((item: { id: string }) => item.id === branchId)).toBe(true);

    const updated = await request(app)
      .patch(`/api/v1/branches/${branchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ manager: 'Ada Admin' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.manager).toBe('Ada Admin');
  });

  it('rechaza códigos duplicados y sucursales de otra empresa', async () => {
    const duplicate = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'CENTRO', name: 'Otro Centro' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CODE_IN_USE');

    const foreign = await BranchModel.create({ companyId: ctx.otherCompany.id, code: 'OTRO', name: 'Otra' });
    const response = await request(app)
      .get(`/api/v1/branches/${foreign.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(404);
  });

  it('rechaza branchId inexistente o ajeno al crear almacenes', async () => {
    const invalid = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Almacén inválido', branchId: 'aaaaaaaaaaaaaaaaaaaaaaaa' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('BRANCH_NOT_FOUND');

    const foreign = await BranchModel.create({ companyId: ctx.otherCompany.id, code: 'FORANEA', name: 'Foránea' });
    const crossCompany = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Almacén cruzado', branchId: foreign.id });
    expect(crossCompany.status).toBe(400);
    expect(crossCompany.body.error.code).toBe('BRANCH_NOT_FOUND');
  });
});
