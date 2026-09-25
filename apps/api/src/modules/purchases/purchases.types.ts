import type { PurchaseStatus, PurchaseTax } from '@erp/types';
import type { PurchaseDocument } from './purchases.model.js';

export interface PurchaseItemPersist {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  discount: number;
  discountAmount: number;
  taxes: PurchaseTax[];
  subtotal: number;
  total: number;
}
export interface PurchasePersistInput {
  companyId: string;
  supplierId: string;
  supplierName: string;
  userId: string;
  userName: string;
  branchId?: string;
  warehouseId: string;
  warehouseName: string;
  purchaseDate: Date;
  status: PurchaseStatus;
  items: PurchaseItemPersist[];
  subtotal: number;
  discountTotal: number;
  taxes: PurchaseTax[];
  total: number;
  notes?: string;
  history: Array<{ action: string; at: Date; userId: string; userName: string }>;
}
export interface PurchaseListResult { purchases: PurchaseDocument[]; total: number }
