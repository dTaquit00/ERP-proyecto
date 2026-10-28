export interface User {
  id: string;
  email: string;
  name: string;
  roleId: string;
  companyId: string;
  isActive: boolean;
}

export interface DashboardSummary {
  ventasHoy: number;
  ventasMes: number;
  comprasMes: number;
  stockBajo: number;
  productosAgotados: number;
  inventarioValorizado: number;
  ventasRecientes?: Array<{
    id: string;
    code: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  productCount?: number;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName?: string;
  purchasePrice: number;
  salePrice: number;
  taxPercentage: number;
  unit: string;
  minStock?: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface Customer {
  id: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactName?: string;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  branchId?: string;
  isActive: boolean;
}

export interface StockBalance {
  id: string;
  productId: string;
  productSku?: string;
  productName?: string;
  warehouseId: string;
  warehouseName?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStock?: number;
  isLowStock?: boolean;
}

export interface InventoryMovement {
  id: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN';
  productId: string;
  productName?: string;
  productSku?: string;
  warehouseId: string;
  warehouseName?: string;
  targetWarehouseId?: string;
  targetWarehouseName?: string;
  quantity: number;
  reason?: string;
  referenceDocument?: string;
  createdAt: string;
  userName?: string;
}

export interface SaleItem {
  id?: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxPercentage: number;
  subtotal: number;
  taxTotal: number;
  total: number;
}

export interface Sale {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  warehouseName?: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'RETURNED';
  subtotal: number;
  taxTotal: number;
  total: number;
  items: SaleItem[];
  notes?: string;
  createdAt: string;
  userName?: string;
}

export interface PurchaseItem {
  id?: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Purchase {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName?: string;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  total: number;
  items: PurchaseItem[];
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
