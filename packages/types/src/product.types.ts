/** Impuesto configurable de un producto (M07): porcentaje sobre el precio. */
export interface ProductTax {
  name: string;
  /** Tasa en porcentaje (0–100). */
  rate: number;
}

/** Vista de un producto para listados y detalle (M07). */
export interface ProductResponse {
  id: string;
  companyId: string;
  code: string | null;
  /** SKU único dentro de la empresa (normalizado en mayúsculas). */
  sku: string;
  name: string;
  description: string | null;
  categoryId: string;
  /** Nombre de categoría resuelto por el backend (fallback explícito si falta). */
  categoryName: string;
  purchasePrice: number;
  salePrice: number;
  taxes: ProductTax[];
  unit: string;
  isActive: boolean;
  image: string | null;
  barcode: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
