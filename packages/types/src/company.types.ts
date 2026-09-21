/** Vista de la empresa propietaria del ERP (M04). */
export interface CompanySummary {
  id: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}
