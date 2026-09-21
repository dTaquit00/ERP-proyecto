import { UserModel, type UserDocument } from './users.model.js';

export interface UserCreateInput {
  companyId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roleId: string;
  isActive?: boolean;
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
  async findCandidatesByEmail(email: string): Promise<UserDocument[]> {
    return UserModel.find({ email })
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

  async create(input: UserCreateInput): Promise<UserDocument> {
    return UserModel.create(input);
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
