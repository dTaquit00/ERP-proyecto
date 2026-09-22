/** Vista de un almacén para listados y detalle (M10). */
export interface WarehouseResponse {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  /** Sucursal asociada (M05). Opcional: la validación FK se activa en Fase 13. */
  branchId: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}
