/** Contratos internos del módulo de ventas (M12). */
import type { SaleHistoryAction, SaleTax } from '@erp/types';
import type { SaleDocument } from './sales.model.js';

export interface SaleListResult {
  sales: SaleDocument[];
  total: number;
}

/** Actor de una transición de estado de venta (id, nombre e importes de trazabilidad). */
export interface SaleActor {
  id: string;
  name: string;
}

/** Evento de historial listo para persistir. */
export interface SaleHistoryEventInput {
  action: SaleHistoryAction;
  at: Date;
  userId: string;
  userName: string;
}

/** Línea resuelta contra el catálogo (precios/impuestos SIEMPRE del backend). */
export interface ResolvedSaleItem {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  discountAmount: number;
  taxes: SaleTax[];
  total: number;
}

/** Documento listo para persistir (ya con totales calculados). */
export interface SaleCreatePersistInput {
  companyId: string;
  customerId: string;
  customerName: string;
  userId: string;
  userName: string;
  warehouseId: string;
  warehouseName: string;
  branchId?: string;
  saleDate: Date;
  notes?: string;
  items: ResolvedSaleItem[];
  subtotal: number;
  discountTotal: number;
  taxes: SaleTax[];
  total: number;
  history: SaleHistoryEventInput[];
}
