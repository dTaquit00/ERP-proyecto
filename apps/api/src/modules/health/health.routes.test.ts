import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { getDatabaseState } from '../../db/mongoose.js';
import { healthRoutes } from './health.routes.js';

vi.mock('../../db/mongoose.js', () => ({ getDatabaseState: vi.fn() }));
const app = express();
app.use('/health', healthRoutes);
beforeEach(() => vi.mocked(getDatabaseState).mockReturnValue('disconnected'));

it('responde 503 cuando MongoDB no está disponible', async () => {
  const result = await request(app).get('/health/ready');
  expect(result.status).toBe(503);
  expect(result.body.data).toMatchObject({ status: 'degraded', database: 'disconnected' });
});

it('responde 200 cuando MongoDB está conectado', async () => {
  vi.mocked(getDatabaseState).mockReturnValue('connected');
  const result = await request(app).get('/health/ready');
  expect(result.status).toBe(200);
  expect(result.body.data).toMatchObject({ status: 'ok', database: 'connected' });
});

it('la sonda del proceso funciona aunque la base esté desconectada', async () => {
  const result = await request(app).get('/health/live');
  expect(result.status).toBe(200);
  expect(result.body.data.status).toBe('ok');
});
