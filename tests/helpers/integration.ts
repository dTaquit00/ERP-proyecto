import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { createApp } from '@erp/api';
import { CompanyModel, type CompanyDocument } from '../../apps/api/src/modules/companies/companies.model.js';
import { RoleModel, type RoleDocument } from '../../apps/api/src/modules/roles/roles.model.js';
import { rolesService } from '../../apps/api/src/modules/roles/roles.service.js';
import { UserModel, type UserDocument } from '../../apps/api/src/modules/users/users.model.js';
import { CategoryModel, type CategoryDocument } from '../../apps/api/src/modules/categories/categories.model.js';
import { hashPassword } from '../../apps/api/src/shared/security/password.js';

export const TEST_PASSWORD = 'Passw0rd123';

export interface TestContext {
  app: Express;
  mongod: MongoMemoryReplSet;
  company: CompanyDocument;
  otherCompany: CompanyDocument;
  adminRole: RoleDocument;
  /** Rol con users.* + roles.read (sin roles.write) — para pruebas RBAC positivas. */
  writerRole: RoleDocument;
  /** Rol mínimo sin permisos de usuarios — para pruebas RBAC negativas. */
  limitedRole: RoleDocument;
  /** Rol catálogo: categories.* + products.read (sin products.write) — Fase 8. */
  catalogRole: RoleDocument;
  /** Rol almacén: warehouses.* + inventory.read/write (SIN inventory.transfer) — Fase 9. */
  stockRole: RoleDocument;
  admin: UserDocument;
  inactiveUser: UserDocument;
  writerUser: UserDocument;
  limitedUser: UserDocument;
  catalogUser: UserDocument;
  stockUser: UserDocument;
  otherCompanyAdmin: UserDocument;
  /** Categoría activa base de la empresa (para pruebas de productos). */
  baseCategory: CategoryDocument;
  /** Categoría desactivada (filtro `status=inactive`). */
  inactiveCategory: CategoryDocument;
  /** Categoría de OTRA empresa (aislamiento / CATEGORY_NOT_FOUND). */
  otherCompanyCategory: CategoryDocument;
}

/**
 * Levanta MongoDB en memoria + la app Express y siembra datos base.
 * Replica set de un nodo (desde Fase 11): las ventas confirman/cancelan con
 * transacciones multi-documento, que exigen topología de replica set (lo mismo
 * que ya ofrece MongoDB Atlas en producción).
 */
export async function setupTestContext(): Promise<TestContext> {
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());

  const company = await CompanyModel.create({ name: 'Empresa Test', status: 'active' });
  const otherCompany = await CompanyModel.create({ name: 'Empresa B', status: 'active' });

  // Los 7 roles del sistema para AMBAS empresas (misma fuente única que el seed).
  await rolesService.ensureSystemRoles(company.id);
  await rolesService.ensureSystemRoles(otherCompany.id);

  const adminRole = (await RoleModel.findOne({ companyId: company.id, name: 'administrador' }))!;
  const otherAdminRole = (await RoleModel.findOne({
    companyId: otherCompany.id,
    name: 'administrador',
  }))!;

  const writerRole = await RoleModel.create({
    companyId: company.id,
    name: 'gestor',
    displayName: 'Gestor',
    permissions: ['users.read', 'users.write', 'roles.read'],
    isSystem: false,
  });

  const limitedRole = await RoleModel.create({
    companyId: company.id,
    name: 'basico',
    displayName: 'Básico',
    permissions: ['dashboard.read'],
    isSystem: false,
  });

  const catalogRole = await RoleModel.create({
    companyId: company.id,
    name: 'catalogo',
    displayName: 'Catálogo',
    permissions: ['categories.read', 'categories.write', 'products.read'],
    isSystem: false,
  });

  const stockRole = await RoleModel.create({
    companyId: company.id,
    name: 'almacenero',
    displayName: 'Almacenero',
    permissions: ['warehouses.read', 'warehouses.write', 'inventory.read', 'inventory.write'],
    isSystem: false,
  });

  const admin = await UserModel.create({
    companyId: company.id,
    email: 'admin@test.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Ada',
    lastName: 'Admin',
    roleId: adminRole.id,
    isActive: true,
  });

  const inactiveUser = await UserModel.create({
    companyId: company.id,
    email: 'inactive@test.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Ina',
    lastName: 'Activa',
    roleId: adminRole.id,
    isActive: false,
  });

  const writerUser = await UserModel.create({
    companyId: company.id,
    email: 'writer@test.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Walter',
    lastName: 'Writer',
    roleId: writerRole.id,
    isActive: true,
  });

  const limitedUser = await UserModel.create({
    companyId: company.id,
    email: 'limited@test.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Lola',
    lastName: 'Limited',
    roleId: limitedRole.id,
    isActive: true,
  });

  const catalogUser = await UserModel.create({
    companyId: company.id,
    email: 'catalog@test.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Cata',
    lastName: 'Logo',
    roleId: catalogRole.id,
    isActive: true,
  });

  const stockUser = await UserModel.create({
    companyId: company.id,
    email: 'stock@test.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Santi',
    lastName: 'Stock',
    roleId: stockRole.id,
    isActive: true,
  });

  const otherCompanyAdmin = await UserModel.create({
    companyId: otherCompany.id,
    email: 'admin@other.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Bob',
    lastName: 'Otro',
    roleId: otherAdminRole.id,
    isActive: true,
  });

  // Categorías base (Fase 8): una activa, una desactivada y una ajena a otra empresa.
  const baseCategory = await CategoryModel.create({
    companyId: company.id,
    name: 'General',
    description: 'Categoría base de pruebas',
    isActive: true,
  });
  const inactiveCategory = await CategoryModel.create({
    companyId: company.id,
    name: 'Obsoleta',
    isActive: false,
  });
  const otherCompanyCategory = await CategoryModel.create({
    companyId: otherCompany.id,
    name: 'Ajena',
    isActive: true,
  });

  return {
    app: createApp(),
    mongod,
    company,
    otherCompany,
    adminRole,
    writerRole,
    limitedRole,
    catalogRole,
    stockRole,
    admin,
    inactiveUser,
    writerUser,
    limitedUser,
    catalogUser,
    stockUser,
    otherCompanyAdmin,
    baseCategory,
    inactiveCategory,
    otherCompanyCategory,
  };
}

export async function teardownTestContext(ctx: TestContext): Promise<void> {
  await mongoose.disconnect();
  await ctx.mongod.stop();
}
