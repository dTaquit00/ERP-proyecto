import { Types, type FilterQuery } from 'mongoose';
import type { ListCategoriesQueryInput } from '@erp/validation';
import { escapeRegExp } from '../../shared/utils/regex.js';
import {
  CategoryModel,
  type CategoryDocument,
  type CategorySchemaType,
} from './categories.model.js';
import type { CategoryCreateInput, CategoryFieldChanges, CategoryListResult } from './categories.types.js';

/**
 * Construye el filtro de listado. El scope multiempresa (`companyId`) SIEMPRE
 * se aplica aquí: el filtro del cliente nunca puede ampliar el alcance.
 */
export function buildCategoryFilter(
  companyId: string,
  query: ListCategoriesQueryInput,
): FilterQuery<CategorySchemaType> {
  const filter: FilterQuery<CategorySchemaType> = {
    companyId: new Types.ObjectId(companyId),
  };
  if (query.status) filter.isActive = query.status === 'active';
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ name: pattern }, { description: pattern }];
  }
  return filter;
}

export const categoriesRepository = {
  async findById(id: string): Promise<CategoryDocument | null> {
    return CategoryModel.findById(id).exec();
  },

  async findByName(companyId: string, name: string): Promise<CategoryDocument | null> {
    return CategoryModel.findOne({ companyId, name }).exec();
  },

  /** Todas las categorías de la empresa (para resolver nombres en productos). */
  async findByCompany(companyId: string): Promise<CategoryDocument[]> {
    return CategoryModel.find({ companyId }).sort({ name: 1 }).exec();
  },

  /** Listado paginado con filtros, búsqueda y orden seguros. */
  async list(
    companyId: string,
    query: ListCategoriesQueryInput,
  ): Promise<CategoryListResult> {
    const filter = buildCategoryFilter(companyId, query);
    const sort: Record<string, 1 | -1> = {
      [query.sort]: query.order === 'asc' ? 1 : -1,
    };
    const skip = (query.page - 1) * query.limit;

    const [categories, total] = await Promise.all([
      CategoryModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      CategoryModel.countDocuments(filter).exec(),
    ]);
    return { categories, total };
  },

  async create(input: CategoryCreateInput): Promise<CategoryDocument> {
    return CategoryModel.create(input);
  },

  async saveChanges(
    category: CategoryDocument,
    changes: CategoryFieldChanges,
  ): Promise<CategoryDocument> {
    if (changes.name !== undefined) category.name = changes.name;
    if (changes.description !== undefined) category.description = changes.description;
    if (changes.isActive !== undefined) category.isActive = changes.isActive;
    await category.save();
    return category;
  },
};
