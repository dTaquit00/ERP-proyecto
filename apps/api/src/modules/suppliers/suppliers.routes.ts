import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { suppliersController } from './suppliers.controller.js';

export const suppliersRoutes = Router();

// M09 — Proveedores (RBAC en backend; sin DELETE: desactivación vía PATCH isActive)
suppliersRoutes.use(authenticate);

suppliersRoutes.get('/', authorize('suppliers.read'), suppliersController.list);
suppliersRoutes.get('/:id', authorize('suppliers.read'), suppliersController.get);
suppliersRoutes.post('/', authorize('suppliers.write'), suppliersController.create);
suppliersRoutes.patch('/:id', authorize('suppliers.write'), suppliersController.update);
