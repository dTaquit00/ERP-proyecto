import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { createApp } from '@erp/api';
import { CompanyModel, type CompanyDocument } from '../../apps/api/src/modules/companies/companies.model.js';
import { RoleModel, type RoleDocument } from '../../apps/api/src/modules/roles/roles.model.js';
import { rolesService } from '../../apps/api/src/modules/roles/roles.service.js';
import { UserModel, type UserDocument } from '../../apps/api/src/modules/users/users.model.js';
import { hashPassword } from '../../apps/api/src/shared/security/password.js';

export const TEST_PASSWORD = 'Passw0rd123';

export interface TestContext {
  app: Express;
  mongod: MongoMemoryServer;
  company: CompanyDocument;
  otherCompany: CompanyDocument;
  adminRole: RoleDocument;
  /** Rol con users.* + roles.read (sin roles.write) — para pruebas RBAC positivas. */
  writerRole: RoleDocument;
  /** Rol mínimo sin permisos de usuarios — para pruebas RBAC negativas. */
  limitedRole: RoleDocument;
  admin: UserDocument;
  inactiveUser: UserDocument;
  writerUser: UserDocument;
  limitedUser: UserDocument;
  otherCompanyAdmin: UserDocument;
}

/** Levanta MongoDB en memoria + la app Express y siembra datos base. */
export async function setupTestContext(): Promise<TestContext> {
  const mongod = await MongoMemoryServer.create();
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

  const otherCompanyAdmin = await UserModel.create({
    companyId: otherCompany.id,
    email: 'admin@other.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Bob',
    lastName: 'Otro',
    roleId: otherAdminRole.id,
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
    admin,
    inactiveUser,
    writerUser,
    limitedUser,
    otherCompanyAdmin,
  };
}

export async function teardownTestContext(ctx: TestContext): Promise<void> {
  await mongoose.disconnect();
  await ctx.mongod.stop();
}
