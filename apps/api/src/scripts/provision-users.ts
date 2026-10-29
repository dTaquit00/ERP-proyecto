import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ROLE_NAMES, isPermission } from '@erp/types';
import { createUserSchema } from '@erp/validation';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../db/mongoose.js';
import { companiesRepository } from '../modules/companies/companies.repository.js';
import { rolesRepository } from '../modules/roles/roles.repository.js';
import { usersRepository } from '../modules/users/users.repository.js';
import { usersService } from '../modules/users/users.service.js';
import { verifyPassword } from '../shared/security/password.js';

class ProvisionError extends Error {}

const batchSchema = z.array(z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().toLowerCase(),
  roles: z.array(z.enum(ROLE_NAMES)).min(1),
})).min(1).superRefine((rows, context) => {
  if (new Set(rows.map((row) => row.email)).size !== rows.length) {
    context.addIssue({ code: 'custom', message: 'El lote contiene correos duplicados' });
  }
});

async function run() {
  const inputPath = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!inputPath) throw new ProvisionError('Uso: npx tsx apps/api/src/scripts/provision-users.ts archivo.json [--apply]');
  const rows = batchSchema.parse(JSON.parse(await readFile(resolve(inputPath), 'utf8')));
  const accessPath = resolve('.local/users-initial-access.json');
  const credentials: Record<string, string> = apply
    ? await readFile(accessPath, 'utf8').then((text) => z.record(z.string(), z.string()).parse(JSON.parse(text))).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw error;
    }) : {};
  try {
    await connectDatabase();
  } catch (error) {
    await disconnectDatabase();
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'sin código';
    throw new ProvisionError(`No se pudo conectar a MongoDB (${error instanceof Error ? error.name : 'error'}; ${code}). No se han creado cuentas.`);
  }
  try {
    const company = await companiesRepository.findByName(env.SEED_COMPANY_NAME);
    if (!company) throw new ProvisionError('No existe la empresa configurada en SEED_COMPANY_NAME');
    const adminRole = await rolesRepository.findByName(company.id, 'administrador');
    const admin = await usersRepository.findByEmailWithPassword(company.id, env.SEED_ADMIN_EMAIL.toLowerCase());
    if (!admin || !admin.isActive || !adminRole || admin.roleId.toString() !== adminRole.id) {
      throw new ProvisionError('SEED_ADMIN_EMAIL debe identificar al administrador activo de la empresa');
    }
    const availableRoles = await rolesRepository.findByCompany(company.id);
    const plans = await Promise.all(rows.map(async (row) => {
      const names = [...new Set(row.roles)].sort();
      const sourceRoles = names.map((name) => {
        const role = availableRoles.find((candidate) => candidate.name === name && candidate.isSystem);
        if (!role) throw new ProvisionError(`No existe el rol del sistema: ${name}`);
        return role;
      });
      const permissions = [...new Set(sourceRoles.flatMap((role) => role.permissions.filter(isPermission)))].sort();
      const name = names.length === 1 ? names[0]! : `equipo-${names.join('-')}`;
      const displayName = sourceRoles.map((role) => role.displayName).join(' + ');
      const role = availableRoles.find((candidate) => candidate.name === name);
      if (role && [...role.permissions].sort().join(',') !== permissions.join(',')) {
        throw new ProvisionError(`El rol ${name} ya existe con permisos distintos; revisar antes de modificarlo`);
      }
      const existing = await usersRepository.findByEmailWithPassword(company.id, row.email);
      if (existing?.roleId.toString() === adminRole.id && role?.id !== adminRole.id) {
        if (!permissions.every((permission) => adminRole.permissions.includes(permission))) {
          throw new ProvisionError(`La cuenta ${row.email} es administradora y requiere revisión de permisos`);
        }
        return { row, name: adminRole.name, displayName: `${adminRole.displayName} (conservado; incluye ${displayName})`, permissions: adminRole.permissions.filter(isPermission), role: adminRole, existing };
      }
      return { row, name, displayName, permissions, role, existing };
    }));
    console.info(`Empresa: ${company.name} (${company.id}). Modo: ${apply ? 'aplicar' : 'vista previa'}`);
    for (const plan of plans) {
      console.info(`${plan.existing ? 'Verificar/actualizar' : 'Crear'}: ${plan.row.email} — ${plan.displayName}`);
      if (!apply) continue;
      const role = plan.role ?? await rolesRepository.findByName(company.id, plan.name)
        ?? await rolesRepository.create({ companyId: company.id, name: plan.name, displayName: plan.displayName, permissions: plan.permissions, isSystem: false });
      if (plan.existing) {
        await usersService.update(company.id, plan.existing.id, {
          firstName: plan.row.firstName, lastName: plan.row.lastName, roleId: role.id,
        }, admin.id);
      } else {
        // Persist before creating so an interrupted run never loses initial access.
        const password = credentials[plan.row.email] ?? randomBytes(24).toString('base64url');
        credentials[plan.row.email] = password;
        await writeFile(accessPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
        const input = createUserSchema.parse({ ...plan.row, roleId: role.id, password, isActive: true });
        await usersService.create(company.id, input, admin.id);
      }
      const saved = await usersRepository.findByEmailWithPassword(company.id, plan.row.email);
      if (!saved || saved.roleId.toString() !== role.id) throw new ProvisionError(`No se verificó la cuenta ${plan.row.email}`);
      const password = credentials[plan.row.email];
      if (password && !await verifyPassword(password, saved.passwordHash)) throw new ProvisionError(`Acceso inicial inválido: ${plan.row.email}`);
    }
    if (apply) console.info(`Cuentas verificadas. Accesos iniciales guardados solo en ${accessPath}`);
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  // Database errors can contain credentials in their URI; never print raw errors.
  console.error(error instanceof ProvisionError ? error.message : 'No se completó el aprovisionamiento. Revisa la conexión, empresa, administrador y roles del lote.');
  process.exitCode = 1;
});
