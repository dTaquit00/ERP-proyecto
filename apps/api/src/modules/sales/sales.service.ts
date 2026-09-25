import type { PaginationMeta, ProductTax, SaleResponse, SaleTax } from '@erp/types';
import type { CreateSaleInput, ListSalesQueryInput } from '@erp/validation';
import type { ClientSession } from 'mongoose';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/http/errors.js';
import { withTransaction } from '../../shared/db/transaction.js';
import { logger } from '../../config/logger.js';
import { salesRepository } from './sales.repository.js';
import type { SaleDocument } from './sales.model.js';
import type { ResolvedSaleItem, SaleActor, SaleCreatePersistInput } from './sales.types.js';
import { customersRepository } from '../customers/customers.repository.js';
import { productsRepository } from '../products/products.repository.js';
import { assertWarehouseBranch, requireWarehouseInCompany } from '../warehouses/warehouses.service.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { requireBranchInCompany } from '../branches/branches.service.js';

/** Redondeo monetario a 2 decimales. Puro: base de los cálculos unit-testeados. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface LineTotalsInput {
  unitPrice: number;
  quantity: number;
  discount: number;
  taxes: ProductTax[];
}

export interface LineTotals {
  subtotal: number;
  discountAmount: number;
  taxes: SaleTax[];
  total: number;
}

/**
 * Totales de una línea, calculados SIEMPRE en backend (M12): el precio unitario
 * proviene del catálogo y el descuento (0–100%) se aplica antes de los impuestos.
 * Función pura, unit-testeada sin base de datos.
 */
export function computeLineTotals(input: LineTotalsInput): LineTotals {
  const subtotal = roundMoney(input.unitPrice * input.quantity);
  const discountAmount = roundMoney(subtotal * (input.discount / 100));
  const taxable = subtotal - discountAmount; // ambos con 2 decimales: diferencia exacta
  const taxes = input.taxes.map((tax) => ({
    name: tax.name,
    rate: tax.rate,
    amount: roundMoney(taxable * (tax.rate / 100)),
  }));
  const total = roundMoney(taxable + taxes.reduce((sum, tax) => sum + tax.amount, 0));
  return { subtotal, discountAmount, taxes, total };
}

