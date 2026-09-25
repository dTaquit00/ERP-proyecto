import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { purchasesController } from './purchases.controller.js';

export const purchasesRoutes = Router();
purchasesRoutes.use(authenticate);
purchasesRoutes.get('/', authorize('purchases.read'), purchasesController.list);
purchasesRoutes.get('/:id', authorize('purchases.read'), purchasesController.get);
purchasesRoutes.post('/', authorize('purchases.write'), purchasesController.create);
purchasesRoutes.post('/:id/confirm', authorize('purchases.confirm'), purchasesController.confirm);
purchasesRoutes.post('/:id/receive', authorize('purchases.receive'), purchasesController.receive);
purchasesRoutes.post('/:id/cancel', authorize('purchases.cancel'), purchasesController.cancel);
purchasesRoutes.post('/:id/return', authorize('purchases.receive'), purchasesController.returnPurchase);
