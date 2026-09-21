import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** Tokens de restablecimiento de contraseña: hash + expiración + un solo uso. */
const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true, collection: 'password_reset_tokens' },
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetSchemaType = InferSchemaType<typeof passwordResetSchema>;
export type PasswordResetDocument = HydratedDocument<PasswordResetSchemaType>;
export const PasswordResetModel = model<PasswordResetSchemaType>(
  'PasswordReset',
  passwordResetSchema,
);
