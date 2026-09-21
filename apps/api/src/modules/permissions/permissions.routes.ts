import { Router } from 'express';
import { PERMISSIONS } from '@erp/types';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { sendOk } from '../../shared/http/response.js';

export const permissionsRoutes = Router();

/** Catálogo de permisos (para el editor de roles del frontend). */
permissionsRoutes.get('/', authenticate, authorize('roles.read'), (_req, res) => {
  sendOk(res, { permissions: PERMISSIONS });
});
