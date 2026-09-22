/** Contratos internos del módulo de inventario (M11). */
import type { MovementType } from '@erp/types';
import type { InventoryMovementDocument, StockBalanceDocument } from './inventory.model.js';

export interface StockListResult {
  balances: StockBalanceDocument[];
  total: number;
}

export interface MovementListResult {
  movements: InventoryMovementDocument[];
  total: number;
}

/** Actor del movimiento: id, nombre "foto" y si puede transferir (control en controller). */
export interface MovementActor {
  id: string;
  name: string;
  canTransfer: boolean;
}

/** Datos de creación del documento de movimiento (ya con snapshots y stock resultante). */
export interface MovementPersistInput {
  companyId: string;
  type: MovementType;
  warehouseId: string;
  warehouseName: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  quantityAfter: number;
  reason?: string;
  documentRef?: string;
  userId: string;
  userName: string;
}
