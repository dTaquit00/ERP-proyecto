import type { Request, RequestHandler, Response } from 'express';
import { createSaleSchema, idParamsSchema, listSalesQuerySchema } from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { salesService } from './sales.service.js';
import type { SaleActor } from './sales.types.js';

/** Actor de la venta: id + nombre "foto" para snapshots e historial. */
function saleActor(req: Request): SaleActor {
  const auth = requireAuth(req);
  return {
    id: auth.user.id,
    name: `${auth.user.firstName} ${auth.user.lastName}`.trim(),
  };
}

export const salesController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listSalesQuerySchema, req.query);
    const { items, meta } = await salesService.list(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await salesService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,

  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createSaleSchema, req.body);
    const sale = await salesService.create(auth.user.companyId, input, saleActor(req));
    return sendCreated(res, sale);
  }) satisfies RequestHandler,

  confirm: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await salesService.confirm(auth.user.companyId, id, saleActor(req)));
  }) satisfies RequestHandler,

  cancel: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await salesService.cancel(auth.user.companyId, id, saleActor(req)));
  }) satisfies RequestHandler,

  returnSale: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await salesService.returnSale(auth.user.companyId, id, saleActor(req)));
  }) satisfies RequestHandler,
};
