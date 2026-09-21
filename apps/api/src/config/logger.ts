import pino from 'pino';
import { env } from './env.js';

/**
 * Logger estructurado.
 * Nunca registra contraseñas, tokens completos, secretos ni credenciales de MongoDB.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'newPassword',
      'currentPassword',
      '*.password',
      '*.newPassword',
      '*.currentPassword',
      'accessToken',
      'refreshToken',
      '*.accessToken',
      '*.refreshToken',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
