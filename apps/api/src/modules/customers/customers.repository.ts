import { Types, type FilterQuery } from 'mongoose';
import type { ListCustomersQueryInput } from '@erp/validation';
import { escapeRegExp } from '../../shared/utils/regex.js';
import {
  CustomerModel,
  type CustomerDocument,
  type CustomerSchemaType,
} from './customers.model.js';
import type {
  CustomerCreateInput,
  CustomerFieldChanges,
  CustomerListResult,
} from './customers.types.js';

/**
 * Construye el filtro de listado. El scope multiempresa (`companyId`) SIEMPRE
 * se aplica aquí: el filtro del cliente nunca puede ampliar el alcance.
 * La búsqueda cubre nombre, correo, teléfono y DNI/RUC (escape de regex).
 */
export function buildCustomerFilter(
  companyId: string,
  query: ListCustomersQueryInput,
): FilterQuery<CustomerSchemaType> {
  const filter: FilterQuery<CustomerSchemaType> = {
    companyId: new Types.ObjectId(companyId),
  };
  if (query.status) filter.isActive = query.status === 'active';
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { dni: pattern }];
  }
  return filter;
}

export const customersRepository = {
  async findById(id: string): Promise<CustomerDocument | null> {
    return CustomerModel.findById(id).exec();
  },

  /** Listado paginado con filtros, búsqueda y orden seguros. */
  async list(
    companyId: string,
    query: ListCustomersQueryInput,
  ): Promise<CustomerListResult> {
    const filter = buildCustomerFilter(companyId, query);
    const sort: Record<string, 1 | -1> = {
      [query.sort]: query.order === 'asc' ? 1 : -1,
    };
    const skip = (query.page - 1) * query.limit;

    const [customers, total] = await Promise.all([
      CustomerModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      CustomerModel.countDocuments(filter).exec(),
    ]);
    return { customers, total };
  },

  async create(input: CustomerCreateInput): Promise<CustomerDocument> {
    return CustomerModel.create(input);
  },

  async saveChanges(
    customer: CustomerDocument,
    changes: CustomerFieldChanges,
  ): Promise<CustomerDocument> {
    if (changes.name !== undefined) customer.name = changes.name;
    if (changes.email !== undefined) customer.email = changes.email;
    if (changes.phone !== undefined) customer.phone = changes.phone;
    if (changes.dni !== undefined) customer.dni = changes.dni;
    if (changes.address !== undefined) customer.address = changes.address;
    if (changes.notes !== undefined) customer.notes = changes.notes;
    if (changes.isActive !== undefined) customer.isActive = changes.isActive;
    await customer.save();
    return customer;
  },
};
