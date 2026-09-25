import type { Request, RequestHandler, Response } from 'express';
import { dashboardQuerySchema } from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendOk } from '../../shared/http/response.js';
import { dashboardService } from './dashboard.service.js';

export const dashboardController = {
  summary: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    return sendOk(res, await dashboardService.summary(auth.user.companyId, parseOrThrow(dashboardQuerySchema, req.query)));
  }) satisfies RequestHandler,
};
