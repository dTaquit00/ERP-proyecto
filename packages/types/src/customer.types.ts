/** Dirección opcional compartida por clientes y proveedores (M08/M09). */
export interface PartyAddress {
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}

/** Vista de un cliente para listados y detalle (M08). */
export interface CustomerResponse {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  dni: string | null;
  address: PartyAddress | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}
