/**
 * Catálogo de permisos (RBAC).
 * El backend verifica estos permisos en cada operación protegida;
 * ocultar botones en el frontend NO es autorización.
 */
export const PERMISSIONS = [
  // M02 / M03 — usuarios y roles
  'users.read',
  'users.write',
  'roles.read',
  'roles.write',
  // M04 / M05 — empresas y sucursales
  'companies.read',
  'companies.write',
  'branches.read',
  'branches.write',
  // M06 / M07 — categorías y productos
  'categories.read',
  'categories.write',
  'products.read',
  'products.write',
  // M08 / M09 — clientes y proveedores
  'customers.read',
  'customers.write',
  'suppliers.read',
  'suppliers.write',
  // M10 / M11 — almacenes e inventario
  'warehouses.read',
  'warehouses.write',
  'inventory.read',
  'inventory.write',
  'inventory.transfer',
  // M12 — ventas
  'sales.read',
  'sales.write',
  'sales.cancel',
  'sales.return',
  // M13 — compras
  'purchases.read',
  'purchases.write',
  'purchases.receive',
  'purchases.cancel',
  // M14 / M15 / M16 — dashboard, reportes, auditoría
  'dashboard.read',
  'reports.read',
  'reports.export',
  'audit.read',
  // Configuración
  'settings.read',
  'settings.write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Guardia de tipo: valida que un string pertenezca al catálogo de permisos. */
export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** Roles iniciales del sistema (M03). */
export const ROLE_NAMES = [
  'administrador',
  'gerente',
  'vendedor',
  'almacen',
  'compras',
  'finanzas',
  'auditor',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];
