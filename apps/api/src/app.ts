import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { corsOrigins, env } from './config/env.js';
import { logger } from './config/logger.js';
import { apiRateLimiter } from './shared/middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './shared/http/error-handler.js';
import { apiRouter } from './routes/api.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';

/**
 * Fabrica la app Express sin efectos secundarios (sin escuchar puertos ni conectar BD),
 * de modo que las pruebas de integración puedan usarla con supertest.
 */
export function createApp(): Express {
  const app = express();

  // Detrás de un proxy/LB en producción confiamos en el primer hop (para req.ip / rate limit).
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins(),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/v1/health',
      },
    }),
  );

  // Salud del servicio: fuera del rate limit para no afectar sondas de monitoreo.
  app.use('/api/v1/health', healthRoutes);

  app.use(apiRateLimiter);
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
