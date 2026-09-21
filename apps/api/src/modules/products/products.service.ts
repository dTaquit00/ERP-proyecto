import type { PaginationMeta, ProductResponse, ProductTax } from '@erp/types';
import type { CreateProductInput, ListProductsQueryInput, UpdateProductInput } from '@erp/validation';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/http/errors.js';
import { logger } from '../../config/logger.js';
import { productsRepository } from './products.repository.js';
import type { ProductDocument } from './products.model.js';
import { categoriesRepository } from '../categories/categories.repository.js';

/** Fallback cuando la categoría referenciada ya no existe (BD alterada). */
export const UNKNOWN_CATEGORY = 'sin-categoría';

type CategoryNameMap = Map<string, string>;

/** Mapa categoryId → nombre de categoría de la empresa (una sola consulta). */
async function categoryNameMap(companyId: string): Promise<CategoryNameMap> {
  const categories = await categoriesRepository.findByCompany(companyId);
  return new Map(categories.map((category) => [category.id, category.name]));
}

export function toProductSummary(
  product: ProductDocument,
  categoryNameById: CategoryNameMap,
): ProductResponse {
  const categoryId = product.categoryId.toString();
  return {
    id: product.id,
    companyId: product.companyId.toString(),
    code: product.code ?? null,
    sku: product.sku,
    name: product.name,
    description: product.description ?? null,
    categoryId,
    // Una BD alterada no amplía la categoría visible: fallback explícito.
    categoryName: categoryNameById.get(categoryId) ?? UNKNOWN_CATEGORY,
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
    taxes: (product.taxes ?? []).map(
      (tax): ProductTax => ({ name: tax.name, rate: tax.rate }),
    ),
    unit: product.unit,
    isActive: product.isActive,
    image: product.image ?? null,
    barcode: product.barcode ?? null,
    createdAt: product.createdAt ? product.createdAt.toISOString() : null,
    updatedAt: product.updatedAt ? product.updatedAt.toISOString() : null,
  };
}

/** El recurso debe pertenecer a la empresa del actor; si no, 404 (no se filtra su existencia). */
async function findScopedOr404(companyId: string, id: string): Promise<ProductDocument> {
  const product = await productsRepository.findById(id);
  if (!product || product.companyId.toString() !== companyId) {
    throw new NotFoundError('Producto no encontrado');
  }
  return product;
}

/** La categoría indicada debe existir dentro de la MISMA empresa del actor. */
async function requireCategoryInCompany(companyId: string, categoryId: string): Promise<void> {
  const category = await categoriesRepository.findById(categoryId);
  if (!category || category.companyId.toString() !== companyId) {
    throw new BadRequestError('La categoría indicada no existe', 'CATEGORY_NOT_FOUND');
  }
}

async function requireSkuAvailable(
  companyId: string,
  sku: string,
  excludeProductId?: string,
): Promise<void> {
  const existing = await productsRepository.findBySku(companyId, sku);
  if (existing && existing.id !== excludeProductId) {
    throw new ConflictError(
      'Ya existe un producto con ese SKU en esta empresa',
      'SKU_IN_USE',
    );
  }
}

export const productsService = {
  async list(
    companyId: string,
    query: ListProductsQueryInput,
  ): Promise<{ items: ProductResponse[]; meta: PaginationMeta }> {
    const { products, total } = await productsRepository.list(companyId, query);
    const names = await categoryNameMap(companyId);
    return {
      items: products.map((product) => toProductSummary(product, names)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async get(companyId: string, id: string): Promise<ProductResponse> {
    const product = await findScopedOr404(companyId, id);
    return toProductSummary(product, await categoryNameMap(companyId));
  },

  async create(
    companyId: string,
    input: CreateProductInput,
    actorId: string,
  ): Promise<ProductResponse> {
    await requireCategoryInCompany(companyId, input.categoryId);
    await requireSkuAvailable(companyId, input.sku);

    const product = await productsRepository.create({ companyId, ...input });
    logger.info({ productId: product.id, sku: product.sku, actorId, companyId }, 'Producto creado');
    return toProductSummary(product, await categoryNameMap(companyId));
  },

  async update(
    companyId: string,
    id: string,
    input: UpdateProductInput,
    actorId: string,
  ): Promise<ProductResponse> {
    const product = await findScopedOr404(companyId, id);

    if (input.sku !== undefined && input.sku !== product.sku) {
      await requireSkuAvailable(companyId, input.sku, product.id);
    }
    if (input.categoryId !== undefined && input.categoryId !== product.categoryId.toString()) {
      await requireCategoryInCompany(companyId, input.categoryId);
    }

    await productsRepository.saveChanges(product, input);
    logger.info(
      { productId: product.id, actorId, fields: Object.keys(input) },
      'Producto actualizado',
    );
    return toProductSummary(product, await categoryNameMap(companyId));
  },
};
