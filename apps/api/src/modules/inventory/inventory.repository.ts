import { Types, type ClientSession, type FilterQuery } from 'mongoose';
import type { ListMovementsQueryInput, ListStockQueryInput } from '@erp/validation';
import {
  InventoryMovementModel,
  StockBalanceModel,
  type InventoryMovementDocument,
  type InventoryMovementSchemaType,
  type StockBalanceDocument,
  type StockBalanceSchemaType,
} from './inventory.model.js';
import type {
  MovementListResult,
  MovementPersistInput,
  StockListResult,
} from './inventory.types.js';

interface StockScope {
  companyId: string;
  warehouseId: string;
  productId: string;
}

function stockScopeFilter(scope: StockScope): FilterQuery<StockBalanceSchemaType> {
  return {
    companyId: new Types.ObjectId(scope.companyId),
    warehouseId: new Types.ObjectId(scope.warehouseId),
    productId: new Types.ObjectId(scope.productId),
  };
}

/**
 * Filtro de listado de existencias. El scope multiempresa SIEMPRE se aplica:
 * el filtro del cliente nunca puede ampliar el alcance.
 * `low` = tiene umbral definido y la cantidad está por debajo (incluye 0).
 */
export function buildStockFilter(
  companyId: string,
  query: ListStockQueryInput,
  branchWarehouseIds?: string[],
): FilterQuery<StockBalanceSchemaType> {
  const filter: FilterQuery<StockBalanceSchemaType> = {
    companyId: new Types.ObjectId(companyId),
  };
  if (query.warehouseId) filter.warehouseId = new Types.ObjectId(query.warehouseId);
  if (branchWarehouseIds) {
    const branchIds = branchWarehouseIds.map((id) => new Types.ObjectId(id));
    if (query.warehouseId) {
      filter.warehouseId = branchIds.some((id) => id.equals(query.warehouseId))
        ? new Types.ObjectId(query.warehouseId)
        : { $in: [] };
    } else {
      filter.warehouseId = { $in: branchIds };
    }
  }
  if (query.productId) filter.productId = new Types.ObjectId(query.productId);
  if (query.availability === 'in_stock') filter.quantity = { $gt: 0 };
  else if (query.availability === 'out_of_stock') filter.quantity = 0;
  else if (query.availability === 'low') {
    filter.$expr = { $and: [{ $gt: ['$minStock', 0] }, { $lt: ['$quantity', '$minStock'] }] };
  }
  return filter;
}

/** Filtro de listado de movimientos (histórico) con scope multiempresa. */
export function buildMovementFilter(
  companyId: string,
  query: ListMovementsQueryInput,
  branchWarehouseIds?: string[],
): FilterQuery<InventoryMovementSchemaType> {
  const filter: FilterQuery<InventoryMovementSchemaType> = {
    companyId: new Types.ObjectId(companyId),
  };
  if (query.warehouseId) {
    const warehouseId = new Types.ObjectId(query.warehouseId);
    filter.$or = [{ warehouseId }, { toWarehouseId: warehouseId }];
  }
  if (branchWarehouseIds) {
    const branchIds = branchWarehouseIds.map((id) => new Types.ObjectId(id));
    const selectedWarehouseBelongsToBranch = !query.warehouseId || branchIds.some((id) => id.equals(query.warehouseId));
    const warehouseIds = query.warehouseId
      ? selectedWarehouseBelongsToBranch ? [new Types.ObjectId(query.warehouseId)] : []
      : branchIds;
    filter.$or = [
      { warehouseId: { $in: warehouseIds } },
      { toWarehouseId: { $in: warehouseIds } },
    ];
  }
  if (query.productId) filter.productId = new Types.ObjectId(query.productId);
  if (query.type) filter.type = query.type;
  return filter;
}

