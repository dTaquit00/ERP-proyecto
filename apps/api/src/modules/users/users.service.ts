import type { PaginationMeta, UserSummary } from '@erp/types';
import type { CreateUserInput, ListUsersQueryInput, UpdateUserInput } from '@erp/validation';
import { hashPassword } from '../../shared/security/password.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/http/errors.js';
import { logger } from '../../config/logger.js';
import { usersRepository } from './users.repository.js';
import type { UserDocument } from './users.model.js';
import { rolesRepository } from '../roles/roles.repository.js';
import { sessionsRepository } from '../auth/auth.sessions.repository.js';
import type { UserHistoryResponse } from './users.types.js';

/** Mapa roleId → nombre de rol de la empresa (una sola consulta). */
async function roleNameMap(companyId: string): Promise<Map<string, string>> {
  const roles = await rolesRepository.findByCompany(companyId);
  return new Map(roles.map((role) => [role.id, role.name]));
}

export function toUserSummary(
  user: UserDocument,
  roleNameById: Map<string, string>,
): UserSummary {
  const roleId = user.roleId.toString();
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    companyId: user.companyId.toString(),
    roleId,
    // Una BD alterada no amplía el rol visible: fallback explícito.
    roleName: roleNameById.get(roleId) ?? 'desconocido',
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt ? user.createdAt.toISOString() : null,
    updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
  };
}

/** El recurso debe pertenecer a la empresa del actor; si no, 404 (no se filtra su existencia). */
async function findScopedOr404(companyId: string, id: string): Promise<UserDocument> {
  const user = await usersRepository.findById(id);
  if (!user || user.companyId.toString() !== companyId) {
    throw new NotFoundError('Usuario no encontrado');
  }
  return user;
}

/** El rol indicado debe existir dentro de la MISMA empresa del actor. */
async function requireRoleInCompany(companyId: string, roleId: string): Promise<void> {
  const role = await rolesRepository.findById(roleId);
  if (!role || role.companyId.toString() !== companyId) {
    throw new BadRequestError('El rol indicado no existe', 'ROLE_NOT_FOUND');
  }
}

async function requireEmailAvailable(
  companyId: string,
  email: string,
  excludeUserId?: string,
): Promise<void> {
  const existing = await usersRepository.findByEmailWithPassword(companyId, email);
  if (existing && existing.id !== excludeUserId) {
    throw new ConflictError('El correo ya está registrado en esta empresa', 'EMAIL_IN_USE');
  }
}

export const usersService = {
  async list(
    companyId: string,
    query: ListUsersQueryInput,
  ): Promise<{ items: UserSummary[]; meta: PaginationMeta }> {
    const { users, total } = await usersRepository.list(companyId, query);
    const roleNameById = await roleNameMap(companyId);
    return {
      items: users.map((user) => toUserSummary(user, roleNameById)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async get(companyId: string, id: string): Promise<UserSummary> {
    const user = await findScopedOr404(companyId, id);
    return toUserSummary(user, await roleNameMap(companyId));
  },

  async create(companyId: string, input: CreateUserInput, actorId: string): Promise<UserSummary> {
    await requireRoleInCompany(companyId, input.roleId);
    await requireEmailAvailable(companyId, input.email);

    const user = await usersRepository.create({
      companyId,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: input.roleId,
      isActive: input.isActive,
    });
    logger.info({ userId: user.id, actorId, companyId }, 'Usuario creado');
    return toUserSummary(user, await roleNameMap(companyId));
  },

  async update(
    companyId: string,
    id: string,
    input: UpdateUserInput,
    actorId: string,
  ): Promise<UserSummary> {
    const user = await findScopedOr404(companyId, id);

    if (input.email !== undefined && input.email !== user.email) {
      await requireEmailAvailable(companyId, input.email, user.id);
    }
    if (input.roleId !== undefined && input.roleId !== user.roleId.toString()) {
      await requireRoleInCompany(companyId, input.roleId);
    }

    await usersRepository.saveChanges(user, input);
    logger.info(
      { userId: user.id, actorId, fields: Object.keys(input) },
      'Usuario actualizado',
    );
    return toUserSummary(user, await roleNameMap(companyId));
  },

  async activate(companyId: string, id: string, actorId: string): Promise<UserSummary> {
    const user = await findScopedOr404(companyId, id);
    if (!user.isActive) {
      await usersRepository.setActive(user, true);
      logger.info({ userId: user.id, actorId }, 'Usuario activado');
    }
    return toUserSummary(user, await roleNameMap(companyId));
  },

  async deactivate(companyId: string, id: string, actorId: string): Promise<UserSummary> {
    const user = await findScopedOr404(companyId, id);
    if (user.id === actorId) {
      throw new BadRequestError(
        'No puedes desactivar tu propia cuenta',
        'SELF_DEACTIVATE',
      );
    }
    if (!user.isActive) {
      return toUserSummary(user, await roleNameMap(companyId));
    }

    // Regla de negocio: nunca dejar la empresa sin un administrador activo.
    const role = await rolesRepository.findById(user.roleId.toString());
    if (role && role.name === 'administrador') {
      const activeAdmins = await usersRepository.countByRole(companyId, role.id, {
        activeOnly: true,
      });
      if (activeAdmins <= 1) {
        throw new ConflictError(
          'No se puede desactivar al último administrador activo',
          'LAST_ACTIVE_ADMIN',
        );
      }
    }

    await usersRepository.setActive(user, false);
    logger.warn({ userId: user.id, actorId, companyId }, 'Usuario desactivado');
    return toUserSummary(user, await roleNameMap(companyId));
  },

  /** Historial real: fechas del usuario + sesiones (logins) registradas. */
  async history(companyId: string, id: string): Promise<UserHistoryResponse> {
    const user = await findScopedOr404(companyId, id);
    const sessions = await sessionsRepository.findRecentByUser(user.id, 20);
    const now = Date.now();

    return {
      userId: user.id,
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
      sessions: sessions.map((session) => ({
        id: session.id,
        ip: session.ip ?? null,
        userAgent: session.userAgent ?? null,
        lastUsedAt: session.lastUsedAt ? session.lastUsedAt.toISOString() : null,
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
        active: !session.revokedAt && session.expiresAt.getTime() > now,
      })),
    };
  },
};
