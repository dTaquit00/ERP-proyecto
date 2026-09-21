import { Router } from 'express';
import { sendOk } from '../../shared/http/response.js';
import { getDatabaseState } from '../../db/mongoose.js';

export const healthRoutes = Router();

/**
 * Estado del servidor para monitoreo (sin límite de tasa):
 * status = ok | degraded según la conexión a MongoDB.
 */
healthRoutes.get('/', (_req, res) => {
  const database = getDatabaseState();
  sendOk(res, {
    status: database === 'connected' ? 'ok' : 'degraded',
    database,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
