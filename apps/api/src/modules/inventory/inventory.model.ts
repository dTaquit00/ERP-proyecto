/**
 * M11 — Inventario: existencias (`stock_balances`) y movimientos
 * (`inventory_movements`). Regla de negocio: el stock NUNCA cambia sin
 * generar un movimiento; los movimientos son inmutables (sin PATCH/DELETE).
 */
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { MOVEMENT_TYPES } from '@erp/types';

const stockBalanceSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    // Umbral configurable por almacén (base de "stock bajo" del dashboard M14).
    minStock: { type: Number, required: true, min: 0, default: 0 },
    // Declarados para tiparlos; los gestiona mongoose gracias a `timestamps: true`.
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true, collection: 'stock_balances' },
);

// Una existencia es única por (empresa, almacén, producto).
stockBalanceSchema.index({ companyId: 1, warehouseId: 1, productId: 1 }, { unique: true });
stockBalanceSchema.index({ companyId: 1, warehouseId: 1 });
stockBalanceSchema.index({ companyId: 1, productId: 1 });

const inventoryMovementSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    type: {
      type: String,
      enum: [...MOVEMENT_TYPES],
      required: true,
      immutable: true,
    },
    // Almacén de origen (para TRANSFER; almacén único en el resto de tipos).
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, immutable: true },
    warehouseName: { type: String, required: true, maxlength: 80, immutable: true },
    // Solo TRANSFER: almacén de destino.
    toWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', immutable: true },
    toWarehouseName: { type: String, maxlength: 80, immutable: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, immutable: true },
    // "Foto" del producto al momento del movimiento (documento histórico).
    productName: { type: String, required: true, maxlength: 120, immutable: true },
    productSku: { type: String, required: true, maxlength: 40, immutable: true },
    quantity: { type: Number, required: true, min: 0, immutable: true },
    quantityAfter: { type: Number, required: true, min: 0, immutable: true },
    reason: { type: String, trim: true, maxlength: 200, immutable: true },
    documentRef: { type: String, trim: true, maxlength: 60, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    userName: { type: String, required: true, maxlength: 200, immutable: true },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true, collection: 'inventory_movements' },
);

// Histórico: consultas por empresa, almacén, producto y tipo.
inventoryMovementSchema.index({ companyId: 1, createdAt: -1 });
inventoryMovementSchema.index({ companyId: 1, warehouseId: 1, createdAt: -1 });
inventoryMovementSchema.index({ companyId: 1, productId: 1, createdAt: -1 });
inventoryMovementSchema.index({ companyId: 1, type: 1 });

export type StockBalanceSchemaType = InferSchemaType<typeof stockBalanceSchema>;
export type StockBalanceDocument = HydratedDocument<StockBalanceSchemaType>;
export const StockBalanceModel = model<StockBalanceSchemaType>(
  'StockBalance',
  stockBalanceSchema,
);

export type InventoryMovementSchemaType = InferSchemaType<typeof inventoryMovementSchema>;
export type InventoryMovementDocument = HydratedDocument<InventoryMovementSchemaType>;
export const InventoryMovementModel = model<InventoryMovementSchemaType>(
  'InventoryMovement',
  inventoryMovementSchema,
);
