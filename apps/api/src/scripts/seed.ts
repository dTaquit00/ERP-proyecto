import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../db/mongoose.js';
import { logger } from '../config/logger.js';
import { companiesRepository } from '../modules/companies/companies.repository.js';
import { rolesRepository } from '../modules/roles/roles.repository.js';
import { rolesService } from '../modules/roles/roles.service.js';
import { usersRepository } from '../modules/users/users.repository.js';
import { hashPassword } from '../shared/security/password.js';

/**
 * Seed idempotente (Fase 6, actualizado en Fase 7):
 * crea la empresa inicial, los 7 roles del sistema (vía `rolesService.ensureSystemRoles`,
 * la misma fuente única que usan las pruebas) y el usuario administrador.
 * `npm run seed` — seguro de ejecutar varias veces (upsert por nombre/correo).
 */

async function run(): Promise<void> {
  await connectDatabase();
  try {
    const company = await companiesRepository.findByName(env.SEED_COMPANY_NAME);
    const companyDoc =
      company ??
      (await companiesRepository.create({ name: env.SEED_COMPANY_NAME, status: 'active' }));
    logger.info({ companyId: companyDoc.id }, 'Empresa verificada');

    await rolesService.ensureSystemRoles(companyDoc.id);

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
