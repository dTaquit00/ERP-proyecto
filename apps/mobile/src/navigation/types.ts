export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  ProductDetail: { productId: string };
  ProductForm: { productId?: string };
  SaleDetail: { saleId: string };
  NewSale: undefined;
  MovementForm: undefined;
  CustomerForm: { customerId?: string };
  SupplierForm: { supplierId?: string };
  Purchases: undefined;
  Suppliers: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Sales: undefined;
  Products: undefined;
  Inventory: undefined;
  Customers: undefined;
  More: undefined;
};
