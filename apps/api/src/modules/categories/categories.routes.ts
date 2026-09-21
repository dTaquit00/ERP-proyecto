import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { categoriesController } from './categories.controller.js';

export const categoriesRoutes = Router();

// M06 — Categorías (RBAC en backend)
categoriesRoutes.use(authenticate);

categoriesRoutes.get('/', authorize('categories.read'), categoriesController.list);
categoriesRoutes.get('/:id', authorize('categories.read'), categoriesController.get);
categoriesRoutes.post('/', authorize('categories.write'), categoriesController.create);
categoriesRoutes.patch('/:id', authorize('categories.write'), categoriesController.update);
