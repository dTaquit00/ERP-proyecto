/**
 * M12 — Ventas (`sales`): cabecera referencial con snapshots + `items[]`
 * embebidos (foto de precio/impuestos al momento de vender) + `history[]`
 * de transiciones de estado.
 *
 * El stock NO se toca aquí: el débito/reabastecimiento ocurre al confirmar,
 * cancelar o devolver, integrado con M11 (inventario) dentro de una transacción.
 */
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { SALE_HISTORY_ACTIONS, SALE_STATUSES } from '@erp/types';

/** Impuesto cobrado en una línea (snapshot del producto). */
const saleTaxSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 60 },
    rate: { type: Number, required: true, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/** Línea de venta con todos los importes ya calculados por el backend. */
const saleItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, immutable: true },
    productSku: { type: String, required: true, maxlength: 40, immutable: true },
    productName: { type: String, required: true, maxlength: 120, immutable: true },
    quantity: { type: Number, required: true, min: 1, immutable: true },
    unitPrice: { type: Number, required: true, min: 0, immutable: true },
    discount: { type: Number, required: true, min: 0, max: 100, default: 0, immutable: true },
    subtotal: { type: Number, required: true, min: 0, immutable: true },
    discountAmount: { type: Number, required: true, min: 0, immutable: true },
    taxes: { type: [saleTaxSchema], default: [], immutable: true },
    total: { type: Number, required: true, min: 0, immutable: true },
  },
  { _id: false },
);

/** Evento de historial: quién hizo qué y cuándo (auditoría ligera del documento). */
const saleHistorySchema = new Schema(
  {
    action: { type: String, enum: [...SALE_HISTORY_ACTIONS], required: true },
    at: { type: Date, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, maxlength: 200 },
  },
  { _id: false },
);

const saleSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, immutable: true },
    customerName: { type: String, required: true, maxlength: 120, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    userName: { type: String, required: true, maxlength: 200, immutable: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, immutable: true },
    warehouseName: { type: String, required: true, maxlength: 80, immutable: true },
    // M05 sucursales (Fase 13): opcional y sin validación FK todavía.
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    saleDate: { type: Date, required: true },
    status: { type: String, enum: [...SALE_STATUSES], required: true, default: 'pending' },
    notes: { type: String, trim: true, maxlength: 500 },
    items: { type: [saleItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0 },
    taxes: { type: [saleTaxSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    history: { type: [saleHistorySchema], default: [] },
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
    returnedAt: { type: Date },
    // Declarados para tiparlos; los gestiona mongoose gracias a `timestamps: true`.
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true, collection: 'sales' },
);

// Histórico de ventas: listado por empresa (fecha), estado y cliente.
saleSchema.index({ companyId: 1, saleDate: -1 });
saleSchema.index({ companyId: 1, status: 1, saleDate: -1 });
saleSchema.index({ companyId: 1, customerId: 1, saleDate: -1 });
saleSchema.index({ companyId: 1, warehouseId: 1, saleDate: -1 });

export type SaleSchemaType = InferSchemaType<typeof saleSchema>;
export type SaleDocument = HydratedDocument<SaleSchemaType>;
export const SaleModel = model<SaleSchemaType>('Sale', saleSchema);
