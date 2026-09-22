import type { PaginationMeta, SupplierResponse } from '@erp/types';
import type {
  CreateSupplierInput,
  ListSuppliersQueryInput,
  UpdateSupplierInput,
} from '@erp/validation';
import { NotFoundError } from '../../shared/http/errors.js';
import { logger } from '../../config/logger.js';
import { suppliersRepository } from './suppliers.repository.js';
import type { SupplierDocument } from './suppliers.model.js';

export function toSupplierResponse(supplier: SupplierDocument): SupplierResponse {
  const address = supplier.address;
  return {
    id: supplier.id,
    companyId: supplier.companyId.toString(),
    name: supplier.name,
    // `|| null`: un `''` heredado en BD nunca se expone (contrato: string | null).
    contactName: supplier.contactName || null,
    email: supplier.email || null,
    phone: supplier.phone || null,
    ruc: supplier.ruc || null,
    address: address
      ? {
          street: address.street || null,
          city: address.city || null,
          state: address.state || null,
          zipCode: address.zipCode || null,
        }
      : null,
    notes: supplier.notes || null,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt ? supplier.createdAt.toISOString() : null,
    updatedAt: supplier.updatedAt ? supplier.updatedAt.toISOString() : null,
  };
}

/** El recurso debe pertenecer a la empresa del actor; si no, 404 (no se filtra su existencia). */
async function findScopedOr404(companyId: string, id: string): Promise<SupplierDocument> {
  const supplier = await suppliersRepository.findById(id);
  if (!supplier || supplier.companyId.toString() !== companyId) {
    throw new NotFoundError('Proveedor no encontrado');
  }
  return supplier;
}

export const suppliersService = {
  async list(
    companyId: string,
    query: ListSuppliersQueryInput,
  ): Promise<{ items: SupplierResponse[]; meta: PaginationMeta }> {
    const { suppliers, total } = await suppliersRepository.list(companyId, query);
    return {
      items: suppliers.map(toSupplierResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async get(companyId: string, id: string): Promise<SupplierResponse> {
    const supplier = await findScopedOr404(companyId, id);
    return toSupplierResponse(supplier);
  },

  async create(
    companyId: string,
    input: CreateSupplierInput,
    actorId: string,
  ): Promise<SupplierResponse> {
    const supplier = await suppliersRepository.create({ companyId, ...input });
    logger.info({ supplierId: supplier.id, actorId, companyId }, 'Proveedor creado');
    return toSupplierResponse(supplier);
  },

  async update(
    companyId: string,
    id: string,
    input: UpdateSupplierInput,
    actorId: string,
  ): Promise<SupplierResponse> {
    const supplier = await findScopedOr404(companyId, id);
    await suppliersRepository.saveChanges(supplier, input);
    logger.info(
      { supplierId: supplier.id, actorId, fields: Object.keys(input) },
      'Proveedor actualizado',
    );
    return toSupplierResponse(supplier);
  },
};
