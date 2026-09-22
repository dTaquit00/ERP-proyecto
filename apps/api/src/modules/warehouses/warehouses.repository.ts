import { Types, type FilterQuery } from 'mongoose';
import type { ListWarehousesQueryInput } from '@erp/validation';
import { escapeRegExp } from '../../shared/utils/regex.js';
import {
  WarehouseModel,
  type WarehouseDocument,
  type WarehouseSchemaType,
} from './warehouses.model.js';
import type {
  WarehouseCreateInput,
  WarehouseFieldChanges,
  WarehouseListResult,
} from './warehouses.types.js';

/**
 * Construye el filtro de listado. El scope multiempresa (`companyId`) SIEMPRE
 * se aplica aquí: el filtro del cliente nunca puede ampliar el alcance.
 */
export function buildWarehouseFilter(
  companyId: string,
  query: ListWarehousesQueryInput,
): FilterQuery<WarehouseSchemaType> {
  const filter: FilterQuery<WarehouseSchemaType> = {
    companyId: new Types.ObjectId(companyId),
  };
  if (query.status) filter.isActive = query.status === 'active';
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ name: pattern }, { address: pattern }];
  }
  return filter;
}

export const warehousesRepository = {
  async findById(id: string): Promise<WarehouseDocument | null> {
    return WarehouseModel.findById(id).exec();
  },

  async findByName(companyId: string, name: string): Promise<WarehouseDocument | null> {
    return WarehouseModel.findOne({ companyId, name }).exec();
  },

  /** Almacenes de la empresa por ids (para resolver nombres en inventario). */
  async findManyByIds(companyId: string, ids: string[]): Promise<WarehouseDocument[]> {
    if (ids.length === 0) return [];
    return WarehouseModel.find({ companyId, _id: { $in: ids } }).exec();
  },

  /** Listado paginado con filtros, búsqueda y orden seguros. */
  async list(
    companyId: string,
    query: ListWarehousesQueryInput,
  ): Promise<WarehouseListResult> {
    const filter = buildWarehouseFilter(companyId, query);
    const sort: Record<string, 1 | -1> = {
      [query.sort]: query.order === 'asc' ? 1 : -1,
    };
    const skip = (query.page - 1) * query.limit;

    const [warehouses, total] = await Promise.all([
      WarehouseModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      WarehouseModel.countDocuments(filter).exec(),
    ]);
    return { warehouses, total };
  },

  async create(input: WarehouseCreateInput): Promise<WarehouseDocument> {
    return WarehouseModel.create(input);
  },

  async saveChanges(
    warehouse: WarehouseDocument,
    changes: WarehouseFieldChanges,
  ): Promise<WarehouseDocument> {
    if (changes.name !== undefined) warehouse.name = changes.name;
    if (changes.address !== undefined) warehouse.address = changes.address;
    if (changes.branchId === null) warehouse.branchId = undefined;
    else if (changes.branchId !== undefined) warehouse.branchId = new Types.ObjectId(changes.branchId);
    if (changes.isActive !== undefined) warehouse.isActive = changes.isActive;
    await warehouse.save();
    return warehouse;
  },
};
