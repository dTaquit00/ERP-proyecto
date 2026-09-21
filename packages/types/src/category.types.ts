/** Vista de una categoría para listados y detalle (M06). */
export interface CategoryResponse {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  /** Número de productos asociados a la categoría. */
  productCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}
