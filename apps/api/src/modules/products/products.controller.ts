import type { Request, RequestHandler, Response } from 'express';
import {
  createProductSchema,
  idParamsSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { productsService } from './products.service.js';

export const productsController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listProductsQuerySchema, req.query);
    const { items, meta } = await productsService.list(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await productsService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,

  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createProductSchema, req.body);
    const product = await productsService.create(auth.user.companyId, input, auth.user.id);
    return sendCreated(res, product);
  }) satisfies RequestHandler,

  update: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const input = parseOrThrow(updateProductSchema, req.body);
    return sendOk(res, await productsService.update(auth.user.companyId, id, input, auth.user.id));
  }) satisfies RequestHandler,
};
