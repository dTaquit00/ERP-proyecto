import { randomBytes } from 'node:crypto';
import { PERMISSIONS, ROLE_NAMES, type Permission, type RoleName } from '@erp/types';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../db/mongoose.js';
import { logger } from '../config/logger.js';
import { companiesRepository } from '../modules/companies/companies.repository.js';
import { rolesRepository } from '../modules/roles/roles.repository.js';
import { usersRepository } from '../modules/users/users.repository.js';
import { hashPassword } from '../shared/security/password.js';

/**
 * Seed idempotente (Fase 6):
 * crea la empresa inicial, los 7 roles del sistema y el usuario administrador.
 * `npm run seed` — seguro de ejecutar varias veces (upsert por nombre/correo).
 */

const DISPLAY_NAMES: Record<RoleName, string> = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  almacen: 'Almacén',
  compras: 'Compras',
  finanzas: 'Finanzas',
  auditor: 'Auditor',
};

const ALL: Permission[] = [...PERMISSIONS];
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

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  administrador: ALL,
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
    'inventory.transfer',
    'sales.read',
    'sales.write',
    'sales.cancel',
    'sales.return',
    'purchases.read',
    'purchases.write',
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

async function run(): Promise<void> {
  await connectDatabase();
  try {
    const company = await companiesRepository.findByName(env.SEED_COMPANY_NAME);
    const companyDoc =
      company ??
      (await companiesRepository.create({ name: env.SEED_COMPANY_NAME, status: 'active' }));
    logger.info({ companyId: companyDoc.id }, 'Empresa verificada');

    for (const roleName of ROLE_NAMES) {
      const existing = await rolesRepository.findByName(companyDoc.id, roleName);
      if (existing) continue;
      await rolesRepository.create({
        companyId: companyDoc.id,
        name: roleName,
        displayName: DISPLAY_NAMES[roleName],
        permissions: ROLE_PERMISSIONS[roleName],
        isSystem: true,
      });
      logger.info({ role: roleName }, 'Rol creado');
    }

    const adminRole = await rolesRepository.findByName(companyDoc.id, 'administrador');
    if (!adminRole) throw new Error('No se pudo crear el rol administrador');

    const adminEmail = env.SEED_ADMIN_EMAIL.toLowerCase();
    const existingAdmin = await usersRepository.findByEmailWithPassword(
      companyDoc.id,
      adminEmail,
    );

    let generatedPassword: string | null = null;
    let password = env.SEED_ADMIN_PASSWORD;
    if (!password) {
      generatedPassword = randomBytes(12).toString('base64url');
      password = generatedPassword;
    }

    if (!existingAdmin) {
      await usersRepository.create({
        companyId: companyDoc.id,
        email: adminEmail,
        passwordHash: await hashPassword(password),
        firstName: 'Admin',
        lastName: 'Sistema',
        roleId: adminRole.id,
        isActive: true,
      });
      console.warn(`Usuario administrador creado: ${adminEmail}`);
    } else {
      console.warn(`Usuario administrador ya existía: ${adminEmail}`);
    }

    if (generatedPassword) {
      console.warn('');
      console.warn('  Contraseña generada para el administrador (guárdala ahora):');
      console.warn(`  ${generatedPassword}`);
      console.warn('  Define SEED_ADMIN_PASSWORD en .env para fijar una contraseña propia.');
      console.warn('');
    }

    console.warn('Seed completado.');
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, 'Error durante el seed');
  process.exitCode = 1;
});
