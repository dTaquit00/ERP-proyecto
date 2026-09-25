import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { branchesController } from './branches.controller.js';

export const branchesRoutes = Router();
branchesRoutes.use(authenticate);
branchesRoutes.get('/', authorize('branches.read'), branchesController.list);
branchesRoutes.get('/:id', authorize('branches.read'), branchesController.get);
branchesRoutes.post('/', authorize('branches.write'), branchesController.create);
branchesRoutes.patch('/:id', authorize('branches.write'), branchesController.update);
