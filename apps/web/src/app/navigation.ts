import { canAccessPath } from './access';

const landingPages: Array<[string, string[]]> = [
  ['/dashboard', ['dashboard.read']], ['/products', ['products.read']], ['/sales', ['sales.read']],
  ['/purchases', ['purchases.read']], ['/inventory', ['inventory.read']], ['/customers', ['customers.read']],
  ['/suppliers', ['suppliers.read']], ['/warehouses', ['warehouses.read']], ['/categories', ['categories.read']],
  ['/branches', ['branches.read']], ['/companies', ['companies.read']], ['/reports', ['reports.read']], ['/reports', ['reports.export']],
  ['/users', ['users.read']], ['/roles', ['roles.read']], ['/audit', ['audit.read']],
  ['/products/new', ['products.write', 'categories.read']], ['/sales/new', ['sales.write', 'customers.read', 'warehouses.read', 'products.read']],
  ['/purchases/new', ['purchases.write', 'suppliers.read', 'warehouses.read', 'products.read']],
  ['/inventory/movements/new', ['inventory.write', 'products.read', 'warehouses.read']],
  ['/categories/new', ['categories.write']],
  ['/customers/new', ['customers.write']], ['/suppliers/new', ['suppliers.write']],
  ['/warehouses/new', ['warehouses.write']], ['/branches/new', ['branches.write']],
  ['/companies/new', ['companies.write']], ['/users/new', ['users.write', 'roles.read']],
  ['/roles/new', ['roles.write', 'roles.read']],
];

export function getLandingPath(
  permissions: string[],
  excludePath = typeof window === 'undefined' ? '' : window.location.pathname,
) {
  return landingPages.find(([path, required]) => path !== excludePath
    && canAccessPath(path, (permission) => permissions.includes(permission))
    && required.every((permission) => permissions.includes(permission)))?.[0] ?? '/change-password';
}
