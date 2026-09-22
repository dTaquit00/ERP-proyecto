import type {
  InventoryMovementResponse,
  MovementType,
  PaginationMeta,
  StockBalanceResponse,
} from '@erp/types';
import type {
  CreateMovementInput,
  ListMovementsQueryInput,
  ListStockQueryInput,
  UpdateStockInput,
} from '@erp/validation';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/http/errors.js';
import { logger } from '../../config/logger.js';
import { inventoryRepository } from './inventory.repository.js';
import type {
  InventoryMovementDocument,
  StockBalanceDocument,
} from './inventory.model.js';
import type { MovementActor } from './inventory.types.js';
import { productsRepository } from '../products/products.repository.js';
import { warehousesRepository } from '../warehouses/warehouses.repository.js';
import { requireWarehouseInCompany } from '../warehouses/warehouses.service.js';

/** Fallback si un nombre "foto" del histórico no puede resolverse (BD alterada). */
export const UNKNOWN_NAME = 'desconocido';

export type MovementEffect = 'increase' | 'decrease' | 'set';

/**
 * Reglas puras de un movimiento (unit-testeadas sin BD):
 * IN/RETURN suman, OUT/TRANSFER restan (≥ 1), ADJUSTMENT fija el recuento
 * absoluto (admite 0 para dejar el almacén vacío).
 */
export function movementEffect(type: MovementType, quantity: number): MovementEffect {
  if (type !== 'ADJUSTMENT' && quantity < 1) {
    throw new ValidationError('La cantidad debe ser al menos 1 para este tipo de movimiento');
  }
  switch (type) {
    case 'IN':
    case 'RETURN':
      return 'increase';
    case 'OUT':
    case 'TRANSFER':
      return 'decrease';
    case 'ADJUSTMENT':
      return 'set';
  }
}

export function toStockResponse(
  balance: StockBalanceDocument,
  warehouseName: string,
  productName: string,
  productSku: string,
): StockBalanceResponse {
  return {
    id: balance.id,
    companyId: balance.companyId.toString(),
    warehouseId: balance.warehouseId.toString(),
    warehouseName,
    productId: balance.productId.toString(),
    productName,
    productSku,
    quantity: balance.quantity,
    minStock: balance.minStock,
    lowStock: balance.minStock > 0 && balance.quantity < balance.minStock,
    createdAt: balance.createdAt ? balance.createdAt.toISOString() : null,
    updatedAt: balance.updatedAt ? balance.updatedAt.toISOString() : null,
  };
}

export function toMovementResponse(
  movement: InventoryMovementDocument,
): InventoryMovementResponse {
  return {
    id: movement.id,
    companyId: movement.companyId.toString(),
    type: movement.type,
    warehouseId: movement.warehouseId.toString(),
    warehouseName: movement.warehouseName,
    toWarehouseId: movement.toWarehouseId ? movement.toWarehouseId.toString() : null,
    toWarehouseName: movement.toWarehouseName ?? null,
    productId: movement.productId.toString(),
    productName: movement.productName,
    productSku: movement.productSku,
    quantity: movement.quantity,
    quantityAfter: movement.quantityAfter,
    reason: movement.reason ?? null,
    documentRef: movement.documentRef ?? null,
    userId: movement.userId.toString(),
    userName: movement.userName,
    createdAt: movement.createdAt ? movement.createdAt.toISOString() : null,
    updatedAt: movement.updatedAt ? movement.updatedAt.toISOString() : null,
  };
}

/** Nombres actuales de almacén/producto para las existencias (una consulta por tipo). */
async function stockNameMaps(
  companyId: string,
  balances: StockBalanceDocument[],
): Promise<{
  warehouseNames: Map<string, string>;
  productInfos: Map<string, { name: string; sku: string }>;
}> {
  const warehouseIds = [...new Set(balances.map((b) => b.warehouseId.toString()))];
  const productIds = [...new Set(balances.map((b) => b.productId.toString()))];
  const [warehouses, products] = await Promise.all([
    warehousesRepository.findManyByIds(companyId, warehouseIds),
    productsRepository.findManyByIds(companyId, productIds),
  ]);
  return {
    warehouseNames: new Map(warehouses.map((w) => [w.id, w.name])),
    productInfos: new Map(products.map((p) => [p.id, { name: p.name, sku: p.sku }])),
  };
}

