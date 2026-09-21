import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { TooManyRequestsError } from '../http/errors.js';

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
}

/** Crea un limitador que responde con el formato de error estándar de la API. */
export function createRateLimit(options: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError());
    },
  });
}

/** Limitador global de la API (protege todas las rutas bajo /api/v1, salvo /health). */
export const apiRateLimiter = createRateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
});

/** Limitador más estricto para endpoints de autenticación (fuerza bruta). */
export const authRateLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
});