/** Agrega los impuestos de las líneas por (nombre, tasa) para la cabecera. */
export function aggregateTaxes(items: Array<{ taxes: SaleTax[] }>): SaleTax[] {
  const byKey = new Map<string, SaleTax>();
  for (const item of items) {
    for (const tax of item.taxes) {
      const key = `${tax.name}|${tax.rate}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.amount = roundMoney(existing.amount + tax.amount);
      } else {
        byKey.set(key, { ...tax });
      }
    }
  }
  return [...byKey.values()];
}

export function toSaleResponse(sale: SaleDocument): SaleResponse {
  return {
    id: sale.id,
    companyId: sale.companyId.toString(),
    customerId: sale.customerId.toString(),
    customerName: sale.customerName,
    userId: sale.userId.toString(),
    userName: sale.userName,
    warehouseId: sale.warehouseId.toString(),
    warehouseName: sale.warehouseName,
    branchId: sale.branchId ? sale.branchId.toString() : null,
    saleDate: sale.saleDate.toISOString(), // requerido en el modelo
    status: sale.status,
    notes: sale.notes || null,
    items: (sale.items ?? []).map((item) => ({
      productId: item.productId.toString(),
      productSku: item.productSku,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      subtotal: item.subtotal,
      discountAmount: item.discountAmount,
      taxes: (item.taxes ?? []).map((tax) => ({
        name: tax.name,
        rate: tax.rate,
        amount: tax.amount,
      })),
      total: item.total,
    })),
    subtotal: sale.subtotal,
    discountTotal: sale.discountTotal,
    taxes: (sale.taxes ?? []).map((tax) => ({
      name: tax.name,
      rate: tax.rate,
      amount: tax.amount,
    })),
    total: sale.total,
    history: (sale.history ?? []).map((event) => ({
      action: event.action,
      at: event.at.toISOString(),
      userId: event.userId.toString(),
      userName: event.userName,
    })),
    confirmedAt: sale.confirmedAt ? sale.confirmedAt.toISOString() : null,
    cancelledAt: sale.cancelledAt ? sale.cancelledAt.toISOString() : null,
    returnedAt: sale.returnedAt ? sale.returnedAt.toISOString() : null,
    createdAt: sale.createdAt ? sale.createdAt.toISOString() : null,
    updatedAt: sale.updatedAt ? sale.updatedAt.toISOString() : null,
  };
}

/** El recurso debe pertenecer a la empresa del actor; si no, 404 (no se filtra su existencia). */
async function findScopedOr404(companyId: string, id: string): Promise<SaleDocument> {
  const sale = await salesRepository.findById(id);
  if (!sale || sale.companyId.toString() !== companyId) {
    throw new NotFoundError('Venta no encontrada');
  }
  return sale;
}

/**
 * Movimientos RETURN que reponen el stock de la venta en su almacén
 * (cancelación de confirmada y devoluciones). Se ejecutan DENTRO de la
 * transacción de la transición: si algo falla, la transacción revierte todo.
 */
async function restockItems(
  companyId: string,
  sale: SaleDocument,
  reason: string,
  actor: SaleActor,
  session: ClientSession,
): Promise<void> {
  for (const item of sale.items) {
    await inventoryService.createMovement(
      companyId,
      {
        type: 'RETURN',
        warehouseId: sale.warehouseId.toString(),
        productId: item.productId.toString(),
        quantity: item.quantity,
        reason,
        documentRef: `SALE:${sale.id}`,
      },
      { id: actor.id, name: actor.name, canTransfer: false },
      session,
    );
  }
}

function movementActor(actor: SaleActor) {
  return { id: actor.id, name: actor.name, canTransfer: false };
}

export const salesService = {
  async list(
    companyId: string,
    query: ListSalesQueryInput,
  ): Promise<{ items: SaleResponse[]; meta: PaginationMeta }> {
    const { sales, total } = await salesRepository.list(companyId, query);
    return {
      items: sales.map(toSaleResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async get(companyId: string, id: string): Promise<SaleResponse> {
    return toSaleResponse(await findScopedOr404(companyId, id));
  },

  /**
   * Crea la venta en `pending` (sin efecto en stock). Valida referencias con
   * códigos propios y calcula precios/impuestos/totales desde el catálogo:
   * NUNCA confía en un precio enviado por el cliente.
   */
  async create(
    companyId: string,
    input: CreateSaleInput,
    actor: SaleActor,
  ): Promise<SaleResponse> {
    const customer = await customersRepository.findById(input.customerId);
    if (!customer || customer.companyId.toString() !== companyId) {
      throw new BadRequestError('El cliente indicado no existe', 'CUSTOMER_NOT_FOUND');
    }
    if (!customer.isActive) {
      throw new ConflictError('El cliente está desactivado', 'CUSTOMER_DISABLED');
    }

    const warehouse = await requireWarehouseInCompany(companyId, input.warehouseId);
    const branch = input.branchId ? await requireBranchInCompany(companyId, input.branchId) : undefined;
    if (branch && !branch.isActive) throw new ConflictError('La sucursal está desactivada', 'BRANCH_DISABLED');
    assertWarehouseBranch(warehouse, input.branchId);
    if (!warehouse.isActive) {
      throw new ConflictError('El almacén está desactivado', 'WAREHOUSE_DISABLED');
    }

    const products = await productsRepository.findManyByIds(
      companyId,
      input.items.map((line) => line.productId),
    );
    const productsById = new Map(products.map((product) => [product.id, product]));

    const items: ResolvedSaleItem[] = input.items.map((line) => {
      const product = productsById.get(line.productId);
      if (!product) {
        throw new BadRequestError('El producto indicado no existe', 'PRODUCT_NOT_FOUND');
      }
      if (!product.isActive) {
        throw new ConflictError('El producto está desactivado', 'PRODUCT_INACTIVE');
      }
      const totals = computeLineTotals({
        unitPrice: product.salePrice,
        quantity: line.quantity,
        discount: line.discount,
        taxes: product.taxes,
      });
      return {
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
        quantity: line.quantity,
        unitPrice: product.salePrice,
        discount: line.discount,
        ...totals,
      };
    });

    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));
    const discountTotal = roundMoney(items.reduce((sum, item) => sum + item.discountAmount, 0));
    const total = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
    const now = new Date();

    const persistInput: SaleCreatePersistInput = {
      companyId,
      customerId: customer.id,
      customerName: customer.name,
      userId: actor.id,
      userName: actor.name,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      branchId: input.branchId,
      saleDate: input.saleDate ?? now,
      notes: input.notes,
      items,
      subtotal,
      discountTotal,
      taxes: aggregateTaxes(items),
      total,
      history: [{ action: 'created', at: now, userId: actor.id, userName: actor.name }],
    };

    const sale = await salesRepository.create(persistInput);

    logger.info(
      { saleId: sale.id, actorId: actor.id, companyId, total },
      'Venta creada',
    );
    return toSaleResponse(sale);
  },

  /**
   * Confirma la venta `pending → confirmed` y debita el stock con movimientos
   * OUT, TODO en una única transacción: si no hay existencias (u otra regla
   * falla), la transacción se aborta y la venta queda intacta en `pending`.
   */
  async confirm(companyId: string, id: string, actor: SaleActor): Promise<SaleResponse> {
    const sale = await findScopedOr404(companyId, id);

    await withTransaction(async (session) => {
      const at = new Date();
      const claimed = await salesRepository.claimTransition(
        companyId,
        sale.id,
        ['pending'],
        {
          $set: { status: 'confirmed', confirmedAt: at },
          $push: { history: { action: 'confirmed', at, userId: actor.id, userName: actor.name } },
        },
        session,
      );
      if (!claimed) {
        throw new ConflictError(
          'La venta no está pendiente de confirmación',
          'INVALID_SALE_STATE',
        );
      }

      for (const item of sale.items) {
        await inventoryService.createMovement(
          companyId,
          {
            type: 'OUT',
            warehouseId: sale.warehouseId.toString(),
            productId: item.productId.toString(),
            quantity: item.quantity,
            reason: 'Confirmación de venta',
            documentRef: `SALE:${sale.id}`,
          },
          movementActor(actor),
          session,
        );
      }
    });

    logger.info({ saleId: sale.id, actorId: actor.id, companyId }, 'Venta confirmada');
    return toSaleResponse(await findScopedOr404(companyId, id));
  },

  /**
   * Cancela la venta (`pending` o `confirmed → cancelled`). Si estaba
   * confirmada, repone el stock con movimientos RETURN en la misma transacción.
   */
  async cancel(companyId: string, id: string, actor: SaleActor): Promise<SaleResponse> {
    const sale = await findScopedOr404(companyId, id);

    await withTransaction(async (session) => {
      const at = new Date();
      const previous = await salesRepository.claimTransition(
        companyId,
        sale.id,
        ['pending', 'confirmed'],
        {
          $set: { status: 'cancelled', cancelledAt: at },
          $push: { history: { action: 'cancelled', at, userId: actor.id, userName: actor.name } },
        },
        session,
      );
      if (!previous) {
        throw new ConflictError(
          'La venta solo puede cancelarse estando pendiente o confirmada',
          'INVALID_SALE_STATE',
        );
      }
      if (previous.status === 'confirmed') {
        await restockItems(companyId, sale, 'Cancelación de venta', actor, session);
      }
    });

    logger.info({ saleId: sale.id, actorId: actor.id, companyId }, 'Venta cancelada');
    return toSaleResponse(await findScopedOr404(companyId, id));
  },

  /**
   * Devolución de una venta `confirmed → returned`: repone el stock con
   * movimientos RETURN dentro de la misma transacción (M12: devolución).
   */
  async returnSale(companyId: string, id: string, actor: SaleActor): Promise<SaleResponse> {
    const sale = await findScopedOr404(companyId, id);

    await withTransaction(async (session) => {
      const at = new Date();
      const claimed = await salesRepository.claimTransition(
        companyId,
        sale.id,
        ['confirmed'],
        {
          $set: { status: 'returned', returnedAt: at },
          $push: { history: { action: 'returned', at, userId: actor.id, userName: actor.name } },
        },
        session,
      );
      if (!claimed) {
        throw new ConflictError(
          'Solo se puede devolver una venta confirmada',
          'INVALID_SALE_STATE',
        );
      }
      await restockItems(companyId, sale, 'Devolución de venta', actor, session);
    });

    logger.info({ saleId: sale.id, actorId: actor.id, companyId }, 'Venta devuelta');
    return toSaleResponse(await findScopedOr404(companyId, id));
  },
};
