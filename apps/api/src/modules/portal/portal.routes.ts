import { Router } from 'express';
import { z } from 'zod';
import { paginationSchema, emailSchema, passwordSchema, idParamsSchema } from '@erp/validation';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { parseOrThrow } from '../../shared/http/parse.js';
import { sendCreated, sendOk } from '../../shared/http/response.js';
import { portalService } from './portal.service.js';

export const publicStoreRoutes = Router();
publicStoreRoutes.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
publicStoreRoutes.get('/products', async (req, res) => sendOk(res, await portalService.catalog(parseOrThrow(paginationSchema.extend({ search: z.string().trim().max(100).optional() }), req.query))));
export const portalRoutes = Router();
portalRoutes.use(authenticate);
portalRoutes.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
portalRoutes.get('/me', authorize('portal.read'), async (req, res) => { const auth = requireAuth(req); return sendOk(res, await portalService.me(auth.user.companyId, auth.user.id)); });
export const memberAccountRoutes = Router();
memberAccountRoutes.post('/:id/account', authenticate, authorize('members.write', 'users.write'), async (req, res) => {
  const auth = requireAuth(req); const { id } = parseOrThrow(idParamsSchema, req.params);
  return sendCreated(res, await portalService.createAccount(auth.user.companyId, id, parseOrThrow(z.object({ email: emailSchema, password: passwordSchema }), req.body)));
});

export const storeManagementRoutes = Router();
storeManagementRoutes.use(authenticate);
storeManagementRoutes.get('/settings', authorize('products.read'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return sendOk(res, await portalService.storeSettings(requireAuth(req).user.companyId));
});
storeManagementRoutes.patch('/settings', authorize('products.read', 'companies.write'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const input = parseOrThrow(z.object({ enabled: z.boolean() }), req.body);
  return sendOk(res, await portalService.updateStoreSettings(requireAuth(req).user.companyId, input.enabled));
});
