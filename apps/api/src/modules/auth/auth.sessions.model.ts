import { Schema, model, type HydratedDocument, type InferSchemaType, type Types } from 'mongoose';

/**
 * Sesiones de refresh token.
 * - Solo se guarda el SHA-256 del token.
 * - Rotación: cada refresh actualiza tokenHash/expiry de la misma sesión.
 * - `revokedAt` permite logout, revocación tras cambio de contraseña y detección de reuso.
 * - TTL en `expiresAt` limpia las sesiones expiradas automáticamente.
 */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    ip: { type: String, maxlength: 60 },
    userAgent: { type: String, maxlength: 300 },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true, collection: 'sessions' },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1 });

export type SessionSchemaType = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<SessionSchemaType>;
export const SessionModel = model<SessionSchemaType>('Session', sessionSchema);

export type SessionId = Types.ObjectId;
