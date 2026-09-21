import { PasswordResetModel, type PasswordResetDocument } from './auth.password-reset.model.js';

export const passwordResetRepository = {
  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetDocument> {
    return PasswordResetModel.create({ userId, tokenHash, expiresAt });
  },

  async findByTokenHash(tokenHash: string): Promise<PasswordResetDocument | null> {
    return PasswordResetModel.findOne({ tokenHash }).exec();
  },

  async markUsed(record: PasswordResetDocument): Promise<void> {
    record.usedAt = new Date();
    await record.save();
  },
};
