import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { warehousesController } from './warehouses.controller.js';

export const warehousesRoutes = Router();

// M10 — Almacenes (RBAC en backend)
warehousesRoutes.use(authenticate);

warehousesRoutes.get('/', authorize('warehouses.read'), warehousesController.list);
// Ruta específica antes de `/:id` para evitar colisiones.
warehousesRoutes.get('/:id/inventory', authorize('inventory.read'), warehousesController.inventory);
warehousesRoutes.get('/:id', authorize('warehouses.read'), warehousesController.get);
warehousesRoutes.post('/', authorize('warehouses.write'), warehousesController.create);
warehousesRoutes.patch('/:id', authorize('warehouses.write'), warehousesController.update);
