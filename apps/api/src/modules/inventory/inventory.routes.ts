import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { inventoryController } from './inventory.controller.js';

export const inventoryRoutes = Router();

// M11 — Inventario (RBAC en backend)
inventoryRoutes.use(authenticate);

inventoryRoutes.get('/stock', authorize('inventory.read'), inventoryController.listStock);
inventoryRoutes.get('/stock/:id', authorize('inventory.read'), inventoryController.getStock);
inventoryRoutes.patch('/stock/:id', authorize('inventory.write'), inventoryController.updateStock);

inventoryRoutes.get('/movements', authorize('inventory.read'), inventoryController.listMovements);
inventoryRoutes.get('/movements/:id', authorize('inventory.read'), inventoryController.getMovement);
// `inventory.transfer` (para type=TRANSFER) se valida en el controller/service.
inventoryRoutes.post('/movements', authorize('inventory.write'), inventoryController.createMovement);
