/** Contratos internos del módulo de proveedores (M09). */
import type { SupplierDocument } from './suppliers.model.js';

export interface SupplierAddressInput {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface SupplierCreateInput {
  companyId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  ruc?: string;
  address?: SupplierAddressInput;
  notes?: string;
  isActive?: boolean;
}

/** `null` en un campo opcional significa "borrar" (blanco en el UPDATE). */
export interface SupplierFieldChanges {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  ruc?: string | null;
  address?: SupplierAddressInput;
  notes?: string | null;
  isActive?: boolean;
}

export interface SupplierListResult {
  suppliers: SupplierDocument[];
  total: number;
}
