import { Types, type FilterQuery } from 'mongoose';
import type { ListProductsQueryInput } from '@erp/validation';
import { escapeRegExp } from '../../shared/utils/regex.js';
import { ProductModel, type ProductDocument, type ProductSchemaType } from './products.model.js';
import type { ProductCreateInput, ProductFieldChanges, ProductListResult } from './products.types.js';

/**
 * Construye el filtro de listado. El scope multiempresa (`companyId`) SIEMPRE
 * se aplica aquí: el filtro del cliente nunca puede ampliar el alcance.
 * La búsqueda cubre nombre, SKU, código interno y código de barras (escape de regex).
 */
export function buildProductFilter(
  companyId: string,
  query: ListProductsQueryInput,
): FilterQuery<ProductSchemaType> {
  const filter: FilterQuery<ProductSchemaType> = {
    companyId: new Types.ObjectId(companyId),
  };
  if (query.categoryId) filter.categoryId = new Types.ObjectId(query.categoryId);
  if (query.status) filter.isActive = query.status === 'active';
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [
      { name: pattern },
      { sku: pattern },
      { code: pattern },
      { barcode: pattern },
    ];
  }
  return filter;
}

export const productsRepository = {
  async findById(id: string): Promise<ProductDocument | null> {
    return ProductModel.findById(id).exec();
  },

  async findBySku(companyId: string, sku: string): Promise<ProductDocument | null> {
    return ProductModel.findOne({ companyId, sku }).exec();
  },

  /** Productos de la empresa por ids (para resolver nombres en inventario). */
  async findManyByIds(companyId: string, ids: string[]): Promise<ProductDocument[]> {
    if (ids.length === 0) return [];
    return ProductModel.find({ companyId, _id: { $in: ids } }).exec();
  },

  /** Listado paginado con filtros, búsqueda y orden seguros. */
  async list(companyId: string, query: ListProductsQueryInput): Promise<ProductListResult> {
    const filter = buildProductFilter(companyId, query);
    const sort: Record<string, 1 | -1> = {
      [query.sort]: query.order === 'asc' ? 1 : -1,
    };
    const skip = (query.page - 1) * query.limit;

    const [products, total] = await Promise.all([
      ProductModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      ProductModel.countDocuments(filter).exec(),
    ]);
    return { products, total };
  },

  async create(input: ProductCreateInput): Promise<ProductDocument> {
    return ProductModel.create(input);
  },

  async saveChanges(
    product: ProductDocument,
    changes: ProductFieldChanges,
  ): Promise<ProductDocument> {
    if (changes.code !== undefined) product.code = changes.code;
    if (changes.sku !== undefined) product.sku = changes.sku;
    if (changes.name !== undefined) product.name = changes.name;
    if (changes.description !== undefined) product.description = changes.description;
    if (changes.categoryId !== undefined) product.categoryId = new Types.ObjectId(changes.categoryId);
    if (changes.purchasePrice !== undefined) product.purchasePrice = changes.purchasePrice;
    if (changes.salePrice !== undefined) product.salePrice = changes.salePrice;
    if (changes.taxes !== undefined) product.taxes = changes.taxes;
    if (changes.unit !== undefined) product.unit = changes.unit;
    if (changes.isActive !== undefined) product.isActive = changes.isActive;
    if (changes.image !== undefined) product.image = changes.image;
    if (changes.barcode !== undefined) product.barcode = changes.barcode;
    await product.save();
    return product;
  },

  /** Productos por categoría de la empresa (una sola consulta) — para `productCount`. */
  async countProductsByCategory(companyId: string): Promise<Map<string, number>> {
    const rows = await ProductModel.aggregate<{ _id: Types.ObjectId | null; count: number }>([
      { $match: { companyId: new Types.ObjectId(companyId) } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]).exec();

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row._id) counts.set(row._id.toString(), row.count);
    }
    return counts;
  },
};
