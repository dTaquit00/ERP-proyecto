import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { companiesController } from './companies.controller.js';

export const companiesRoutes = Router();

companiesRoutes.use(authenticate);
companiesRoutes.get('/', authorize('companies.read'), companiesController.list);
companiesRoutes.get('/:id', authorize('companies.read'), companiesController.get);
companiesRoutes.post('/', authorize('companies.write'), companiesController.create);
companiesRoutes.patch('/:id', authorize('companies.write'), companiesController.update);