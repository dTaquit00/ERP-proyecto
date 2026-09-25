import type { BranchResponse, PaginationMeta } from '@erp/types';
import type { CreateBranchInput, ListBranchesQueryInput, UpdateBranchInput } from '@erp/validation';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/http/errors.js';
import { branchesRepository } from './branches.repository.js';
import type { BranchDocument } from './branches.model.js';

function toBranchResponse(branch: BranchDocument): BranchResponse {
  return {
    id: branch.id,
    companyId: branch.companyId.toString(),
    code: branch.code,
    name: branch.name,
    address: branch.address ?? null,
    phone: branch.phone ?? null,
    email: branch.email ?? null,
    manager: branch.manager ?? null,
    isActive: branch.isActive,
    createdAt: branch.createdAt?.toISOString() ?? null,
    updatedAt: branch.updatedAt?.toISOString() ?? null,
  };
}

async function findScopedOr404(companyId: string, id: string): Promise<BranchDocument> {
  const branch = await branchesRepository.findById(id);
  if (!branch || branch.companyId.toString() !== companyId) throw new NotFoundError('Sucursal no encontrada');
  return branch;
}

export async function requireBranchInCompany(companyId: string, branchId: string): Promise<BranchDocument> {
  const branch = await branchesRepository.findById(branchId);
  if (!branch || branch.companyId.toString() !== companyId) {
    throw new BadRequestError('La sucursal indicada no existe', 'BRANCH_NOT_FOUND');
  }
  return branch;
}

async function ensureCodeAvailable(companyId: string, code: string, excludeId?: string): Promise<void> {
  const existing = await branchesRepository.findByCode(companyId, code);
  if (existing && existing.id !== excludeId) {
    throw new ConflictError('Ya existe una sucursal con ese código', 'CODE_IN_USE');
  }
}

export const branchesService = {
  async list(companyId: string, query: ListBranchesQueryInput): Promise<{ items: BranchResponse[]; meta: PaginationMeta }> {
    const { branches, total } = await branchesRepository.list(companyId, query);
    return {
      items: branches.map(toBranchResponse),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  },
  async get(companyId: string, id: string): Promise<BranchResponse> {
    return toBranchResponse(await findScopedOr404(companyId, id));
  },
  async create(companyId: string, input: CreateBranchInput): Promise<BranchResponse> {
    await ensureCodeAvailable(companyId, input.code);
    return toBranchResponse(await branchesRepository.create({ companyId, ...input }));
  },
  async update(companyId: string, id: string, input: UpdateBranchInput): Promise<BranchResponse> {
    const branch = await findScopedOr404(companyId, id);
    if (input.code && input.code !== branch.code) await ensureCodeAvailable(companyId, input.code, id);
    return toBranchResponse(await branchesRepository.saveChanges(branch, input));
  },
};
