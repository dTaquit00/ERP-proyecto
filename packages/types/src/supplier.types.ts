import type { PartyAddress } from './customer.types.js';

/** Vista de un proveedor para listados y detalle (M09). */
export interface SupplierResponse {
  id: string;
  companyId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  ruc: string | null;
  address: PartyAddress | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}
