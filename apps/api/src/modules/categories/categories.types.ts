/** Contratos internos del módulo de categorías (M06). */
import type { CategoryDocument } from './categories.model.js';

export interface CategoryCreateInput {
  companyId: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface CategoryFieldChanges {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CategoryListResult {
  categories: CategoryDocument[];
  total: number;
}
