import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { reportsController } from './reports.controller.js';

export const reportsRoutes = Router();
reportsRoutes.use(authenticate);
reportsRoutes.get('/:type.csv', authorize('reports.export'), reportsController.csv);
reportsRoutes.get('/:type.pdf', authorize('reports.export'), reportsController.csv);