export const inventoryRepository = {
  // ── Existencias ──────────────────────────────────────────────────────────

  async findBalanceById(id: string): Promise<StockBalanceDocument | null> {
    return StockBalanceModel.findById(id).exec();
  },

  async listStock(
    companyId: string,
    query: ListStockQueryInput,
    branchWarehouseIds?: string[],
  ): Promise<StockListResult> {
    const filter = buildStockFilter(companyId, query, branchWarehouseIds);
    const sort: Record<string, 1 | -1> = {
      [query.sort]: query.order === 'asc' ? 1 : -1,
    };
    const skip = (query.page - 1) * query.limit;

    const [balances, total] = await Promise.all([
      StockBalanceModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      StockBalanceModel.countDocuments(filter).exec(),
    ]);
    return { balances, total };
  },

  /**
   * Crea la existencia con cantidad 0 si aún no existe (idempotente).
   * `session` opcional: operación dentro de una transacción (Fase 11+).
   */
  async ensureBalance(scope: StockScope, session?: ClientSession): Promise<StockBalanceDocument> {
    const balance = await StockBalanceModel.findOneAndUpdate(
      stockScopeFilter(scope),
      { $setOnInsert: { quantity: 0, minStock: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true, session },
    ).exec();
    if (!balance) throw new Error('No se pudo asegurar la existencia');
    return balance;
  },

  /** Suma (+delta) a la existencia; devuelve el documento actualizado. */
  async increaseQuantity(
    scope: StockScope,
    delta: number,
    session?: ClientSession,
  ): Promise<StockBalanceDocument> {
    const balance = await StockBalanceModel.findOneAndUpdate(
      stockScopeFilter(scope),
      { $inc: { quantity: delta } },
      { new: true, session },
    ).exec();
    if (!balance) throw new Error('La existencia no existe');
    return balance;
  },

  /**
   * Resta solo si hay existencias suficientes (filtro condicional atómico:
   * bajo concurrencia el stock nunca queda negativo). `null` = stock insuficiente.
   */
  async tryDecreaseQuantity(
    scope: StockScope,
    quantity: number,
    session?: ClientSession,
  ): Promise<StockBalanceDocument | null> {
    return StockBalanceModel.findOneAndUpdate(
      { ...stockScopeFilter(scope), quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      { new: true, session },
    ).exec();
  },

  /** Fija la cantidad absoluta (recuento físico de ADJUSTMENT). */
  async setQuantity(
    scope: StockScope,
    quantity: number,
    session?: ClientSession,
  ): Promise<StockBalanceDocument> {
    const balance = await StockBalanceModel.findOneAndUpdate(
      stockScopeFilter(scope),
      { $set: { quantity } },
      { new: true, session },
    ).exec();
    if (!balance) throw new Error('La existencia no existe');
    return balance;
  },

  async saveMinStock(
    balance: StockBalanceDocument,
    minStock: number,
  ): Promise<StockBalanceDocument> {
    balance.minStock = minStock;
    await balance.save();
    return balance;
  },

  // ── Movimientos (histórico inmutable) ────────────────────────────────────

  async findMovementById(id: string): Promise<InventoryMovementDocument | null> {
    return InventoryMovementModel.findById(id).exec();
  },

  async listMovements(
    companyId: string,
    query: ListMovementsQueryInput,
    branchWarehouseIds?: string[],
  ): Promise<MovementListResult> {
    const filter = buildMovementFilter(companyId, query, branchWarehouseIds);
    const sort: Record<string, 1 | -1> = {
      [query.sort]: query.order === 'asc' ? 1 : -1,
    };
    const skip = (query.page - 1) * query.limit;

    const [movements, total] = await Promise.all([
      InventoryMovementModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      InventoryMovementModel.countDocuments(filter).exec(),
    ]);
    return { movements, total };
  },

  async createMovement(
    input: MovementPersistInput,
    session?: ClientSession,
  ): Promise<InventoryMovementDocument> {
    const movement = new InventoryMovementModel(input);
    await movement.save({ session });
    return movement;
  },
};
