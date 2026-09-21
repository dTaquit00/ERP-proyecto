import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimit } from './rate-limit.js';
import { errorHandler } from '../http/error-handler.js';

describe('createRateLimit', () => {
  const app = express();
  const limiter = createRateLimit({ windowMs: 60_000, limit: 3 });
  app.get('/recurso', limiter, (_req, res) => {
    res.status(200).json({ data: { ok: true } });
  });
  // Mismo manejador global que la API real: el 429 debe salir en formato {error:{...}}
  app.use(errorHandler);

  it('permite las solicitudes dentro del límite', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/recurso');
      expect(res.status).toBe(200);
    }
  });

  it('responde 429 con el formato de error estándar al superar el límite', async () => {
    const res = await request(app).get('/recurso');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(typeof res.body.error.message).toBe('string');
  });
});
