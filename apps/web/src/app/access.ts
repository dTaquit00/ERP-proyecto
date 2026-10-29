type Can = (permission: string) => boolean;

export const reportOptions = [
  { type: 'sales', label: 'Ventas', permission: 'sales.read' },
  { type: 'purchases', label: 'Compras', permission: 'purchases.read' },
  { type: 'inventory', label: 'Inventario', permission: 'inventory.read' },
  { type: 'inventory-movements', label: 'Movimientos de inventario', permission: 'inventory.read' },
  { type: 'products', label: 'Productos', permission: 'products.read' },
  { type: 'customers', label: 'Clientes', permission: 'customers.read' },
  { type: 'suppliers', label: 'Proveedores', permission: 'suppliers.read' },
] as const;

export function availableReports(can: Can) {
  return can('reports.read') || can('reports.export')
    ? reportOptions.filter((report) => can(report.permission)) : [];
}

/** Shared by the sidebar and route boundary; denied pages never mount. */
export function canAccessPath(path: string, can: Can): boolean {
  const parts = path.split('/').filter(Boolean);
  const resource = parts[0];
  if (!resource || resource === 'change-password') return true;
  if (resource === 'reports') return availableReports(can).length > 0;
  if (resource === 'dashboard') return can('dashboard.read');
  if (resource === 'audit') return can('audit.read');
  if (resource === 'inventory') {
    return parts[1] === 'movements' && parts[2] === 'new'
      ? ['inventory.write', 'products.read', 'warehouses.read'].every(can)
      : can('inventory.read');
  }
  if (resource === 'purchases' && parts[2] === 'receive') {
    return can('purchases.read') && can('purchases.receive');
  }
  const known = ['products', 'categories', 'customers', 'suppliers', 'warehouses', 'branches', 'companies', 'users', 'roles', 'sales', 'purchases'];
  if (!known.includes(resource)) return false;
  if (parts[1] !== 'new') return can(`${resource}.read`);
  const dependencies: Record<string, string[]> = {
    products: ['categories.read'], users: ['roles.read'], roles: ['roles.read'],
    sales: ['customers.read', 'warehouses.read', 'products.read'],
    purchases: ['suppliers.read', 'warehouses.read', 'products.read'],
  };
  return [ `${resource}.write`, ...(dependencies[resource] ?? []) ].every(can);
}
