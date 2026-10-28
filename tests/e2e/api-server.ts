import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

const apiPort = Number(process.env.E2E_API_PORT ?? 3410);
const webOrigin = 'http://127.0.0.1:4173';
const testPassword = 'E2e-Only-Passw0rd!';

// Always create a fresh in-memory replica set. Never read MONGODB_URI from .env.
let mongoDataPath: string | undefined;
let mongod: MongoMemoryReplSet | undefined;
Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'e2e-only-access-secret-never-used-outside-tests',
  JWT_REFRESH_SECRET: 'e2e-only-refresh-secret-never-used-outside-tests',
  CORS_ORIGIN: webOrigin,
  WEB_APP_URL: webOrigin,
  LOG_LEVEL: 'silent',
  RATE_LIMIT_MAX: '1000',
  RATE_LIMIT_AUTH_MAX: '1000',
});

let server: Server | undefined;
let stopping: Promise<void> | undefined;

async function stop(): Promise<void> {
  if (stopping) return stopping;
  stopping = (async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => error ? reject(error) : resolve());
      });
    }
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
    if (mongoDataPath) await rm(mongoDataPath, { recursive: true, force: true });
  })();
  return stopping;
}

process.once('SIGINT', () => { void stop().finally(() => process.exit(0)); });
process.once('SIGTERM', () => { void stop().finally(() => process.exit(0)); });

try {
  mongoDataPath = await mkdtemp(join(process.cwd(), '.e2e-mongo-'));
  const replicaSet = await MongoMemoryReplSet.create({
    instanceOpts: [{ dbPath: mongoDataPath }],
    replSet: { count: 1 },
  });
  mongod = replicaSet;
  process.env.MONGODB_URI = replicaSet.getUri();
  await mongoose.connect(replicaSet.getUri());

  const [
    { createApp },
    { CompanyModel },
    { RoleModel },
    { rolesService },
    { UserModel },
    { CustomerModel },
    { WarehouseModel },
    { hashPassword },
  ] = await Promise.all([
    import('../../apps/api/src/app.js'),
    import('../../apps/api/src/modules/companies/companies.model.js'),
    import('../../apps/api/src/modules/roles/roles.model.js'),
    import('../../apps/api/src/modules/roles/roles.service.js'),
    import('../../apps/api/src/modules/users/users.model.js'),
    import('../../apps/api/src/modules/customers/customers.model.js'),
    import('../../apps/api/src/modules/warehouses/warehouses.model.js'),
    import('../../apps/api/src/shared/security/password.js'),
  ]);

  const company = await CompanyModel.create({ name: 'DATA ERP Playwright E2E', status: 'active' });
  await rolesService.ensureSystemRoles(company.id);
  const passwordHash = await hashPassword(testPassword);
  const roleNames = ['administrador', 'gerente', 'vendedor', 'almacen', 'compras', 'finanzas', 'auditor'];
  for (const roleName of roleNames) {
    const role = await RoleModel.findOne({ companyId: company.id, name: roleName });
    if (!role) throw new Error(`No existe el rol E2E ${roleName}`);
    await UserModel.create({
      companyId: company.id,
      email: `${roleName}@e2e.local`,
      passwordHash,
      firstName: role.displayName,
      lastName: 'E2E',
      roleId: role.id,
      isActive: true,
    });
  }
  await CustomerModel.create({ companyId: company.id, name: 'Cliente Playwright E2E', isActive: true });
  await WarehouseModel.create({ companyId: company.id, name: 'Almacén Playwright E2E', isActive: true });

  server = createApp().listen(apiPort, '127.0.0.1');
  server.on('listening', () => process.stdout.write(`E2E API ready on 127.0.0.1:${apiPort}\n`));
} catch (error) {
  await stop().catch(() => undefined);
  throw error;
}
