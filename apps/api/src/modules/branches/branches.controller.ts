import type { Request, RequestHandler, Response } from 'express';
import { branchIdParamsSchema, createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { branchesService } from './branches.service.js';

export const branchesController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listBranchesQuerySchema, req.query);
    const result = await branchesService.list(auth.user.companyId, query);
    return sendPaginated(res, result.items, result.meta);
  }) satisfies RequestHandler,
  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(branchIdParamsSchema, req.params);
    return sendOk(res, await branchesService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,
  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createBranchSchema, req.body);
    return sendCreated(res, await branchesService.create(auth.user.companyId, input));
  }) satisfies RequestHandler,
  update: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(branchIdParamsSchema, req.params);
    const input = parseOrThrow(updateBranchSchema, req.body);
    return sendOk(res, await branchesService.update(auth.user.companyId, id, input));
  }) satisfies RequestHandler,
};
