import type { Request, RequestHandler, Response } from 'express';
import {
  createWarehouseSchema,
  idParamsSchema,
  listStockQuerySchema,
  listWarehousesQuerySchema,
  updateWarehouseSchema,
} from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { warehousesService } from './warehouses.service.js';
import { inventoryService } from '../inventory/inventory.service.js';

export const warehousesController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listWarehousesQuerySchema, req.query);
    const { items, meta } = await warehousesService.list(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  get: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await warehousesService.get(auth.user.companyId, id));
  }) satisfies RequestHandler,

  create: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createWarehouseSchema, req.body);
    const warehouse = await warehousesService.create(auth.user.companyId, input, auth.user.id);
    return sendCreated(res, warehouse);
  }) satisfies RequestHandler,

  update: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const input = parseOrThrow(updateWarehouseSchema, req.body);
    return sendOk(res, await warehousesService.update(auth.user.companyId, id, input, auth.user.id));
  }) satisfies RequestHandler,

  /** Consulta de inventario de UN almacén (M10): lista de existencias paginada. */
  inventory: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    // El :id del path manda sobre un warehouseId llegado en la query.
    const query = { ...parseOrThrow(listStockQuerySchema, req.query), warehouseId: id };
    // 404 multiempresa ANTES de consultar stock.
    await warehousesService.get(auth.user.companyId, id);
    const { items, meta } = await inventoryService.listStock(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,
};
