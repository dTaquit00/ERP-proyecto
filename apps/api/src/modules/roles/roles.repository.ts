import type { Permission } from '@erp/types';
import { RoleModel, type RoleDocument } from './roles.model.js';

export interface RoleCreateInput {
  companyId: string;
  name: string;
  displayName: string;
  permissions: Permission[];
  isSystem?: boolean;
}

export interface RoleFieldChanges {
  displayName?: string;
  permissions?: Permission[];
}

export const rolesRepository = {
  async findById(id: string): Promise<RoleDocument | null> {
    return RoleModel.findById(id).exec();
  },

  async findByName(companyId: string, name: string): Promise<RoleDocument | null> {
    return RoleModel.findOne({ companyId, name }).exec();
  },

  async findByCompany(companyId: string): Promise<RoleDocument[]> {
    return RoleModel.find({ companyId }).sort({ name: 1 }).exec();
  },

  async listByCompany(
    companyId: string,
    page: number,
    limit: number,
  ): Promise<{ roles: RoleDocument[]; total: number }> {
    const [roles, total] = await Promise.all([
      RoleModel.find({ companyId })
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      RoleModel.countDocuments({ companyId }).exec(),
    ]);
    return { roles, total };
  },

  async create(input: RoleCreateInput): Promise<RoleDocument> {
    return RoleModel.create(input);
  },

  async saveChanges(role: RoleDocument, changes: RoleFieldChanges): Promise<RoleDocument> {
    if (changes.displayName !== undefined) role.displayName = changes.displayName;
    if (changes.permissions !== undefined) role.permissions = [...changes.permissions];
    await role.save();
    return role;
  },

  async remove(role: RoleDocument): Promise<void> {
    await role.deleteOne();
  },
};
