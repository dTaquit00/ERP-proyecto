import type { Permission } from '@erp/types';
import { RoleModel, type RoleDocument } from './roles.model.js';

export interface RoleCreateInput {
  companyId: string;
  name: string;
  displayName: string;
  permissions: Permission[];
  isSystem?: boolean;
}

export const rolesRepository = {
  async findById(id: string): Promise<RoleDocument | null> {
    return RoleModel.findById(id).exec();
  },

  async findByName(companyId: string, name: string): Promise<RoleDocument | null> {
    return RoleModel.findOne({ companyId, name }).exec();
  },

  async create(input: RoleCreateInput): Promise<RoleDocument> {
    return RoleModel.create(input);
  },
};
