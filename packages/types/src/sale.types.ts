/** M12 — Ventas: estados, líneas con snapshot e historial de transiciones. */

/** Estados de una venta. El stock solo cambia al confirmar/devolver/cancelar confirmada. */
export const SALE_STATUSES = ['pending', 'confirmed', 'cancelled', 'returned'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

/** Acciones registradas en el historial de la venta (auditoría ligera del documento). */
export const SALE_HISTORY_ACTIONS = ['created', 'confirmed', 'cancelled', 'returned'] as const;
export type SaleHistoryAction = (typeof SALE_HISTORY_ACTIONS)[number];

/** Impuesto aplicado a una línea (snapshot del producto al vender). */
export interface SaleTax {
  name: string;
  /** Tasa en porcentaje (0–100). */
  rate: number;
  /** Importe cobrado en la moneda de la venta (redondeado a 2 decimales). */
  amount: number;
}

/** Evento del historial de estados de la venta. */
export interface SaleHistoryEvent {
  action: SaleHistoryAction;
  at: string;
  userId: string;
  userName: string;
}

/** Línea de venta con todos los valores ya calculados por el backend. */
export interface SaleItemResponse {
  productId: string;
  /** Snapshot del producto al momento de crear la venta (documento histórico). */
  productSku: string;
  productName: string;
  quantity: number;
  /** Precio unitario de catálogo (`product.salePrice`); nunca lo envía el cliente. */
  unitPrice: number;
  /** Descuento de línea en porcentaje (0–100). */
  discount: number;
  /** Subtotal de la línea antes de descuento (unitPrice × quantity). */
  subtotal: number;
  /** Importe del descuento de la línea. */
  discountAmount: number;
  taxes: SaleTax[];
  /** Total de la línea: subtotal − descuento + impuestos. */
  total: number;
}

/** Vista de una venta para listados y detalle (M12). */
export interface SaleResponse {
  id: string;
  companyId: string;
  customerId: string;
  /** Nombre del cliente resuelto por el backend al crear la venta (snapshot). */
  customerName: string;
  /** Usuario que creó la venta (vendedor). */
  userId: string;
  userName: string;
  warehouseId: string;
  warehouseName: string;
  /** `branchId` (M05 sucursales) es opcional: FK validada desde la Fase 13. */
  branchId: string | null;
  saleDate: string;
  status: SaleStatus;
  notes: string | null;
  items: SaleItemResponse[];
  /** Suma de subtotales de línea antes de descuentos. */
  subtotal: number;
  /** Suma de descuentos de línea. */
  discountTotal: number;
  /** Impuestos agregados por tasa (suma de los de las líneas). */
  taxes: SaleTax[];
  /** subtotal − discountTotal + suma(taxes.amount). */
  total: number;
  history: SaleHistoryEvent[];
  confirmedAt: string | null;
  cancelledAt: string | null;
  returnedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
