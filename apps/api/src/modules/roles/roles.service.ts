import type { PaginationMeta, RoleResponse } from '@erp/types';
import { isPermission, type Permission } from '@erp/types';
import type { CreateRoleInput, ListRolesQueryInput, UpdateRoleInput } from '@erp/validation';
import { ConflictError, NotFoundError } from '../../shared/http/errors.js';
import { logger } from '../../config/logger.js';
import { rolesRepository } from './roles.repository.js';
import type { RoleDocument } from './roles.model.js';
import { usersRepository } from '../users/users.repository.js';
import { SYSTEM_ROLES } from './roles.system.js';

export function toRoleResponse(role: RoleDocument, userCount: number): RoleResponse {
  return {
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    // Filtra valores ajenos al catálogo: una BD alterada no amplía permisos.
    permissions: role.permissions.filter(isPermission),
    isSystem: role.isSystem,
    userCount,
  };
}

async function findScopedOr404(companyId: string, id: string): Promise<RoleDocument> {
  const role = await rolesRepository.findById(id);
  if (!role || role.companyId.toString() !== companyId) {
    throw new NotFoundError('Rol no encontrado');
  }
  return role;
}

export const rolesService = {
  /** Crea (de forma idempotente) los 7 roles del sistema para una empresa. */
  async ensureSystemRoles(companyId: string): Promise<void> {
    for (const systemRole of SYSTEM_ROLES) {
      const existing = await rolesRepository.findByName(companyId, systemRole.name);
      if (existing) {
        // Migración aditiva de permisos nuevos al volver a ejecutar el seed;
        // conserva cualquier permiso personalizado que ya tuviera el rol.
        const newOperationPermissions: Permission[] = ['sales.confirm', 'purchases.confirm', 'inventory.adjust'];
        const additions: Permission[] = systemRole.permissions.filter(
          (permission) => newOperationPermissions.includes(permission) && !existing.permissions.includes(permission),
        );
        if (existing.isSystem && additions.length > 0) {
          await rolesRepository.saveChanges(existing, { permissions: [...existing.permissions.filter(isPermission), ...additions] });
        }
        continue;
      }
      await rolesRepository.create({
        companyId,
        name: systemRole.name,
        displayName: systemRole.displayName,
        permissions: [...systemRole.permissions],
        isSystem: true,
      });
      logger.info({ companyId, role: systemRole.name }, 'Rol del sistema creado');
    }
  },

  async list(
    companyId: string,
    query: ListRolesQueryInput,
  ): Promise<{ items: RoleResponse[]; meta: PaginationMeta }> {
    const { roles, total } = await rolesRepository.listByCompany(
      companyId,
      query.page,
      query.limit,
    );
    const counts = await usersRepository.countUsersByRole(companyId);
    return {
      items: roles.map((role) => toRoleResponse(role, counts.get(role.id) ?? 0)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async get(companyId: string, id: string): Promise<RoleResponse> {
    const role = await findScopedOr404(companyId, id);
    const userCount = await usersRepository.countByRole(companyId, role.id);
    return toRoleResponse(role, userCount);
  },

  async create(companyId: string, input: CreateRoleInput, actorId: string): Promise<RoleResponse> {
    const existing = await rolesRepository.findByName(companyId, input.name);
    if (existing) {
      throw new ConflictError('Ya existe un rol con ese nombre en esta empresa', 'ROLE_NAME_IN_USE');
    }
    const role = await rolesRepository.create({
      companyId,
      name: input.name,
      displayName: input.displayName,
      permissions: input.permissions,
    });
    logger.info({ roleId: role.id, actorId, companyId }, 'Rol creado');
    return toRoleResponse(role, 0);
  },

  async update(
    companyId: string,
    id: string,
    input: UpdateRoleInput,
    actorId: string,
  ): Promise<RoleResponse> {
    const role = await findScopedOr404(companyId, id);
    // El nombre no es editable (identifica el rol); solo nombre visible y permisos.
    await rolesRepository.saveChanges(role, input);
    const userCount = await usersRepository.countByRole(companyId, role.id);
    logger.info(
      { roleId: role.id, actorId, fields: Object.keys(input) },
      'Rol actualizado',
    );
    return toRoleResponse(role, userCount);
  },

  async remove(companyId: string, id: string, actorId: string): Promise<void> {
    const role = await findScopedOr404(companyId, id);
    if (role.isSystem) {
      throw new ConflictError('Los roles del sistema no se pueden eliminar', 'SYSTEM_ROLE');
    }
    const userCount = await usersRepository.countByRole(companyId, role.id);
    if (userCount > 0) {
      throw new ConflictError(
        'El rol está asignado a usuarios: reasígnalos antes de eliminarlo',
        'ROLE_IN_USE',
      );
    }
    await rolesRepository.remove(role);
    logger.warn({ roleId: role.id, actorId, companyId }, 'Rol eliminado');
  },
};
