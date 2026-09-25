import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { auditController } from './audit.controller.js';

export const auditRoutes = Router();
auditRoutes.use(authenticate);
auditRoutes.get('/', authorize('audit.read'), auditController.list);
auditRoutes.get('/:id', authorize('audit.read'), auditController.get);
