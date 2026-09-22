import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { customersController } from './customers.controller.js';

export const customersRoutes = Router();

// M08 — Clientes (RBAC en backend; sin DELETE: desactivación vía PATCH isActive)
customersRoutes.use(authenticate);

customersRoutes.get('/', authorize('customers.read'), customersController.list);
customersRoutes.get('/:id', authorize('customers.read'), customersController.get);
customersRoutes.post('/', authorize('customers.write'), customersController.create);
customersRoutes.patch('/:id', authorize('customers.write'), customersController.update);
