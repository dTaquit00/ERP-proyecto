import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { productsController } from './products.controller.js';

export const productsRoutes = Router();

// M07 — Productos (RBAC en backend)
productsRoutes.use(authenticate);

productsRoutes.get('/', authorize('products.read'), productsController.list);
productsRoutes.get('/:id', authorize('products.read'), productsController.get);
productsRoutes.post('/', authorize('products.write'), productsController.create);
productsRoutes.patch('/:id', authorize('products.write'), productsController.update);
