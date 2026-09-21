import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Express } from 'express';
import { createApp } from '@erp/api';
import { PERMISSIONS } from '@erp/types';
import { CompanyModel, type CompanyDocument } from '../../apps/api/src/modules/companies/companies.model.js';
import { RoleModel, type RoleDocument } from '../../apps/api/src/modules/roles/roles.model.js';
import { UserModel, type UserDocument } from '../../apps/api/src/modules/users/users.model.js';
import { hashPassword } from '../../apps/api/src/shared/security/password.js';

export const TEST_PASSWORD = 'Passw0rd123';

export interface TestContext {
  app: Express;
  mongod: MongoMemoryServer;
  company: CompanyDocument;
  otherCompany: CompanyDocument;
  adminRole: RoleDocument;
  admin: UserDocument;
  inactiveUser: UserDocument;
  otherCompanyAdmin: UserDocument;
}

/** Levanta MongoDB en memoria + la app Express y siembra datos base. */
export async function setupTestContext(): Promise<TestContext> {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const company = await CompanyModel.create({ name: 'Empresa Test', status: 'active' });
  const otherCompany = await CompanyModel.create({ name: 'Empresa B', status: 'active' });

  const adminRole = await RoleModel.create({
    companyId: company.id,
    name: 'administrador',
    displayName: 'Administrador',
    permissions: [...PERMISSIONS],
    isSystem: true,
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

  const otherCompanyAdmin = await UserModel.create({
    companyId: otherCompany.id,
    email: 'admin@other.local',
    passwordHash: await hashPassword(TEST_PASSWORD),
    firstName: 'Bob',
    lastName: 'Otro',
    roleId: adminRole.id,
    isActive: true,
  });

  return {
    app: createApp(),
    mongod,
    company,
    otherCompany,
    adminRole,
    admin,
    inactiveUser,
    otherCompanyAdmin,
  };
}

export async function teardownTestContext(ctx: TestContext): Promise<void> {
  await mongoose.disconnect();
  await ctx.mongod.stop();
}
