import type { Request, RequestHandler, Response } from 'express';
import {
  createUserSchema,
  idParamsSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { usersService } from './users.service.js';

export const usersController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listUsersQuerySchema, req.query);
    const { items, meta } = await usersService.list(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await usersService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,

  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createUserSchema, req.body);
    const user = await usersService.create(auth.user.companyId, input, auth.user.id);
    return sendCreated(res, user);
  }) satisfies RequestHandler,

  update: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const input = parseOrThrow(updateUserSchema, req.body);
    return sendOk(res, await usersService.update(auth.user.companyId, id, input, auth.user.id));
  }) satisfies RequestHandler,

  activate: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await usersService.activate(auth.user.companyId, id, auth.user.id));
  }) satisfies RequestHandler,

  deactivate: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await usersService.deactivate(auth.user.companyId, id, auth.user.id));
  }) satisfies RequestHandler,

  history: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await usersService.history(auth.user.companyId, id));
  }) satisfies RequestHandler,
};
