/** Contratos internos del módulo de clientes (M08). */
import type { CustomerDocument } from './customers.model.js';

export interface CustomerAddressInput {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface CustomerCreateInput {
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  dni?: string;
  address?: CustomerAddressInput;
  notes?: string;
  isActive?: boolean;
}

/** `null` en un campo opcional significa "borrar" (blanco en el UPDATE). */
export interface CustomerFieldChanges {
  name?: string;
  email?: string | null;
  phone?: string | null;
  dni?: string | null;
  address?: CustomerAddressInput;
  notes?: string | null;
  isActive?: boolean;
}

export interface CustomerListResult {
  customers: CustomerDocument[];
  total: number;
}
