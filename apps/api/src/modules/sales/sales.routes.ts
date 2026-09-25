import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { salesController } from './sales.controller.js';

export const salesRoutes = Router();

// M12 — Ventas (RBAC en backend; sin PATCH/DELETE: el documento solo transiciona de estado)
salesRoutes.use(authenticate);

salesRoutes.get('/', authorize('sales.read'), salesController.list);
salesRoutes.get('/:id', authorize('sales.read'), salesController.get);
salesRoutes.post('/', authorize('sales.write'), salesController.create);
salesRoutes.post('/:id/confirm', authorize('sales.confirm'), salesController.confirm);
salesRoutes.post('/:id/cancel', authorize('sales.cancel'), salesController.cancel);
salesRoutes.post('/:id/return', authorize('sales.return'), salesController.returnSale);
