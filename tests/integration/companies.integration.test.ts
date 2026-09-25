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
let adminToken: string;
let limitedToken: string;
let otherAdminToken: string;

async function login(email: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD });
  expect(response.status).toBe(200);
  return response.body.data.accessToken as string;
}

beforeAll(async () => {
  ctx = await setupTestContext();
  app = ctx.app;
  adminToken = await login('admin@test.local');
  limitedToken = await login('limited@test.local');
  otherAdminToken = await login('admin@other.local');
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

describe('M04 Empresas', () => {
  it('exige autenticación y permiso de lectura', async () => {
    expect((await request(app).get('/api/v1/companies')).status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v1/companies')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('lista únicamente la empresa del contexto autenticado', async () => {
    const response = await request(app)
      .get('/api/v1/companies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].id).toBe(ctx.company.id);
    expect(JSON.stringify(response.body)).not.toContain(ctx.otherCompany.id);
  });

  it('actualiza la empresa propia y rechaza la de otra empresa', async () => {
    const updated = await request(app)
      .patch(`/api/v1/companies/${ctx.company.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '+34 900 000 000', settings: { currency: 'EUR' } });

    expect(updated.status).toBe(200);
    expect(updated.body.data.phone).toBe('+34 900 000 000');
    expect(updated.body.data.settings.currency).toBe('EUR');

    const foreign = await request(app)
      .get(`/api/v1/companies/${ctx.otherCompany.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(foreign.status).toBe(404);

    const otherContext = await request(app)
      .get(`/api/v1/companies/${ctx.otherCompany.id}`)
      .set('Authorization', `Bearer ${otherAdminToken}`);
    expect(otherContext.status).toBe(200);
  });

  it('bloquea creación de empresas fuera del bootstrap de plataforma', async () => {
    const created = await request(app)
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nueva Empresa', legalName: 'Nueva Empresa S.L.' });
    expect(created.status).toBe(403);
    expect(created.body.error.code).toBe('PLATFORM_ADMIN_REQUIRED');
  });
});