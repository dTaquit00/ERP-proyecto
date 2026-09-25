import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { sign } from 'jsonwebtoken';
import { env } from '../../apps/api/src/config/env.js';
import { UserModel } from '../../apps/api/src/modules/users/users.model.js';
import { hashPassword } from '../../apps/api/src/shared/security/password.js';
import {
  setupTestContext,
  teardownTestContext,
  TEST_PASSWORD,
  type TestContext,
} from '../helpers/integration.js';

let ctx: TestContext;
let app: Express;

beforeAll(async () => {
  ctx = await setupTestContext();
  app = ctx.app;
});

afterAll(async () => {
  await teardownTestContext(ctx);
});

function expiredAccessToken(): string {
  return sign(
    {
      sub: ctx.admin.id,
      companyId: ctx.company.id,
      roleId: ctx.adminRole.id,
      sid: 'dead-session',
      typ: 'access',
    },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: -10 },
  );
}

describe('GET /api/v1/health', () => {
  it('reporta estado ok con MongoDB conectado', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('connected');
  });

  it('expone liveness y readiness', async () => {
    const live = await request(app).get('/api/v1/health/live');
    expect(live.status).toBe(200);
    expect(live.body.data.status).toBe('ok');

    const ready = await request(app).get('/api/v1/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.data.database).toBe('connected');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('devuelve tokens y el usuario sin hash de contraseña', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ADMIN@TEST.LOCAL', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.expiresIn).toBeGreaterThan(0);
    expect(res.body.data.user.email).toBe('admin@test.local');
    expect(res.body.data.user.permissions).toContain('sales.write');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const cookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookie?.[0]).toContain('refreshToken=');
    expect(cookie?.[0]).toContain('HttpOnly');
    expect(cookie?.[0]).toContain('Path=/api/v1/auth');
  });

  it('rechaza la contraseña incorrecta con INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: 'WrongPass123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('responde igual para correo inexistente (sin enumeración de usuarios)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.local', password: 'WrongPass123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('valida campos vacíos con VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('valida el formato del correo', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'no-es-correo', password: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('bloquea una cuenta desactivada con contraseña correcta (403 ACCOUNT_DISABLED)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inactive@test.local', password: TEST_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('rechaza cuerpo JSON malformado', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('devuelve 401 sin token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('devuelve 401 con token manipulado', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer token-manipulado');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('devuelve 401 con token expirado', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredAccessToken()}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('devuelve 401 si el usuario ya no existe (token huérfano)', async () => {
    const tempUser = await UserModel.create({
      companyId: ctx.company.id,
      email: 'temp@test.local',
      passwordHash: await hashPassword(TEST_PASSWORD),
      firstName: 'Tem',
      lastName: 'Poral',
      roleId: ctx.adminRole.id,
      isActive: true,
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'temp@test.local', password: TEST_PASSWORD });
    expect(login.status).toBe(200);

    await UserModel.deleteOne({ _id: tempUser.id });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_INVALID');
  });

  it('devuelve el usuario autenticado con permisos', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@test.local');
    expect(res.body.data.roleName).toBe('administrador');
    expect(res.body.data.permissions).toContain('products.write');
    expect(res.body.data.companyId).toBe(ctx.company.id);
  });

  it('aislamiento multiempresa: el token de otra empresa ve su propia empresa', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@other.local', password: TEST_PASSWORD });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.companyId).toBe(ctx.otherCompany.id);
    expect(res.body.data.companyId).not.toBe(ctx.company.id);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rechaza la petición sin cookie de sesión', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_MISSING');
  });

  it('rota el refresh token: la cookie nueva sustituye a la anterior', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });
    const firstCookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

    const refreshed = await agent.post('/api/v1/auth/refresh');

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
    const newCookie = (refreshed.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    // La rotación real es del refresh token (el access token puede ser idéntico
    // si se emite en el mismo segundo: HS256 + mismo payload + mismo iat).
    expect(newCookie).not.toBe(firstCookie);
    expect(newCookie.startsWith('refreshToken=')).toBe(true);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('admin@test.local');
  });

  it('rechaza el reuso del refresh token anterior (rotación)', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });
    const cookie = (loginRes.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

    // Primer uso: rota el token
    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);

    // Reuso: el token original ya no es válido
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('SESSION_INVALID');
  });

  it('rechaza una cookie manipulada', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=token-falso');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_INVALID');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('cierra la sesión e impide seguir refrescando', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email: 'admin@test.local', password: TEST_PASSWORD });

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);

    const refresh = await agent.post('/api/v1/auth/refresh');
    expect(refresh.status).toBe(401);
  });

  it('es idempotente: se puede llamar sin sesión', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/auth/change-password', () => {
  it('exige autenticación', async () => {
    const res = await request(app).post('/api/v1/auth/change-password');
    expect(res.status).toBe(401);
  });

  it('rechaza la contraseña actual incorrecta', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ currentPassword: 'OtraClave123', newPassword: 'NuevaClave123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CURRENT_PASSWORD_INVALID');
  });

  it('rechaza una contraseña nueva débil', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'corta' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cambia la contraseña y revoca las demás sesiones', async () => {
    const newPassword = 'NuevaClave123';

    // Otra sesión (refresh token) que debe morir tras el cambio
    const otherAgent = request.agent(app);
    const otherLogin = await otherAgent
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });
    expect(otherLogin.status).toBe(200);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });

    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword });
    expect(change.status).toBe(200);

    // La sesión anterior (no actual) ya no refresca
    const staleRefresh = await otherAgent.post('/api/v1/auth/refresh');
    expect(staleRefresh.status).toBe(401);

    // La contraseña anterior deja de servir y la nueva funciona
    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: newPassword });
    expect(newLogin.status).toBe(200);

    // Restaurar la contraseña original para el resto de la suite
    const restore = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${newLogin.body.data.accessToken}`)
      .send({ currentPassword: newPassword, newPassword: TEST_PASSWORD });
    expect(restore.status).toBe(200);
  });
});

describe('POST /api/v1/auth/request-password-reset + reset-password', () => {
  it('responde 200 aunque el correo no exista (sin filtrar información)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/request-password-reset')
      .send({ email: 'nobody@test.local' });

    expect(res.status).toBe(200);
    expect(res.body.data.resetToken).toBeUndefined();
  });

  it('restablece la contraseña con el token y lo marca como de un solo uso', async () => {
    const requestRes = await request(app)
      .post('/api/v1/auth/request-password-reset')
      .send({ email: 'admin@test.local' });

    expect(requestRes.status).toBe(200);
    const token = requestRes.body.data.resetToken as string | undefined;
    expect(token).toEqual(expect.any(String));

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'Recuperada123' });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.local', password: 'Recuperada123' });
    expect(newLogin.status).toBe(200);

    // Reuso del token: debe fallar
    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'OtraRecuperada123' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('INVALID_RESET_TOKEN');

    // Restaurar la contraseña original para el resto de la suite
    const restore = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${newLogin.body.data.accessToken}`)
      .send({ currentPassword: 'Recuperada123', newPassword: TEST_PASSWORD });
    expect(restore.status).toBe(200);
  });

  it('rechaza un token inválido', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'x'.repeat(40), newPassword: 'OtraClave123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('valida la contraseña nueva en el reset', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'x'.repeat(40), newPassword: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Respuestas de error estándar', () => {
  it('devuelve 404 con formato { error } para rutas inexistentes', async () => {
    const res = await request(app).get('/api/v1/ruta-inexistente');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });
});
