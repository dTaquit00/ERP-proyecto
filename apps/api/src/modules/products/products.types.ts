/** Contratos internos del módulo de productos (M07). */
import type { ProductTax } from '@erp/types';
import type { ProductDocument } from './products.model.js';

export interface ProductCreateInput {
  companyId: string;
  code?: string;
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  purchasePrice: number;
  salePrice: number;
  taxes: ProductTax[];
  unit: string;
  isActive: boolean;
  image?: string;
  barcode?: string;
}

export interface ProductFieldChanges {
  code?: string | null;
  sku?: string;
  name?: string;
  description?: string | null;
  categoryId?: string;
  purchasePrice?: number;
  salePrice?: number;
  taxes?: ProductTax[];
  unit?: string;
  isActive?: boolean;
  image?: string | null;
  barcode?: string | null;
}

export interface ProductListResult {
  products: ProductDocument[];
  total: number;
}
