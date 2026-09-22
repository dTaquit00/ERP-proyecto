import type { CustomerResponse, PaginationMeta } from '@erp/types';
import type {
  CreateCustomerInput,
  ListCustomersQueryInput,
  UpdateCustomerInput,
} from '@erp/validation';
import { NotFoundError } from '../../shared/http/errors.js';
import { logger } from '../../config/logger.js';
import { customersRepository } from './customers.repository.js';
import type { CustomerDocument } from './customers.model.js';

export function toCustomerResponse(customer: CustomerDocument): CustomerResponse {
  const address = customer.address;
  return {
    id: customer.id,
    companyId: customer.companyId.toString(),
    name: customer.name,
    // `|| null`: un `''` heredado en BD nunca se expone (contrato: string | null).
    email: customer.email || null,
    phone: customer.phone || null,
    dni: customer.dni || null,
    address: address
      ? {
          street: address.street || null,
          city: address.city || null,
          state: address.state || null,
          zipCode: address.zipCode || null,
        }
      : null,
    notes: customer.notes || null,
    isActive: customer.isActive,
    createdAt: customer.createdAt ? customer.createdAt.toISOString() : null,
    updatedAt: customer.updatedAt ? customer.updatedAt.toISOString() : null,
  };
}

/** El recurso debe pertenecer a la empresa del actor; si no, 404 (no se filtra su existencia). */
async function findScopedOr404(companyId: string, id: string): Promise<CustomerDocument> {
  const customer = await customersRepository.findById(id);
  if (!customer || customer.companyId.toString() !== companyId) {
    throw new NotFoundError('Cliente no encontrado');
  }
  return customer;
}

export const customersService = {
  async list(
    companyId: string,
    query: ListCustomersQueryInput,
  ): Promise<{ items: CustomerResponse[]; meta: PaginationMeta }> {
    const { customers, total } = await customersRepository.list(companyId, query);
    return {
      items: customers.map(toCustomerResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async get(companyId: string, id: string): Promise<CustomerResponse> {
    const customer = await findScopedOr404(companyId, id);
    return toCustomerResponse(customer);
  },

  async create(
    companyId: string,
    input: CreateCustomerInput,
    actorId: string,
  ): Promise<CustomerResponse> {
    const customer = await customersRepository.create({ companyId, ...input });
    logger.info({ customerId: customer.id, actorId, companyId }, 'Cliente creado');
    return toCustomerResponse(customer);
  },

  async update(
    companyId: string,
    id: string,
    input: UpdateCustomerInput,
    actorId: string,
  ): Promise<CustomerResponse> {
    const customer = await findScopedOr404(companyId, id);
    await customersRepository.saveChanges(customer, input);
    logger.info(
      { customerId: customer.id, actorId, fields: Object.keys(input) },
      'Cliente actualizado',
    );
    return toCustomerResponse(customer);
  },
};
