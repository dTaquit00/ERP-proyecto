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
let writerToken: string;
let limitedToken: string;

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
  writerToken = await login('writer@test.local');
  limitedToken = await login('limited@test.local');
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

describe('GET /api/v1/users — RBAC y aislamiento', () => {
  it('devuelve 401 sin token', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('devuelve 403 a un rol sin users.read', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('lista solo usuarios de la empresa sin exponer passwordHash ni datos de otra empresa', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('admin@other.local');
    for (const user of res.body.data.items as Array<{ companyId: string; roleName: string }>) {
      expect(user.companyId).toBe(ctx.company.id);
      expect(user.roleName).toEqual(expect.any(String));
    }
  });

  it('pagina de forma consistente (meta.total real)', async () => {
    const all = await request(app)
      .get('/api/v1/users?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const total = all.body.data.meta.total as number;
    expect(total).toBeGreaterThanOrEqual(4);

    const page2 = await request(app)
      .get('/api/v1/users?page=2&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data.meta).toEqual({
      page: 2,
      limit: 1,
      total,
      totalPages: total,
    });
    expect((page2.body.data.items as unknown[]).length).toBeLessThanOrEqual(1);
  });

  it('busca por correo sin permitir inyección de regex', async () => {
    const res = await request(app)
      .get('/api/v1/users?search=inactive')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const emails = (res.body.data.items as Array<{ email: string }>).map((u) => u.email);
    expect(emails).toContain('inactive@test.local');
    expect(emails.length).toBeLessThanOrEqual(2);

    // Entrada hostile: no debe provocar 500 (regex malformada)
    const hostile = await request(app)
      .get(`/api/v1/users?search=${encodeURIComponent('(((')}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(hostile.status).toBe(200);
  });

  it('filtra por estado', async () => {
    const res = await request(app)
      .get('/api/v1/users?status=inactive')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{ email: string; isActive: boolean }>;
    expect(items.some((u) => u.email === 'inactive@test.local')).toBe(true);
    expect(items.every((u) => u.isActive === false)).toBe(true);
  });

  it('rechaza campos de orden o límites no permitidos (400)', async () => {
    const sort = await request(app)
      .get('/api/v1/users?sort=passwordHash')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sort.status).toBe(400);
    expect(sort.body.error.code).toBe('VALIDATION_ERROR');

    const limit = await request(app)
      .get('/api/v1/users?limit=5000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(limit.status).toBe(400);
  });
});

describe('GET /api/v1/users/:id', () => {
  it('devuelve el usuario con su rol', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${ctx.admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ctx.admin.id);
    expect(res.body.data.roleName).toBe('administrador');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('aislamiento: un usuario de otra empresa responde 404 (no filtra su existencia)', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${ctx.otherCompanyAdmin.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('valida el id antes de tocar la base (400) y responde 404 si no existe', async () => {
    const invalid = await request(app)
      .get('/api/v1/users/no-valido')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .get(`/api/v1/users/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/v1/users — creación', () => {
  it('crea un usuario que puede iniciar sesión con la contraseña dada', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'nuevo@test.local',
        password: 'NuevaClave123',
        firstName: 'Nue',
        lastName: 'Vo',
        roleId: ctx.writerRole.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('nuevo@test.local');
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.roleName).toBe('gestor');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nuevo@test.local', password: 'NuevaClave123' });
    expect(loginRes.status).toBe(200);
  });

  it('rechaza el correo duplicado dentro de la empresa (409 EMAIL_IN_USE)', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'ADMIN@test.local',
        password: 'OtraClave123',
        firstName: 'Dup',
        lastName: 'Licado',
        roleId: ctx.writerRole.id,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('rechaza un rol de otra empresa o inexistente (400 ROLE_NOT_FOUND)', async () => {
    const otherRole = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'rol-otro@test.local',
        password: 'Clave1234',
        firstName: 'Ro',
        lastName: 'Lero',
        roleId: ctx.otherCompanyAdmin.roleId,
      });
    expect(otherRole.status).toBe(400);
    expect(otherRole.body.error.code).toBe('ROLE_NOT_FOUND');

    const missingRole = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'rol-falta@test.local',
        password: 'Clave1234',
        firstName: 'Ro',
        lastName: 'Lero',
        roleId: new Types.ObjectId(),
      });
    expect(missingRole.status).toBe(400);
    expect(missingRole.body.error.code).toBe('ROLE_NOT_FOUND');
  });

  it('devuelve 403 sin users.write y 400 con datos inválidos', async () => {
    const forbidden = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({
        email: 'sin-permiso@test.local',
        password: 'Clave1234',
        firstName: 'Sin',
        lastName: 'Permiso',
        roleId: ctx.writerRole.id,
      });
    expect(forbidden.status).toBe(403);

    const invalid = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'no-correo',
        password: '123',
        firstName: '',
        lastName: '',
        roleId: 'no-id',
      });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('PATCH /api/v1/users/:id — edición y cambio de rol', () => {
  it('actualiza nombre y apellido', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${ctx.writerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Walter', lastName: 'Editado' });

    expect(res.status).toBe(200);
    expect(res.body.data.lastName).toBe('Editado');
    // Restaurar para el resto de la suite
    await request(app)
      .patch(`/api/v1/users/${ctx.writerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lastName: 'Writer' });
  });

  it('cambia el rol del usuario (la respuesta refleja el nuevo rol)', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${ctx.inactiveUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: ctx.writerRole.id });

    expect(res.status).toBe(200);
    expect(res.body.data.roleId).toBe(ctx.writerRole.id);
    expect(res.body.data.roleName).toBe('gestor');
    // Restaurar (inactiveUser era administrador)
    await request(app)
      .patch(`/api/v1/users/${ctx.inactiveUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: ctx.adminRole.id });
  });

  it('rechaza correo duplicado (409) y rol de otra empresa (400)', async () => {
    const duplicate = await request(app)
      .patch(`/api/v1/users/${ctx.writerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'admin@test.local' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_IN_USE');

    const foreignRole = await request(app)
      .patch(`/api/v1/users/${ctx.writerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: ctx.otherCompanyAdmin.roleId });
    expect(foreignRole.status).toBe(400);
    expect(foreignRole.body.error.code).toBe('ROLE_NOT_FOUND');
  });

  it('valida el cuerpo: vacío → 400; sin permisos → 403; otra empresa → 404', async () => {
    const empty = await request(app)
      .patch(`/api/v1/users/${ctx.writerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const forbidden = await request(app)
      .patch(`/api/v1/users/${ctx.writerUser.id}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({ firstName: 'Hack' });
    expect(forbidden.status).toBe(403);

    const crossTenant = await request(app)
      .patch(`/api/v1/users/${ctx.otherCompanyAdmin.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Fuera' });
    expect(crossTenant.status).toBe(404);
  });
});

describe('POST /api/v1/users/:id/deactivate | activate', () => {
  it('desactivar bloquea el login y activar lo restaura', async () => {
    // Usuario dedicado para no afectar al resto de la suite
    const created = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'temporal@test.local',
        password: 'Temporal123',
        firstName: 'Tem',
        lastName: 'Poral',
        roleId: ctx.writerRole.id,
      });
    expect(created.status).toBe(201);
    const userId = created.body.data.id as string;

    const off = await request(app)
      .post(`/api/v1/users/${userId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(off.status).toBe(200);
    expect(off.body.data.isActive).toBe(false);

    const blockedLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'temporal@test.local', password: 'Temporal123' });
    expect(blockedLogin.status).toBe(403);
    expect(blockedLogin.body.error.code).toBe('ACCOUNT_DISABLED');

    const on = await request(app)
      .post(`/api/v1/users/${userId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(on.status).toBe(200);
    expect(on.body.data.isActive).toBe(true);

    const okLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'temporal@test.local', password: 'Temporal123' });
    expect(okLogin.status).toBe(200);
  });

  it('no permite desactivarse a uno mismo (400 SELF_DEACTIVATE)', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${ctx.admin.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_DEACTIVATE');
  });

  it('no permite desactivar al último administrador activo (409 LAST_ACTIVE_ADMIN)', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${ctx.admin.id}/deactivate`)
      .set('Authorization', `Bearer ${writerToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_ACTIVE_ADMIN');
  });

  it('aislamiento: no se puede activar/desactivar usuarios de otra empresa (404)', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${ctx.otherCompanyAdmin.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/users/:id/history', () => {
  it('requiere users.read y devuelve sesiones reales tras iniciar sesión', async () => {
    const noAuth = await request(app).get(`/api/v1/users/${ctx.admin.id}/history`);
    expect(noAuth.status).toBe(401);

    const forbidden = await request(app)
      .get(`/api/v1/users/${ctx.admin.id}/history`)
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);

    const res = await request(app)
      .get(`/api/v1/users/${ctx.admin.id}/history`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(ctx.admin.id);
    expect(res.body.data.createdAt).toEqual(expect.any(String));
    expect(res.body.data.lastLoginAt).toEqual(expect.any(String));
    expect(Array.isArray(res.body.data.sessions)).toBe(true);
    expect(res.body.data.sessions.length).toBeGreaterThan(0);
    const session = (res.body.data.sessions as Array<{ active: boolean; expiresAt: string }>)[0]!;
    expect(session.active).toBe(true);
    expect(session.expiresAt).toEqual(expect.any(String));
    // Nunca exponer el token de la sesión
    expect(JSON.stringify(res.body)).not.toContain('refreshToken');
    expect(JSON.stringify(res.body)).not.toContain('tokenHash');
  });

  it('aislamiento: historial de otra empresa → 404', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${ctx.otherCompanyAdmin.id}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
