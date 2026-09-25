import { Types, type FilterQuery } from 'mongoose';
import type { ListUsersQueryInput } from '@erp/validation';
import { UserModel, type UserDocument, type UserSchemaType } from './users.model.js';
import { escapeRegExp } from '../../shared/utils/regex.js';

// Reexportado para mantener la API pública del módulo (su unit-test lo importa de aquí).
export { escapeRegExp } from '../../shared/utils/regex.js';

export interface UserCreateInput {
  companyId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roleId: string;
  isActive?: boolean;
}

export interface UserFieldChanges {
  email?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
}

/** Escapa metacaracteres de regex — implementación en `shared/utils/regex.js`
 * (importada aquí para no duplicar lógica; el export público se mantiene). */

/**
 * Construye el filtro de listado. El scope multiempresa (`companyId`) SIEMPRE
 * se aplica aquí: el filtro del cliente nunca puede ampliar el alcance.
 */
export function buildUserFilter(companyId: string, query: ListUsersQueryInput): FilterQuery<UserSchemaType> {
  const filter: FilterQuery<UserSchemaType> = {
    companyId: new Types.ObjectId(companyId),
  };
  if (query.roleId) filter.roleId = new Types.ObjectId(query.roleId);
  if (query.status) filter.isActive = query.status === 'active';
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ email: pattern }, { firstName: pattern }, { lastName: pattern }];
  }
  return filter;
}

export const usersRepository = {
  async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).exec();
  },

  /**
   * Candidatos a login por correo (incluye passwordHash).
   * En multiempresa el mismo correo puede existir en varias empresas:
   * el servicio verifica la contraseña contra cada candidato.
   */
  async findCandidatesByEmail(email: string, companyId?: string): Promise<UserDocument[]> {
    return UserModel.find({ email, ...(companyId ? { companyId: new Types.ObjectId(companyId) } : {}) })
      .select('+passwordHash')
      .limit(5)
      .exec();
  },

  /** Incluye passwordHash — solo para operaciones de autenticación. */
  async findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).select('+passwordHash').exec();
  },

  async findByEmailWithPassword(
    companyId: string,
    email: string,
  ): Promise<UserDocument | null> {
    return UserModel.findOne({ companyId, email }).select('+passwordHash').exec();
  },

  /** Listado paginado con filtros, búsqueda y orden seguros. */
  async list(
    companyId: string,
    query: ListUsersQueryInput,
  ): Promise<{ users: UserDocument[]; total: number }> {
    const filter = buildUserFilter(companyId, query);
    const sort: Record<string, 1 | -1> = {
      [query.sort]: query.order === 'asc' ? 1 : -1,
    };
    const skip = (query.page - 1) * query.limit;

    const [users, total] = await Promise.all([
      UserModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      UserModel.countDocuments(filter).exec(),
    ]);
    return { users, total };
  },

  async create(input: UserCreateInput): Promise<UserDocument> {
    return UserModel.create(input);
  },

  /** Aplica cambios de campos convirtiendo roleId a ObjectId dentro de la capa de datos. */
  async saveChanges(user: UserDocument, changes: UserFieldChanges): Promise<UserDocument> {
    if (changes.email !== undefined) user.email = changes.email;
    if (changes.firstName !== undefined) user.firstName = changes.firstName;
    if (changes.lastName !== undefined) user.lastName = changes.lastName;
    if (changes.roleId !== undefined) user.roleId = new Types.ObjectId(changes.roleId);
    await user.save();
    return user;
  },

  async setActive(user: UserDocument, isActive: boolean): Promise<UserDocument> {
    user.isActive = isActive;
    await user.save();
    return user;
  },

  async countByRole(
    companyId: string,
    roleId: string,
    options: { activeOnly?: boolean } = {},
  ): Promise<number> {
    const filter: FilterQuery<UserSchemaType> = {
      companyId: new Types.ObjectId(companyId),
      roleId: new Types.ObjectId(roleId),
    };
    if (options.activeOnly) filter.isActive = true;
    return UserModel.countDocuments(filter).exec();
  },

  /** Usuarios por rol de la empresa (una sola consulta) — para userCount en roles. */
  async countUsersByRole(companyId: string): Promise<Map<string, number>> {
    const rows = await UserModel.aggregate<{ _id: Types.ObjectId | null; count: number }>([
      { $match: { companyId: new Types.ObjectId(companyId) } },
      { $group: { _id: '$roleId', count: { $sum: 1 } } },
    ]).exec();

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row._id) counts.set(row._id.toString(), row.count);
    }
    return counts;
  },

  async updateLastLogin(id: string): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
  },

  async updatePassword(id: string, passwordHash: string, changedAt: Date): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      { $set: { passwordHash, passwordChangedAt: changedAt } },
    ).exec();
  },
};
