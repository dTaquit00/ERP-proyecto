import { PERMISSIONS, ROLE_NAMES, type Permission, type RoleName } from '@erp/types';

/**
 * Definición de los 7 roles del sistema (M03).
 * Fuente única compartida por el seed y las pruebas: sin lógica duplicada.
 */

const SYSTEM_ROLE_DISPLAY_NAMES: Record<RoleName, string> = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  almacen: 'Almacén',
  compras: 'Compras',
  finanzas: 'Finanzas',
  auditor: 'Auditor',
};

const READ_ONLY: Permission[] = [
  'users.read',
  'roles.read',
  'companies.read',
  'branches.read',
  'categories.read',
  'products.read',
  'customers.read',
  'suppliers.read',
  'warehouses.read',
  'inventory.read',
  'sales.read',
  'purchases.read',
  'dashboard.read',
  'reports.read',
  'reports.export',
  'settings.read',
];

const SYSTEM_ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  administrador: [...PERMISSIONS],
  gerente: [
    'branches.read',
    'branches.write',
    'categories.read',
    'categories.write',
    'products.read',
    'products.write',
    'customers.read',
    'customers.write',
    'suppliers.read',
    'suppliers.write',
    'warehouses.read',
    'inventory.read',
    'inventory.write',
    'inventory.adjust',
    'inventory.transfer',
    'sales.read',
    'sales.write',
    'sales.confirm',
    'sales.cancel',
    'sales.return',
    'purchases.read',
    'purchases.write',
    'purchases.confirm',
    'purchases.receive',
    'purchases.cancel',
    'dashboard.read',
    'reports.read',
    'reports.export',
    'companies.read',
    'settings.read',
  ],
  vendedor: [
    'dashboard.read',
    'products.read',
    'categories.read',
    'customers.read',
    'customers.write',
    'inventory.read',
    'sales.read',
    'sales.write',
    'sales.confirm',
    'sales.return',
    'reports.read',
  ],
  almacen: [
    'dashboard.read',
    'products.read',
    'categories.read',
    'customers.read',
    'suppliers.read',
    'warehouses.read',
    'warehouses.write',
    'inventory.read',
    'inventory.write',
    'inventory.adjust',
    'inventory.transfer',
    'purchases.read',
    'purchases.receive',
  ],
  compras: [
    'dashboard.read',
    'products.read',
    'products.write',
    'categories.read',
    'categories.write',
    'suppliers.read',
    'suppliers.write',
    'customers.read',
    'inventory.read',
    'purchases.read',
    'purchases.write',
    'purchases.confirm',
    'purchases.receive',
    'purchases.cancel',
    'reports.read',
  ],
  finanzas: [
    'dashboard.read',
    'sales.read',
    'purchases.read',
    'customers.read',
    'suppliers.read',
    'products.read',
    'reports.read',
    'reports.export',
  ],
  auditor: [...READ_ONLY, 'audit.read'],
};

export interface SystemRoleDefinition {
  name: RoleName;
  displayName: string;
  permissions: Permission[];
}

export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = ROLE_NAMES.map((name) => ({
  name,
  displayName: SYSTEM_ROLE_DISPLAY_NAMES[name],
  permissions: SYSTEM_ROLE_PERMISSIONS[name],
}));
