import type { Request, RequestHandler, Response } from 'express';
import {
  createCategorySchema,
  idParamsSchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { categoriesService } from './categories.service.js';

export const categoriesController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listCategoriesQuerySchema, req.query);
    const { items, meta } = await categoriesService.list(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await categoriesService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,

  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createCategorySchema, req.body);
    const category = await categoriesService.create(auth.user.companyId, input, auth.user.id);
    return sendCreated(res, category);
  }) satisfies RequestHandler,

  update: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const input = parseOrThrow(updateCategorySchema, req.body);
    return sendOk(
      res,
      await categoriesService.update(auth.user.companyId, id, input, auth.user.id),
    );
  }) satisfies RequestHandler,
};
