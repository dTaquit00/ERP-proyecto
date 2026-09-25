import type { Request, RequestHandler, Response } from 'express';
import { idParamsSchema, listAuditQuerySchema } from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { NotFoundError } from '../../shared/http/errors.js';
import { sendOk, sendPaginated } from '../../shared/http/response.js';
import { auditService } from './audit.service.js';

export const auditController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const result = await auditService.list(auth.user.companyId, parseOrThrow(listAuditQuerySchema, req.query));
    return sendPaginated(res, result.items, result.meta);
  }) satisfies RequestHandler,
  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const item = await auditService.get(auth.user.companyId, id);
    if (!item) throw new NotFoundError('Registro de auditoría no encontrado');
    return sendOk(res, item);
  }) satisfies RequestHandler,
};
