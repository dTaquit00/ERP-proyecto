import type { Request, RequestHandler, Response } from 'express';
import {
  companyIdParamsSchema,
  createCompanySchema,
  listCompaniesQuerySchema,
  updateCompanySchema,
} from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { companiesService } from './companies.service.js';

export const companiesController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listCompaniesQuerySchema, req.query);
    const result = await companiesService.list(auth.user.companyId, query);
    return sendPaginated(res, result.items, result.meta);
  }) satisfies RequestHandler,

  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(companyIdParamsSchema, req.params);
    return sendOk(res, await companiesService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,

  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createCompanySchema, req.body);
    return sendCreated(res, await companiesService.create(auth.user.email, input));
  }) satisfies RequestHandler,

  update: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(companyIdParamsSchema, req.params);
    const input = parseOrThrow(updateCompanySchema, req.body);
    return sendOk(res, await companiesService.update(auth.user.companyId, id, input));
  }) satisfies RequestHandler,
};