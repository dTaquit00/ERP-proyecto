import type { Request, RequestHandler, Response } from 'express';
import {
  createRoleSchema,
  idParamsSchema,
  listRolesQuerySchema,
  updateRoleSchema,
} from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { rolesService } from './roles.service.js';

export const rolesController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listRolesQuerySchema, req.query);
    const { items, meta } = await rolesService.list(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await rolesService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,

  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createRoleSchema, req.body);
    const role = await rolesService.create(auth.user.companyId, input, auth.user.id);
    return sendCreated(res, role);
  }) satisfies RequestHandler,

  update: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const input = parseOrThrow(updateRoleSchema, req.body);
    return sendOk(res, await rolesService.update(auth.user.companyId, id, input, auth.user.id));
  }) satisfies RequestHandler,

  remove: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    await rolesService.remove(auth.user.companyId, id, auth.user.id);
    return sendOk(res, { id, deleted: true });
  }) satisfies RequestHandler,
};
