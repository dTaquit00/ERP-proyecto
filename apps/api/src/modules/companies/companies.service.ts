import type { CompanySummary, PaginationMeta } from '@erp/types';
import type {
  CreateCompanyInput,
  ListCompaniesQueryInput,
  UpdateCompanyInput,
} from '@erp/validation';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/http/errors.js';
import { env } from '../../config/env.js';
import { companiesRepository } from './companies.repository.js';
import type { CompanyDocument } from './companies.model.js';

function toCompanyResponse(company: CompanyDocument): CompanySummary {
  return {
    id: company.id,
    name: company.name,
    legalName: company.legalName ?? null,
    taxId: company.taxId ?? null,
    phone: company.phone ?? null,
    email: company.email ?? null,
    address: company.address ?? null,
    status: company.status,
    settings: (company.settings as Record<string, unknown> | undefined) ?? {},
    createdAt: company.createdAt?.toISOString(),
    updatedAt: company.updatedAt?.toISOString(),
  };
}

async function findScopedOr404(companyId: string, id: string): Promise<CompanyDocument> {
  const company = await companiesRepository.findByIdScoped(companyId, id);
  if (!company) throw new NotFoundError('Empresa no encontrada');
  return company;
}

export const companiesService = {
  async list(
    companyId: string,
    query: ListCompaniesQueryInput,
  ): Promise<{ items: CompanySummary[]; meta: PaginationMeta }> {
    const companies = await companiesRepository.listById(companyId);
    const start = (query.page - 1) * query.limit;
    const items = companies.slice(start, start + query.limit).map(toCompanyResponse);
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total: companies.length,
        totalPages: Math.ceil(companies.length / query.limit),
      },
    };
  },

  async get(companyId: string, id: string): Promise<CompanySummary> {
    return toCompanyResponse(await findScopedOr404(companyId, id));
  },

  async create(actorEmail: string, input: CreateCompanyInput): Promise<CompanySummary> {
    if (!env.PLATFORM_ADMIN_EMAIL || actorEmail.toLowerCase() !== env.PLATFORM_ADMIN_EMAIL.toLowerCase()) {
      throw new ForbiddenError(
        'La creación de empresas está reservada al administrador de plataforma',
        'PLATFORM_ADMIN_REQUIRED',
      );
    }
    const existing = await companiesRepository.findByName(input.name);
    if (existing) throw new ConflictError('Ya existe una empresa con ese nombre', 'NAME_IN_USE');
    return toCompanyResponse(await companiesRepository.create(input));
  },

  async update(
    companyId: string,
    id: string,
    input: UpdateCompanyInput,
  ): Promise<CompanySummary> {
    const company = await findScopedOr404(companyId, id);
    if (input.name && input.name !== company.name) {
      const existing = await companiesRepository.findByName(input.name);
      if (existing && existing.id !== company.id) {
        throw new ConflictError('Ya existe una empresa con ese nombre', 'NAME_IN_USE');
      }
    }
    return toCompanyResponse(await companiesRepository.saveChanges(company, input));
  },
};