import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { rolesController } from './roles.controller.js';

export const rolesRoutes = Router();

// M03 — Roles y permisos (RBAC)
rolesRoutes.use(authenticate);

rolesRoutes.get('/', authorize('roles.read'), rolesController.list);
rolesRoutes.get('/:id', authorize('roles.read'), rolesController.get);

rolesRoutes.post('/', authorize('roles.write'), rolesController.create);
rolesRoutes.patch('/:id', authorize('roles.write'), rolesController.update);
rolesRoutes.delete('/:id', authorize('roles.write'), rolesController.remove);
