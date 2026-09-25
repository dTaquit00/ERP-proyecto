import type { Request, RequestHandler, Response } from 'express';
import {
  createMovementSchema,
  idParamsSchema,
  listMovementsQuerySchema,
  listStockQuerySchema,
  updateStockSchema,
} from '@erp/validation';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendCreated, sendOk, sendPaginated } from '../../shared/http/response.js';
import { ForbiddenError } from '../../shared/http/errors.js';
import { inventoryService } from './inventory.service.js';

export const inventoryController = {
  listStock: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listStockQuerySchema, req.query);
    const { items, meta } = await inventoryService.listStock(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  getStock: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await inventoryService.getStock(auth.user.companyId, id));
  }) satisfies RequestHandler,

  updateStock: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    const input = parseOrThrow(updateStockSchema, req.body);
    return sendOk(res, await inventoryService.updateStock(auth.user.companyId, id, input, auth.user.id));
  }) satisfies RequestHandler,

  listMovements: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const query = parseOrThrow(listMovementsQuerySchema, req.query);
    const { items, meta } = await inventoryService.listMovements(auth.user.companyId, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  getMovement: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const { id } = parseOrThrow(idParamsSchema, req.params);
    return sendOk(res, await inventoryService.getMovement(auth.user.companyId, id));
  }) satisfies RequestHandler,

  /**
   * Alta de movimiento. `inventory.write` lo exige la ruta; el permiso extra
   * `inventory.transfer` se verifica aquí porque depende del cuerpo (type).
   */
  createMovement: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(createMovementSchema, req.body);
    if (input.type === 'ADJUSTMENT' && !auth.permissions.includes('inventory.adjust')) {
      throw new ForbiddenError('No tienes permiso para ajustar existencias', 'INSUFFICIENT_PERMISSIONS');
    }
    const movement = await inventoryService.createMovement(auth.user.companyId, input, {
      id: auth.user.id,
      name: `${auth.user.firstName} ${auth.user.lastName}`.trim(),
      canTransfer: auth.permissions.includes('inventory.transfer'),
    });
    return sendCreated(res, movement);
  }) satisfies RequestHandler,
};
