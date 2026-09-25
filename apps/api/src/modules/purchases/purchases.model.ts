import { Schema, model, type ClientSession, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { PurchaseStatus, PurchaseTax } from '@erp/types';

const purchaseItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, required: true },
  productSku: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  receivedQuantity: { type: Number, required: true, min: 0, default: 0 },
  unitCost: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0, max: 100 },
  discountAmount: { type: Number, required: true, min: 0 },
  taxes: { type: [{ _id: false, name: String, rate: Number, amount: Number }], default: [] },
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
}, { _id: false });

const historySchema = new Schema({
  action: { type: String, required: true },
  at: { type: Date, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  userName: { type: String, required: true },
  // Metadatos internos para reconocer reintentos de una recepción sin duplicar stock.
  idempotencyKey: { type: String },
  requestHash: { type: String },
}, { _id: false });

const purchaseSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  userName: { type: String, required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  warehouseName: { type: String, required: true },
  purchaseDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'partially_received', 'received', 'cancelled', 'returned'], required: true },
  items: { type: [purchaseItemSchema], required: true },
  subtotal: { type: Number, required: true },
  discountTotal: { type: Number, required: true },
  taxes: { type: [{ _id: false, name: String, rate: Number, amount: Number }], default: [] },
  total: { type: Number, required: true },
  notes: { type: String },
  history: { type: [historySchema], default: [] },
  confirmedAt: Date,
  receivedAt: Date,
  cancelledAt: Date,
  returnedAt: Date,
}, { timestamps: true, collection: 'purchases' });

purchaseSchema.index({ companyId: 1, status: 1, purchaseDate: -1 });

export type PurchaseSchemaType = Omit<InferSchemaType<typeof purchaseSchema>, 'taxes' | 'status'> & {
  taxes: PurchaseTax[];
  status: PurchaseStatus;
};
export type PurchaseDocument = HydratedDocument<PurchaseSchemaType>;
export const PurchaseModel = model<PurchaseSchemaType>('Purchase', purchaseSchema);
export type PurchaseSession = ClientSession;
