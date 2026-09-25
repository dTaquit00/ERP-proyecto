import type { Request, RequestHandler, Response } from 'express';
import { createPurchaseSchema, idParamsSchema, listPurchasesQuerySchema, receiptIdempotencyKeySchema, receivePurchaseSchema } from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { purchasesService } from './purchases.service.js';

function actor(req: Request) {
  const auth = requireAuth(req);
  return { id: auth.user.id, name: `${auth.user.firstName} ${auth.user.lastName}` };
}

export const purchasesController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const result = await purchasesService.list(auth.user.companyId, parseOrThrow(listPurchasesQuerySchema, req.query));
    return sendPaginated(res, result.items, result.meta);
  }) satisfies RequestHandler,
  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await purchasesService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,
  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    return sendCreated(res, await purchasesService.create(auth.user.companyId, parseOrThrow(createPurchaseSchema, req.body), actor(req)));
  }) satisfies RequestHandler,
  confirm: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await purchasesService.confirm(auth.user.companyId, id, actor(req)));
  }) satisfies RequestHandler,
  receive: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const idempotencyKeyHeader = req.get('Idempotency-Key');
    const idempotencyKey = idempotencyKeyHeader
      ? parseOrThrow(receiptIdempotencyKeySchema, idempotencyKeyHeader)
      : undefined;
    return sendOk(res, await purchasesService.receive(
      auth.user.companyId,
      id,
      parseOrThrow(receivePurchaseSchema, req.body),
      actor(req),
      idempotencyKey,
    ));
  }) satisfies RequestHandler,
  cancel: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await purchasesService.cancel(auth.user.companyId, id, actor(req)));
  }) satisfies RequestHandler,
  returnPurchase: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await purchasesService.returnPurchase(auth.user.companyId, id, actor(req)));
  }) satisfies RequestHandler,
};
