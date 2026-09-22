/** Tipos de movimiento de inventario (M11) — documento inmutable. */
export const MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RETURN'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/**
 * Existencia de un producto en un almacén (M11).
 * `lowStock` se deriva en backend: `minStock > 0 && quantity < minStock`.
 */
export interface StockBalanceResponse {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  minStock: number;
  lowStock: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Movimiento de inventario (M11): inmutable y con el stock resultante.
 * Los nombres se registran como "foto" en el momento del movimiento
 * (documento histórico: renombrar el producto/almacén no lo reescribe).
 */
export interface InventoryMovementResponse {
  id: string;
  companyId: string;
  type: MovementType;
  warehouseId: string;
  warehouseName: string;
  /** Solo para TRANSFER. */
  toWarehouseId: string | null;
  toWarehouseName: string | null;
  productId: string;
  productName: string;
  productSku: string;
  /** Cantidad del movimiento (en ADJUSTMENT es el recuento absoluto). */
  quantity: number;
  /** Stock resultante en el almacén de origen tras el movimiento. */
  quantityAfter: number;
  reason: string | null;
  /** Referencia al documento de negocio (p. ej. `SALE:...`, `PURCHASE:...`). */
  documentRef: string | null;
  userId: string;
  userName: string;
  createdAt: string | null;
  updatedAt: string | null;
}
