import type { Request, RequestHandler, Response } from 'express';
import {
  createCustomerSchema,
  idParamsSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { customersService } from './customers.service.js';

export const customersController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listCustomersQuerySchema, req.query);
    const { items, meta } = await customersService.list(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await customersService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,

  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createCustomerSchema, req.body);
    const customer = await customersService.create(auth.user.companyId, input, auth.user.id);
    return sendCreated(res, customer);
  }) satisfies RequestHandler,

  update: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const input = parseOrThrow(updateCustomerSchema, req.body);
    return sendOk(
      res,
      await customersService.update(auth.user.companyId, id, input, auth.user.id),
    );
  }) satisfies RequestHandler,
};
