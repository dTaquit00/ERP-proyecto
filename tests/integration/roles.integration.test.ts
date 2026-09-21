import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { Types } from 'mongoose';
import { PERMISSIONS } from '@erp/types';
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

describe('GET /api/v1/roles', () => {
  it('devuelve 401 sin token y 403 sin roles.read', async () => {
    const noAuth = await request(app).get('/api/v1/roles');
    expect(noAuth.status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('lista los 7 roles del sistema + personalizados, con userCount y sin secretos', async () => {
    const res = await request(app)
      .get('/api/v1/roles?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      name: string;
      isSystem: boolean;
      userCount: number;
      permissions: string[];
    }>;
    expect(items.length).toBeGreaterThanOrEqual(9); // 7 sistema + gestor + basico
    expect(items.some((r) => r.name === 'administrador' && r.isSystem)).toBe(true);
    expect(items.some((r) => r.name === 'auditor')).toBe(true);

    const adminRole = items.find((r) => r.name === 'administrador')!;
    expect(adminRole.userCount).toBeGreaterThanOrEqual(2); // admin + inactivo
    expect(adminRole.permissions).toContain('users.write');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.body.data.meta.total).toBe(items.length);
  });

  it('pagina los roles', async () => {
    const all = await request(app)
      .get('/api/v1/roles?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    const total = all.body.data.meta.total as number;

    const page = await request(app)
      .get('/api/v1/roles?page=2&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page.status).toBe(200);
    expect(page.body.data.meta).toEqual({ page: 2, limit: 2, total, totalPages: Math.ceil(total / 2) });
    expect((page.body.data.items as unknown[]).length).toBeLessThanOrEqual(2);
  });
});

describe('GET /api/v1/roles/:id', () => {
  it('devuelve un rol de la empresa con su userCount', async () => {
    const res = await request(app)
      .get(`/api/v1/roles/${ctx.adminRole.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('administrador');
    expect(res.body.data.userCount).toBeGreaterThanOrEqual(2);
  });

  it('aislamiento: rol de otra empresa → 404; id inválido → 400; inexistente → 404', async () => {
    const foreign = await request(app)
      .get(`/api/v1/roles/${ctx.otherCompanyAdmin.roleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(foreign.status).toBe(404);

    const invalid = await request(app)
      .get('/api/v1/roles/malo')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .get(`/api/v1/roles/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/v1/permissions', () => {
  it('devuelve el catálogo completo (roles.read)', async () => {
    const res = await request(app)
      .get('/api/v1/permissions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual([...PERMISSIONS]);
    expect(res.body.data.permissions.length).toBeGreaterThanOrEqual(35);
  });

  it('exige autenticación y permisos', async () => {
    const noAuth = await request(app).get('/api/v1/permissions');
    expect(noAuth.status).toBe(401);

    const forbidden = await request(app)
      .get('/api/v1/permissions')
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(forbidden.status).toBe(403);
  });
});

describe('POST /api/v1/roles — creación', () => {
  it('crea un rol personalizado con permisos del catálogo', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'jefe-venta',
        displayName: 'Jefe de Venta',
        permissions: ['sales.read', 'sales.write', 'reports.read'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('jefe-venta');
    expect(res.body.data.isSystem).toBe(false);
    expect(res.body.data.userCount).toBe(0);
    expect(res.body.data.permissions).toEqual(['sales.read', 'sales.write', 'reports.read']);
  });

  it('rechaza nombre duplicado en la empresa (409 ROLE_NAME_IN_USE)', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'jefe-venta', displayName: 'Otro', permissions: [] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROLE_NAME_IN_USE');
  });

  it('rechaza permisos ajenos al catálogo y nombres inválidos (400)', async () => {
    const unknownPermission = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'rol-invalido',
        displayName: 'Rol',
        permissions: ['sales.read', 'hacker.everything'],
      });
    expect(unknownPermission.status).toBe(400);
    expect(unknownPermission.body.error.code).toBe('VALIDATION_ERROR');
    expect(unknownPermission.body.error.details.length).toBeGreaterThan(0);

    const badName = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'mi rol', displayName: 'Con espacios' });
    expect(badName.status).toBe(400);
  });

  it('devuelve 403 sin roles.write (writer solo tiene roles.read)', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${writerToken}`)
      .send({ name: 'sin-permiso', displayName: 'Sin permiso', permissions: [] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });
});

describe('PATCH /api/v1/roles/:id — edición', () => {
  it('actualiza nombre visible y permisos', async () => {
    const created = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'editor', displayName: 'Editor', permissions: ['products.read'] });
    expect(created.status).toBe(201);
    const roleId = created.body.data.id as string;

    const res = await request(app)
      .patch(`/api/v1/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ displayName: 'Editor de Contenido', permissions: ['products.read', 'categories.read'] });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Editor de Contenido');
    expect(res.body.data.permissions).toEqual(['products.read', 'categories.read']);

    // El nombre (identificador) no es editable: el campo se ignora
    const ignoredName = await request(app)
      .patch(`/api/v1/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'hackeado', displayName: 'Editor' });
    expect(ignoredName.status).toBe(200);
    expect(ignoredName.body.data.name).toBe('editor');
  });

  it('valida cuerpo, permisos y alcance (400 / 403 / 404)', async () => {
    const empty = await request(app)
      .patch(`/api/v1/roles/${ctx.adminRole.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const badPermission = await request(app)
      .patch(`/api/v1/roles/${ctx.adminRole.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: ['not.a.permission'] });
    expect(badPermission.status).toBe(400);

    const forbidden = await request(app)
      .patch(`/api/v1/roles/${ctx.adminRole.id}`)
      .set('Authorization', `Bearer ${writerToken}`)
      .send({ displayName: 'Hack' });
    expect(forbidden.status).toBe(403);

    const crossTenant = await request(app)
      .patch(`/api/v1/roles/${ctx.otherCompanyAdmin.roleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ displayName: 'Fuera' });
    expect(crossTenant.status).toBe(404);
  });
});

describe('DELETE /api/v1/roles/:id — borrado protegido', () => {
  it('no elimina roles del sistema (409 SYSTEM_ROLE)', async () => {
    const res = await request(app)
      .delete(`/api/v1/roles/${ctx.adminRole.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SYSTEM_ROLE');
  });

  it('no elimina un rol asignado a usuarios (409 ROLE_IN_USE)', async () => {
    const created = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'en-uso', displayName: 'En uso', permissions: ['dashboard.read'] });
    expect(created.status).toBe(201);
    const roleId = created.body.data.id as string;

    // Asignar el rol a un usuario
    const user = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'en-uso@test.local',
        password: 'ClaveEnUso123',
        firstName: 'En',
        lastName: 'Uso',
        roleId,
      });
    expect(user.status).toBe(201);

    const res = await request(app)
      .delete(`/api/v1/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROLE_IN_USE');

    // Para el resto de la suite: quitar el usuario del rol no es necesario
    // (los tests posteriores no cuentan usuarios de este rol).
  });

  it('elimina un rol libre y deja de ser consultable', async () => {
    const created = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'temporal-rol', displayName: 'Temporal', permissions: [] });
    expect(created.status).toBe(201);
    const roleId = created.body.data.id as string;

    const forbidden = await request(app)
      .delete(`/api/v1/roles/${roleId}`)
      .set('Authorization', `Bearer ${writerToken}`);
    expect(forbidden.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/v1/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toEqual({ id: roleId, deleted: true });

    const after = await request(app)
      .get(`/api/v1/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.status).toBe(404);
  });

  it('aislamiento: no se borran roles de otra empresa (404)', async () => {
    const res = await request(app)
      .delete(`/api/v1/roles/${ctx.otherCompanyAdmin.roleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
