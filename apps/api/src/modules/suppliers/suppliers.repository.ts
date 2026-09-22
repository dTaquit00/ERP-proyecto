import { Types, type FilterQuery } from 'mongoose';
import type { ListSuppliersQueryInput } from '@erp/validation';
import { escapeRegExp } from '../../shared/utils/regex.js';
import {
  SupplierModel,
  type SupplierDocument,
  type SupplierSchemaType,
} from './suppliers.model.js';
import type {
  SupplierCreateInput,
  SupplierFieldChanges,
  SupplierListResult,
} from './suppliers.types.js';

/**
 * Construye el filtro de listado. El scope multiempresa (`companyId`) SIEMPRE
 * se aplica aquí: el filtro del cliente nunca puede ampliar el alcance.
 * La búsqueda cubre nombre, contacto, correo, teléfono y RUC (escape de regex).
 */
export function buildSupplierFilter(
  companyId: string,
  query: ListSuppliersQueryInput,
): FilterQuery<SupplierSchemaType> {
  const filter: FilterQuery<SupplierSchemaType> = {
    companyId: new Types.ObjectId(companyId),
  };
  if (query.status) filter.isActive = query.status === 'active';
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [
      { name: pattern },
      { contactName: pattern },
      { email: pattern },
      { phone: pattern },
      { ruc: pattern },
    ];
  }
  return filter;
}

export const suppliersRepository = {
  async findById(id: string): Promise<SupplierDocument | null> {
    return SupplierModel.findById(id).exec();
  },

  /** Listado paginado con filtros, búsqueda y orden seguros. */
  async list(
    companyId: string,
    query: ListSuppliersQueryInput,
  ): Promise<SupplierListResult> {
    const filter = buildSupplierFilter(companyId, query);
    const sort: Record<string, 1 | -1> = {
      [query.sort]: query.order === 'asc' ? 1 : -1,
    };
    const skip = (query.page - 1) * query.limit;

    const [suppliers, total] = await Promise.all([
      SupplierModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      SupplierModel.countDocuments(filter).exec(),
    ]);
    return { suppliers, total };
  },

  async create(input: SupplierCreateInput): Promise<SupplierDocument> {
    return SupplierModel.create(input);
  },

  async saveChanges(
    supplier: SupplierDocument,
    changes: SupplierFieldChanges,
  ): Promise<SupplierDocument> {
    if (changes.name !== undefined) supplier.name = changes.name;
    if (changes.contactName !== undefined) supplier.contactName = changes.contactName;
    if (changes.email !== undefined) supplier.email = changes.email;
    if (changes.phone !== undefined) supplier.phone = changes.phone;
    if (changes.ruc !== undefined) supplier.ruc = changes.ruc;
    if (changes.address !== undefined) supplier.address = changes.address;
    if (changes.notes !== undefined) supplier.notes = changes.notes;
    if (changes.isActive !== undefined) supplier.isActive = changes.isActive;
    await supplier.save();
    return supplier;
  },
};
