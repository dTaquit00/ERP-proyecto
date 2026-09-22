import type { Request, RequestHandler, Response } from 'express';
import {
  createSupplierSchema,
  idParamsSchema,
  listSuppliersQuerySchema,
  updateSupplierSchema,
} from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { suppliersService } from './suppliers.service.js';

export const suppliersController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listSuppliersQuerySchema, req.query);
    const { items, meta } = await suppliersService.list(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await suppliersService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,

  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createSupplierSchema, req.body);
    const supplier = await suppliersService.create(auth.user.companyId, input, auth.user.id);
    return sendCreated(res, supplier);
  }) satisfies RequestHandler,

  update: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const input = parseOrThrow(updateSupplierSchema, req.body);
    return sendOk(
      res,
      await suppliersService.update(auth.user.companyId, id, input, auth.user.id),
    );
  }) satisfies RequestHandler,
};
