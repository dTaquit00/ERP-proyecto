import type { CategoryResponse, PaginationMeta } from '@erp/types';
import type {
  CreateCategoryInput,
  ListCategoriesQueryInput,
  UpdateCategoryInput,
} from '@erp/validation';
import { ConflictError, NotFoundError } from '../../shared/http/errors.js';
import { logger } from '../../config/logger.js';
import { categoriesRepository } from './categories.repository.js';
import type { CategoryDocument } from './categories.model.js';
import { productsRepository } from '../products/products.repository.js';

export function toCategoryResponse(
  category: CategoryDocument,
  productCount: number,
): CategoryResponse {
  return {
    id: category.id,
    companyId: category.companyId.toString(),
    name: category.name,
    description: category.description ?? null,
    isActive: category.isActive,
    productCount,
    createdAt: category.createdAt ? category.createdAt.toISOString() : null,
    updatedAt: category.updatedAt ? category.updatedAt.toISOString() : null,
  };
}

/** El recurso debe pertenecer a la empresa del actor; si no, 404 (no se filtra su existencia). */
async function findScopedOr404(companyId: string, id: string): Promise<CategoryDocument> {
  const category = await categoriesRepository.findById(id);
  if (!category || category.companyId.toString() !== companyId) {
    throw new NotFoundError('Categoría no encontrada');
  }
  return category;
}

async function requireNameAvailable(
  companyId: string,
  name: string,
  excludeCategoryId?: string,
): Promise<void> {
  const existing = await categoriesRepository.findByName(companyId, name);
  if (existing && existing.id !== excludeCategoryId) {
    throw new ConflictError(
      'Ya existe una categoría con ese nombre en esta empresa',
      'NAME_IN_USE',
    );
  }
}

export const categoriesService = {
  async list(
    companyId: string,
    query: ListCategoriesQueryInput,
  ): Promise<{ items: CategoryResponse[]; meta: PaginationMeta }> {
    const { categories, total } = await categoriesRepository.list(companyId, query);
    const counts = await productsRepository.countProductsByCategory(companyId);
    return {
      items: categories.map((category) =>
        toCategoryResponse(category, counts.get(category.id) ?? 0),
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async get(companyId: string, id: string): Promise<CategoryResponse> {
    const category = await findScopedOr404(companyId, id);
    const counts = await productsRepository.countProductsByCategory(companyId);
    return toCategoryResponse(category, counts.get(category.id) ?? 0);
  },

  async create(
    companyId: string,
    input: CreateCategoryInput,
    actorId: string,
  ): Promise<CategoryResponse> {
    await requireNameAvailable(companyId, input.name);
    const category = await categoriesRepository.create({ companyId, ...input });
    logger.info({ categoryId: category.id, actorId, companyId }, 'Categoría creada');
    return toCategoryResponse(category, 0);
  },

  async update(
    companyId: string,
    id: string,
    input: UpdateCategoryInput,
    actorId: string,
  ): Promise<CategoryResponse> {
    const category = await findScopedOr404(companyId, id);
    if (input.name !== undefined && input.name !== category.name) {
      await requireNameAvailable(companyId, input.name, category.id);
    }
    await categoriesRepository.saveChanges(category, input);
    const counts = await productsRepository.countProductsByCategory(companyId);
    logger.info(
      { categoryId: category.id, actorId, fields: Object.keys(input) },
      'Categoría actualizada',
    );
    return toCategoryResponse(category, counts.get(category.id) ?? 0);
  },
};
