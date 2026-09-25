import type { BranchDocument } from './branches.model.js';

export interface BranchCreateInput {
  companyId: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  manager?: string;
  isActive?: boolean;
}

export interface BranchFieldChanges {
  code?: string;
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  manager?: string;
  isActive?: boolean;
}

export interface BranchListResult {
  branches: BranchDocument[];
  total: number;
}
