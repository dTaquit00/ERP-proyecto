import { createHash } from 'node:crypto';
import type { PaginationMeta, PurchaseResponse, PurchaseTax } from '@erp/types';
import type { CreatePurchaseInput, ListPurchasesQueryInput, ReceivePurchaseInput } from '@erp/validation';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/http/errors.js';
import { withTransaction } from '../../shared/db/transaction.js';
import { suppliersRepository } from '../suppliers/suppliers.repository.js';
import { productsRepository } from '../products/products.repository.js';
import { assertWarehouseBranch, requireWarehouseInCompany } from '../warehouses/warehouses.service.js';
import { requireBranchInCompany } from '../branches/branches.service.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { purchasesRepository } from './purchases.repository.js';
import type { PurchaseDocument } from './purchases.model.js';
import type { PurchaseItemPersist } from './purchases.types.js';

export interface PurchaseActor { id: string; name: string; }

function roundMoney(value: number): number { return Math.round(value * 100) / 100; }

function calculateItem(input: CreatePurchaseInput['items'][number], product: { id: string; sku: string; name: string }): PurchaseItemPersist {
  const subtotal = roundMoney(input.unitCost * input.quantity);
  const discountAmount = roundMoney(subtotal * input.discount / 100);
  const taxable = subtotal - discountAmount;
  const taxes: PurchaseTax[] = input.taxes.map((tax) => ({
    name: tax.name,
    rate: tax.rate,
    amount: roundMoney(taxable * tax.rate / 100),
  }));
  return {
    productId: product.id,
    productSku: product.sku,
    productName: product.name,
    quantity: input.quantity,
    receivedQuantity: 0,
    unitCost: input.unitCost,
    discount: input.discount,
    discountAmount,
    taxes,
    subtotal,
    total: roundMoney(taxable + taxes.reduce((sum, tax) => sum + tax.amount, 0)),
  };
}

function aggregateTaxes(items: PurchaseItemPersist[]): PurchaseTax[] {
  const result = new Map<string, PurchaseTax>();
  for (const item of items) for (const tax of item.taxes) {
    const key = `${tax.name}|${tax.rate}`;
    const existing = result.get(key);
    if (existing) existing.amount = roundMoney(existing.amount + tax.amount);
    else result.set(key, { ...tax });
  }
  return [...result.values()];
}

function toResponse(purchase: PurchaseDocument): PurchaseResponse {
  return {
    id: purchase.id,
    companyId: purchase.companyId.toString(),
    supplierId: purchase.supplierId.toString(),
    supplierName: purchase.supplierName,
    userId: purchase.userId.toString(),
    userName: purchase.userName,
    branchId: purchase.branchId?.toString() ?? null,
    warehouseId: purchase.warehouseId.toString(),
    warehouseName: purchase.warehouseName,
    purchaseDate: purchase.purchaseDate.toISOString(),
    status: purchase.status,
    items: purchase.items.map((item) => ({
      productId: item.productId.toString(),
      productSku: item.productSku,
      productName: item.productName,
      quantity: item.quantity,
      receivedQuantity: item.receivedQuantity,
      unitCost: item.unitCost,
      discount: item.discount,
      discountAmount: item.discountAmount,
      taxes: item.taxes.map((tax) => ({
        name: tax.name ?? '',
        rate: tax.rate ?? 0,
        amount: tax.amount ?? 0,
      })),
      subtotal: item.subtotal,
      total: item.total,
    })),
    subtotal: purchase.subtotal,
    discountTotal: purchase.discountTotal,
    taxes: purchase.taxes,
    total: purchase.total,
    notes: purchase.notes ?? null,
    history: purchase.history.map((event) => ({ action: event.action, at: event.at.toISOString(), userId: event.userId.toString(), userName: event.userName })),
    confirmedAt: purchase.confirmedAt?.toISOString() ?? null,
    receivedAt: purchase.receivedAt?.toISOString() ?? null,
    cancelledAt: purchase.cancelledAt?.toISOString() ?? null,
    returnedAt: purchase.returnedAt?.toISOString() ?? null,
    createdAt: purchase.createdAt?.toISOString() ?? null,
    updatedAt: purchase.updatedAt?.toISOString() ?? null,
  };
}

