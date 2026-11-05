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
publicStoreRoutes.get('/products', async (req, res) => sendOk(res, await portalService.catalog(parseOrThrow(paginationSchema.extend({ search: z.string().trim().max(100).optional() }), req.query))));
export const portalRoutes = Router();
portalRoutes.use(authenticate);
portalRoutes.get('/me', authorize('portal.read'), async (req, res) => { const auth = requireAuth(req); return sendOk(res, await portalService.me(auth.user.companyId, auth.user.id)); });
export const memberAccountRoutes = Router();
memberAccountRoutes.post('/:id/account', authenticate, authorize('members.write', 'users.write'), async (req, res) => {
  const auth = requireAuth(req); const { id } = parseOrThrow(idParamsSchema, req.params);
  return sendCreated(res, await portalService.createAccount(auth.user.companyId, id, parseOrThrow(z.object({ email: emailSchema, password: passwordSchema }), req.body)));
});
