/** Contratos internos del módulo de almacenes (M10). */
import type { WarehouseDocument } from './warehouses.model.js';

export interface WarehouseCreateInput {
  companyId: string;
  name: string;
  address?: string;
  branchId?: string;
  isActive?: boolean;
}

export interface WarehouseFieldChanges {
  name?: string;
  address?: string;
  branchId?: string | null;
  isActive?: boolean;
}

export interface WarehouseListResult {
  warehouses: WarehouseDocument[];
  total: number;
}