async function findScopedOr404(companyId: string, id: string): Promise<PurchaseDocument> {
  const purchase = await purchasesRepository.findById(id);
  if (!purchase || purchase.companyId.toString() !== companyId) throw new NotFoundError('Compra no encontrada');
  return purchase;
}

export const purchasesService = {
  async list(companyId: string, query: ListPurchasesQueryInput): Promise<{ items: PurchaseResponse[]; meta: PaginationMeta }> {
    const { purchases, total } = await purchasesRepository.list(companyId, query);
    return { items: purchases.map(toResponse), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },
  async get(companyId: string, id: string): Promise<PurchaseResponse> { return toResponse(await findScopedOr404(companyId, id)); },
  async create(companyId: string, input: CreatePurchaseInput, actor: PurchaseActor): Promise<PurchaseResponse> {
    const supplier = await suppliersRepository.findById(input.supplierId);
    if (!supplier || supplier.companyId.toString() !== companyId) throw new BadRequestError('El proveedor indicado no existe', 'SUPPLIER_NOT_FOUND');
    if (!supplier.isActive) throw new ConflictError('El proveedor está desactivado', 'SUPPLIER_DISABLED');
    const warehouse = await requireWarehouseInCompany(companyId, input.warehouseId);
    if (!warehouse.isActive) throw new ConflictError('El almacén está desactivado', 'WAREHOUSE_DISABLED');
    const branch = input.branchId ? await requireBranchInCompany(companyId, input.branchId) : undefined;
    if (branch && !branch.isActive) throw new ConflictError('La sucursal está desactivada', 'BRANCH_DISABLED');
    assertWarehouseBranch(warehouse, input.branchId);
    const products = await productsRepository.findManyByIds(companyId, input.items.map((item) => item.productId));
    const byId = new Map(products.map((product) => [product.id, product]));
    const items = input.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) throw new BadRequestError('El producto indicado no existe', 'PRODUCT_NOT_FOUND');
      if (!product.isActive) throw new ConflictError('El producto está desactivado', 'PRODUCT_INACTIVE');
      return calculateItem(item, {
        id: product._id.toString(),
        sku: product.sku,
        name: product.name,
      });
    });
    const now = new Date();
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));
    const discountTotal = roundMoney(items.reduce((sum, item) => sum + item.discountAmount, 0));
    const total = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
    const purchase = await purchasesRepository.create({
      companyId, supplierId: supplier.id, supplierName: supplier.name, userId: actor.id, userName: actor.name,
      branchId: input.branchId, warehouseId: warehouse.id, warehouseName: warehouse.name,
      purchaseDate: input.purchaseDate ?? now, status: 'pending', items, subtotal, discountTotal,
      taxes: aggregateTaxes(items), total, notes: input.notes,
      history: [{ action: 'created', at: now, userId: actor.id, userName: actor.name }],
    });
    return toResponse(purchase);
  },
  async confirm(companyId: string, id: string, actor: PurchaseActor): Promise<PurchaseResponse> {
    return withTransaction(async (session) => {
      const now = new Date();
      const purchase = await purchasesRepository.claimTransition(companyId, id, ['pending'], {
        $set: { status: 'confirmed', confirmedAt: now },
        $push: { history: { action: 'confirmed', at: now, userId: actor.id, userName: actor.name } },
      }, session);
      if (!purchase) throw new ConflictError('La compra no puede confirmarse en su estado actual', 'INVALID_PURCHASE_STATE');
      const current = await purchasesRepository.findById(id, session);
      return toResponse(current ?? purchase);
    });
  },
  async cancel(companyId: string, id: string, actor: PurchaseActor): Promise<PurchaseResponse> {
    return withTransaction(async (session) => {
      const now = new Date();
      const purchase = await purchasesRepository.claimTransition(companyId, id, ['pending', 'confirmed'], {
        $set: { status: 'cancelled', cancelledAt: now },
        $push: { history: { action: 'cancelled', at: now, userId: actor.id, userName: actor.name } },
      }, session);
      if (!purchase) throw new ConflictError('La compra no puede cancelarse en su estado actual', 'INVALID_PURCHASE_STATE');
      const current = await purchasesRepository.findById(id, session);
      return toResponse(current ?? purchase);
    });
  },
  async receive(
    companyId: string,
    id: string,
    input: ReceivePurchaseInput,
    actor: PurchaseActor,
    idempotencyKey?: string,
  ): Promise<PurchaseResponse> {
    // El cliente conserva y reenvía la misma clave cuando reintenta una recepción.
    return withTransaction(async (session) => {
      const purchase = await purchasesRepository.findById(id, session);
      if (!purchase || purchase.companyId.toString() !== companyId) throw new NotFoundError('Compra no encontrada');

      const requestHash = createHash('sha256')
        .update(JSON.stringify([...input.items].sort((a, b) => a.productId.localeCompare(b.productId))))
        .digest('hex');
      const priorReceipt = idempotencyKey
        ? purchase.history.find((event) => event.idempotencyKey === idempotencyKey)
        : undefined;
      if (priorReceipt) {
        if (priorReceipt.requestHash !== requestHash) {
          throw new ConflictError('La clave de idempotencia ya se usó con otra recepción', 'IDEMPOTENCY_KEY_REUSED');
        }
        return toResponse(purchase);
      }

      if (!['confirmed', 'partially_received'].includes(purchase.status)) throw new ConflictError('La compra no puede recibirse en su estado actual', 'INVALID_PURCHASE_STATE');
      const requested = new Map(input.items.map((item) => [item.productId, item.quantity]));
      const purchaseProductIds = new Set(purchase.items.map((item) => item.productId.toString()));
      if ([...requested.keys()].some((productId) => !purchaseProductIds.has(productId))) {
        throw new BadRequestError('La recepción contiene productos que no pertenecen a la compra', 'PRODUCT_NOT_IN_PURCHASE');
      }
      let receivedAny = false;
      for (const item of purchase.items) {
        const quantity = requested.get(item.productId.toString()) ?? 0;
        if (quantity === 0) continue;
        if (item.receivedQuantity + quantity > item.quantity) throw new ConflictError('La recepción supera la cantidad comprada', 'RECEIVED_QUANTITY_EXCEEDED');
        await inventoryService.createMovement(companyId, { type: 'IN', warehouseId: purchase.warehouseId.toString(), productId: item.productId.toString(), quantity, reason: 'Recepción de compra', documentRef: `PURCHASE:${purchase.id}` }, { id: actor.id, name: actor.name, canTransfer: false }, session);
        item.receivedQuantity += quantity;
        receivedAny = true;
      }
      if (!receivedAny) throw new BadRequestError('Debes indicar al menos una línea pendiente de recepción');
      const complete = purchase.items.every((item) => item.receivedQuantity === item.quantity);
      const now = new Date();
      purchase.status = complete ? 'received' : 'partially_received';
      purchase.receivedAt = complete ? now : purchase.receivedAt;
      purchase.history.push({
        action: complete ? 'received' : 'partially_received',
        at: now,
        userId: actor.id,
        userName: actor.name,
        ...(idempotencyKey ? { idempotencyKey, requestHash } : {}),
      });
      await purchasesRepository.save(purchase, session);
      return toResponse(purchase);
    });
  },
  async returnPurchase(companyId: string, id: string, actor: PurchaseActor): Promise<PurchaseResponse> {
    return withTransaction(async (session) => {
      const purchase = await purchasesRepository.findById(id, session);
      if (!purchase || purchase.companyId.toString() !== companyId) throw new NotFoundError('Compra no encontrada');
      if (!['partially_received', 'received'].includes(purchase.status)) throw new ConflictError('La compra no puede devolverse en su estado actual', 'INVALID_PURCHASE_STATE');
      for (const item of purchase.items) if (item.receivedQuantity > 0) {
        await inventoryService.createMovement(companyId, { type: 'OUT', warehouseId: purchase.warehouseId.toString(), productId: item.productId.toString(), quantity: item.receivedQuantity, reason: 'Devolución de compra', documentRef: `PURCHASE:${purchase.id}` }, { id: actor.id, name: actor.name, canTransfer: false }, session);
      }
      const now = new Date();
      purchase.status = 'returned';
      purchase.returnedAt = now;
      purchase.history.push({ action: 'returned', at: now, userId: actor.id, userName: actor.name });
      await purchasesRepository.save(purchase, session);
      return toResponse(purchase);
    });
  },
};