/** Compensación best-effort: nunca enmascara el error original. */
async function safeRollback(rollback?: () => Promise<void>): Promise<void> {
  if (!rollback) return;
  try {
    await rollback();
  } catch (rollbackError) {
    logger.error({ err: rollbackError }, 'No se pudo compensar el cambio de stock');
  }
}

/** Detalle de una existencia con scope + nombres (compartido por get/update). */
async function getStockResponse(companyId: string, id: string): Promise<StockBalanceResponse> {
  const balance = await inventoryRepository.findBalanceById(id);
  if (!balance || balance.companyId.toString() !== companyId) {
    throw new NotFoundError('Existencia no encontrada');
  }
  const maps = await stockNameMaps(companyId, [balance]);
  const product = maps.productInfos.get(balance.productId.toString());
  return toStockResponse(
    balance,
    maps.warehouseNames.get(balance.warehouseId.toString()) ?? UNKNOWN_NAME,
    product?.name ?? UNKNOWN_NAME,
    product?.sku ?? UNKNOWN_NAME,
  );
}

function stockScope(companyId: string, warehouseId: string, productId: string) {
  return { companyId, warehouseId, productId };
}

export const inventoryService = {
  // ── Existencias ──────────────────────────────────────────────────────────

  async listStock(
    companyId: string,
    query: ListStockQueryInput,
  ): Promise<{ items: StockBalanceResponse[]; meta: PaginationMeta }> {
    const { balances, total } = await inventoryRepository.listStock(companyId, query);
    const maps = await stockNameMaps(companyId, balances);
    return {
      items: balances.map((balance) => {
        const id = balance.productId.toString();
        const product = maps.productInfos.get(id);
        return toStockResponse(
          balance,
          maps.warehouseNames.get(balance.warehouseId.toString()) ?? UNKNOWN_NAME,
          product?.name ?? UNKNOWN_NAME,
          product?.sku ?? UNKNOWN_NAME,
        );
      }),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async getStock(companyId: string, id: string): Promise<StockBalanceResponse> {
    return getStockResponse(companyId, id);
  },

  async updateStock(
    companyId: string,
    id: string,
    input: UpdateStockInput,
    actorId: string,
  ): Promise<StockBalanceResponse> {
    const balance = await inventoryRepository.findBalanceById(id);
    if (!balance || balance.companyId.toString() !== companyId) {
      throw new NotFoundError('Existencia no encontrada');
    }
    await inventoryRepository.saveMinStock(balance, input.minStock);
    logger.info({ balanceId: balance.id, actorId, minStock: input.minStock }, 'Mínimo de stock actualizado');
    return getStockResponse(companyId, id);
  },

  // ── Movimientos ──────────────────────────────────────────────────────────

  async listMovements(
    companyId: string,
    query: ListMovementsQueryInput,
  ): Promise<{ items: InventoryMovementResponse[]; meta: PaginationMeta }> {
    const { movements, total } = await inventoryRepository.listMovements(companyId, query);
    return {
      items: movements.map(toMovementResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async getMovement(companyId: string, id: string): Promise<InventoryMovementResponse> {
    const movement = await inventoryRepository.findMovementById(id);
    if (!movement || movement.companyId.toString() !== companyId) {
      throw new NotFoundError('Movimiento no encontrado');
    }
    return toMovementResponse(movement);
  },

  /**
   * Registra un movimiento y actualiza el stock de forma correlacionada.
   *
   * Orden: se calcula el stock resultante con una actualización atómica
   * (el OUT usa filtro `quantity >= q`, así el stock nunca queda negativo) y
   * después se persiste el movimiento; si el insert falla se compensa el stock.
   * La atomicidad multi-documento completa llega con transacciones (Fase 11–12).
   */
  async createMovement(
    companyId: string,
    input: CreateMovementInput,
    actor: MovementActor,
  ): Promise<InventoryMovementResponse> {
    // TRANSFER exige el permiso específico `inventory.transfer` además de write.
    if (input.type === 'TRANSFER' && !actor.canTransfer) {
      throw new ForbiddenError(
        'No tienes permisos para transferir entre almacenes',
        'INSUFFICIENT_PERMISSIONS',
      );
    }

    const warehouse = await requireWarehouseInCompany(companyId, input.warehouseId);
    // Regla: un almacén desactivado admite recuentos (ADJUSTMENT) para cerrar,
    // pero no entradas/salidas nuevas.
    if (input.type !== 'ADJUSTMENT' && !warehouse.isActive) {
      throw new ConflictError('El almacén está desactivado', 'WAREHOUSE_DISABLED');
    }

    let toWarehouseName: string | undefined;
    let toWarehouseId: string | undefined;
    if (input.type === 'TRANSFER') {
      if (!input.toWarehouseId) {
        throw new ValidationError('TRANSFER requiere un almacén de destino');
      }
      if (input.toWarehouseId === input.warehouseId) {
        throw new ValidationError('El almacén de destino debe ser distinto del origen');
      }
      const toWarehouse = await requireWarehouseInCompany(companyId, input.toWarehouseId);
      if (!toWarehouse.isActive) {
        throw new ConflictError('El almacén de destino está desactivado', 'WAREHOUSE_DISABLED');
      }
      toWarehouseName = toWarehouse.name;
      toWarehouseId = toWarehouse.id;
    }

    const product = await productsRepository.findById(input.productId);
    if (!product || product.companyId.toString() !== companyId) {
      throw new BadRequestError('El producto indicado no existe', 'PRODUCT_NOT_FOUND');
    }

    const effect = movementEffect(input.type, input.quantity);
    const originScope = stockScope(companyId, warehouse.id, product.id);
    const existing = await inventoryRepository.ensureBalance(originScope);

    let quantityAfter: number;
    let rollback: (() => Promise<void>) | undefined;

    switch (effect) {
      case 'increase': {
        const updated = await inventoryRepository.increaseQuantity(originScope, input.quantity);
        quantityAfter = updated.quantity;
        rollback = async () => {
          await inventoryRepository.tryDecreaseQuantity(originScope, input.quantity);
        };
        break;
      }
      case 'decrease': {
        const updated = await inventoryRepository.tryDecreaseQuantity(
          originScope,
          input.quantity,
        );
        if (!updated) {
          throw new ConflictError('Existencias insuficientes', 'INSUFFICIENT_STOCK');
        }
        quantityAfter = updated.quantity;
        rollback = async () => {
          await inventoryRepository.increaseQuantity(originScope, input.quantity);
        };
        break;
      }
      case 'set': {
        const previousQuantity = existing.quantity;
        const updated = await inventoryRepository.setQuantity(originScope, input.quantity);
        quantityAfter = updated.quantity;
        rollback = async () => {
          await inventoryRepository.setQuantity(originScope, previousQuantity);
        };
        break;
      }
    }

    if (input.type === 'TRANSFER' && toWarehouseId) {
      const destScope = stockScope(companyId, toWarehouseId, product.id);
      try {
        await inventoryRepository.ensureBalance(destScope);
        await inventoryRepository.increaseQuantity(destScope, input.quantity);
      } catch (error) {
        await safeRollback(rollback);
        throw error;
      }
      const originRollback = rollback;
      rollback = async () => {
        if (originRollback) await originRollback();
        await inventoryRepository.tryDecreaseQuantity(destScope, input.quantity);
      };
    }

    let movement: InventoryMovementDocument;
    try {
      movement = await inventoryRepository.createMovement({
        companyId,
        type: input.type,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        toWarehouseId,
        toWarehouseName,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: input.quantity,
        quantityAfter,
        reason: input.reason,
        documentRef: input.documentRef,
        userId: actor.id,
        userName: actor.name,
      });
    } catch (error) {
      await safeRollback(rollback);
      throw error;
    }

    logger.info(
      {
        movementId: movement.id,
        type: input.type,
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: input.quantity,
        quantityAfter,
        actorId: actor.id,
      },
      'Movimiento de inventario registrado',
    );
    return toMovementResponse(movement);
  },
};
