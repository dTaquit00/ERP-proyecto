import { expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type * as EnvironmentModule from '../apps/api/src/config/env.js';

vi.mock('../apps/api/src/config/env.js', async (importOriginal) => {
  const original = await importOriginal<typeof EnvironmentModule>();
  return {
    ...original,
    env: { ...original.env, RATE_LIMIT_AUTH_MAX: 2, RATE_LIMIT_MAX: 20 },
  };
});
vi.mock('../apps/api/src/modules/auth/auth.controller.js', () => {
  const ok = (_req: express.Request, res: express.Response) => res.json({ data: { ok: true } });
  return {
    authController: {
      login: ok,
      refresh: (_req: express.Request, res: express.Response) => res.status(401).json({ error: { code: 'SESSION_INVALID' } }),
      logout: ok, me: ok, changePassword: ok, requestPasswordReset: ok, resetPassword: ok,
    },
  };
});

import { authRoutes } from '../apps/api/src/modules/auth/auth.routes.js';
import { errorHandler } from '../apps/api/src/shared/http/error-handler.js';

it('las consultas automáticas de sesión no consumen los intentos de acceso', async () => {
  const app = express();
  app.use('/auth', authRoutes);
  app.use(errorHandler);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    expect((await request(app).post('/auth/refresh')).status).toBe(401);
  }
  expect((await request(app).post('/auth/login')).status).toBe(200);
  expect((await request(app).post('/auth/login')).status).toBe(200);
  const limited = await request(app).post('/auth/login');
  expect(limited.status).toBe(429);
  expect(limited.body.error.code).toBe('RATE_LIMITED');
});
