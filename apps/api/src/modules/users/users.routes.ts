import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { usersController } from './users.controller.js';

export const usersRoutes = Router();

// M02 — Usuarios (RBAC en backend)
usersRoutes.use(authenticate);

usersRoutes.get('/', authorize('users.read'), usersController.list);
usersRoutes.get('/:id/history', authorize('users.read'), usersController.history);
usersRoutes.get('/:id', authorize('users.read'), usersController.get);

usersRoutes.post('/', authorize('users.write'), usersController.create);
usersRoutes.patch('/:id', authorize('users.write'), usersController.update);
usersRoutes.post('/:id/activate', authorize('users.write'), usersController.activate);
usersRoutes.post('/:id/deactivate', authorize('users.write'), usersController.deactivate);
