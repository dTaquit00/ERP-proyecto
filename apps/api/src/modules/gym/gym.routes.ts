import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { gymController as controller } from './gym.controller.js';

export const gymRoutes = Router();
gymRoutes.use(authenticate);
gymRoutes.get('/members', authorize('members.read'), controller.listMembers);
gymRoutes.get('/members/:id', authorize('members.read'), controller.getMember);
gymRoutes.post('/members', authorize('members.write'), controller.createMember);
gymRoutes.patch('/members/:id', authorize('members.write'), controller.updateMember);
gymRoutes.get('/plans', authorize('memberships.read'), controller.listPlans);
gymRoutes.get('/plans/:id', authorize('memberships.read'), controller.getPlan);
gymRoutes.post('/plans', authorize('memberships.write'), controller.createPlan);
gymRoutes.patch('/plans/:id', authorize('memberships.write'), controller.updatePlan);
gymRoutes.get('/enrollments', authorize('enrollments.read'), controller.listEnrollments);
gymRoutes.get('/enrollments/:id', authorize('enrollments.read'), controller.getEnrollment);
gymRoutes.post('/enrollments', authorize('enrollments.write'), controller.createEnrollment);
gymRoutes.post('/enrollments/:id/cancel', authorize('enrollments.write'), controller.cancelEnrollment);
