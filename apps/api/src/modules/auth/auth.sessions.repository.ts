import { SessionModel, type SessionDocument } from './auth.sessions.model.js';
import { Types } from 'mongoose';

export interface SessionCreateInput {
  userId: string;
  tokenHash: string;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
}

export const sessionsRepository = {
  async create(input: SessionCreateInput): Promise<SessionDocument> {
    return SessionModel.create(input);
  },

  async findByTokenHash(tokenHash: string): Promise<SessionDocument | null> {
    return SessionModel.findOne({ tokenHash }).exec();
  },

  /** Rotación: el mismo documento de sesión recibe un token nuevo. */
  async rotate(
    session: SessionDocument,
    tokenHash: string,
    expiresAt: Date,
    lastUsedAt: Date,
  ): Promise<void> {
    session.tokenHash = tokenHash;
    session.expiresAt = expiresAt;
    session.lastUsedAt = lastUsedAt;
    await session.save();
  },

  /** Sesiones recientes del usuario (historial M02), más nuevas primero. */
  async findRecentByUser(userId: string, limit = 20): Promise<SessionDocument[]> {
    return SessionModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ _id: -1 })
      .limit(limit)
      .exec();
  },

  async markUsed(session: SessionDocument, lastUsedAt: Date): Promise<void> {
    session.lastUsedAt = lastUsedAt;
    await session.save();
  },

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await SessionModel.updateOne(
      { tokenHash, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    ).exec();
  },

  async revoke(session: SessionDocument): Promise<void> {
    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await session.save();
    }
  },

  /** Revoca todas las sesiones del usuario (excepto la actual si se indica). */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const filter: Record<string, unknown> = {
      userId,
      revokedAt: { $exists: false },
    };
    if (exceptSessionId) {
      filter._id = { $ne: exceptSessionId };
    }
    await SessionModel.updateMany(filter, { $set: { revokedAt: new Date() } }).exec();
  },
};
