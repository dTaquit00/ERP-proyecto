import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes.js';

/** Router maestro bajo /api/v1 — aquí se montarán los módulos por fase. */
export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
