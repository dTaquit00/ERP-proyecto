import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authRateLimiter } from '../../shared/middleware/rate-limit.js';
import { authController } from './auth.controller.js';

export const authRoutes = Router();

// M01 — Autenticación
authRoutes.post('/login', authRateLimiter, authController.login);
authRoutes.post('/refresh', authRateLimiter, authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', authenticate, authController.me);
authRoutes.post('/change-password', authenticate, authRateLimiter, authController.changePassword);
authRoutes.post('/request-password-reset', authRateLimiter, authController.requestPasswordReset);
authRoutes.post('/reset-password', authRateLimiter, authController.resetPassword);
