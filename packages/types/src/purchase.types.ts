export const PURCHASE_STATUSES = ['pending', 'confirmed', 'partially_received', 'received', 'cancelled', 'returned'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export interface PurchaseTax { name: string; rate: number; amount: number }
export interface PurchaseItemResponse {
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
export interface PurchaseResponse {
  id: string;
  companyId: string;
  supplierId: string;
  supplierName: string;
  userId: string;
  userName: string;
  branchId: string | null;
  warehouseId: string;
  warehouseName: string;
  purchaseDate: string;
  status: PurchaseStatus;
  items: PurchaseItemResponse[];
  subtotal: number;
  discountTotal: number;
  taxes: PurchaseTax[];
  total: number;
  notes: string | null;
  history: Array<{ action: string; at: string; userId: string; userName: string }>;
  confirmedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  returnedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
