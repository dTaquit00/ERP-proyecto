export interface BranchResponse {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}
