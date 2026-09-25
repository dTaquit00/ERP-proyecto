import type { ListBranchesQueryInput } from '@erp/validation';
import { Types, type FilterQuery } from 'mongoose';
import { escapeRegExp } from '../../shared/utils/regex.js';
import { BranchModel, type BranchDocument, type BranchSchemaType } from './branches.model.js';
import type { BranchCreateInput, BranchFieldChanges, BranchListResult } from './branches.types.js';

export function buildBranchFilter(companyId: string, query: ListBranchesQueryInput): FilterQuery<BranchSchemaType> {
  const filter: FilterQuery<BranchSchemaType> = { companyId: new Types.ObjectId(companyId) };
  if (query.status) filter.isActive = query.status === 'active';
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ code: pattern }, { name: pattern }, { address: pattern }, { manager: pattern }];
  }
  return filter;
}

export const branchesRepository = {
  async findById(id: string): Promise<BranchDocument | null> { return BranchModel.findById(id).exec(); },
  async findByCode(companyId: string, code: string): Promise<BranchDocument | null> {
    return BranchModel.findOne({ companyId, code }).exec();
  },
  async list(companyId: string, query: ListBranchesQueryInput): Promise<BranchListResult> {
    const filter = buildBranchFilter(companyId, query);
    const skip = (query.page - 1) * query.limit;
    const [branches, total] = await Promise.all([
      BranchModel.find(filter).sort({ name: 1 }).skip(skip).limit(query.limit).exec(),
      BranchModel.countDocuments(filter).exec(),
    ]);
    return { branches, total };
  },
  async create(input: BranchCreateInput): Promise<BranchDocument> { return BranchModel.create(input); },
  async saveChanges(branch: BranchDocument, changes: BranchFieldChanges): Promise<BranchDocument> {
    Object.assign(branch, changes);
    await branch.save();
    return branch;
  },
};
