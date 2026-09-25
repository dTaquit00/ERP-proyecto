import type { PaginationMeta, WarehouseResponse } from '@erp/types';
import type {
  CreateWarehouseInput,
  ListWarehousesQueryInput,
  UpdateWarehouseInput,
} from '@erp/validation';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/http/errors.js';
import { logger } from '../../config/logger.js';
import { warehousesRepository } from './warehouses.repository.js';
import type { WarehouseDocument } from './warehouses.model.js';
import { requireBranchInCompany } from '../branches/branches.service.js';

/** Evita asignar un documento a una sucursal distinta de la del almacén. */
export function assertWarehouseBranch(warehouse: WarehouseDocument, branchId?: string): void {
  const warehouseBranchId = warehouse.branchId?.toString();
  if (warehouseBranchId !== branchId) {
    throw new ConflictError('La sucursal de la operación debe coincidir con la sucursal del almacén', 'WAREHOUSE_BRANCH_MISMATCH');
  }
}

export function toWarehouseResponse(warehouse: WarehouseDocument): WarehouseResponse {
  return {
    id: warehouse.id,
    companyId: warehouse.companyId.toString(),
    name: warehouse.name,
    address: warehouse.address ?? null,
    branchId: warehouse.branchId ? warehouse.branchId.toString() : null,
    isActive: warehouse.isActive,
    createdAt: warehouse.createdAt ? warehouse.createdAt.toISOString() : null,
    updatedAt: warehouse.updatedAt ? warehouse.updatedAt.toISOString() : null,
  };
}

/** El recurso debe pertenecer a la empresa del actor; si no, 404 (no se filtra su existencia). */
async function findScopedOr404(companyId: string, id: string): Promise<WarehouseDocument> {
  const warehouse = await warehousesRepository.findById(id);
  if (!warehouse || warehouse.companyId.toString() !== companyId) {
    throw new NotFoundError('Almacén no encontrado');
  }
  return warehouse;
}

/**
 * Almacén referenciado por operaciones de inventario: debe existir dentro de la
 * MISMA empresa del actor (la existencia de almacenes ajenos no se confirma).
 */
export async function requireWarehouseInCompany(
  companyId: string,
  warehouseId: string,
): Promise<WarehouseDocument> {
  const warehouse = await warehousesRepository.findById(warehouseId);
  if (!warehouse || warehouse.companyId.toString() !== companyId) {
    throw new BadRequestError('El almacén indicado no existe', 'WAREHOUSE_NOT_FOUND');
  }
  return warehouse;
}

async function requireNameAvailable(
  companyId: string,
  name: string,
  excludeWarehouseId?: string,
): Promise<void> {
  const existing = await warehousesRepository.findByName(companyId, name);
  if (existing && existing.id !== excludeWarehouseId) {
    throw new ConflictError(
      'Ya existe un almacén con ese nombre en esta empresa',
      'NAME_IN_USE',
    );
  }
}

export const warehousesService = {
  async list(
    companyId: string,
    query: ListWarehousesQueryInput,
  ): Promise<{ items: WarehouseResponse[]; meta: PaginationMeta }> {
    const { warehouses, total } = await warehousesRepository.list(companyId, query);
    return {
      items: warehouses.map(toWarehouseResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  findScopedOr404,

  async get(companyId: string, id: string): Promise<WarehouseResponse> {
    return toWarehouseResponse(await findScopedOr404(companyId, id));
  },

  async create(
    companyId: string,
    input: CreateWarehouseInput,
    actorId: string,
  ): Promise<WarehouseResponse> {
    await requireNameAvailable(companyId, input.name);
    if (input.branchId) await requireBranchInCompany(companyId, input.branchId);
    const warehouse = await warehousesRepository.create({ companyId, ...input });
    logger.info({ warehouseId: warehouse.id, actorId, companyId }, 'Almacén creado');
    return toWarehouseResponse(warehouse);
  },

  async update(
    companyId: string,
    id: string,
    input: UpdateWarehouseInput,
    actorId: string,
  ): Promise<WarehouseResponse> {
    const warehouse = await findScopedOr404(companyId, id);
    if (input.branchId) await requireBranchInCompany(companyId, input.branchId);
    if (input.name !== undefined && input.name !== warehouse.name) {
      await requireNameAvailable(companyId, input.name, warehouse.id);
    }
    await warehousesRepository.saveChanges(warehouse, input);
    logger.info(
      { warehouseId: warehouse.id, actorId, fields: Object.keys(input) },
      'Almacén actualizado',
    );
    return toWarehouseResponse(warehouse);
  },
};
