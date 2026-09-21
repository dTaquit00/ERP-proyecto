import { Schema, model, type HydratedDocument, type InferSchemaType, type Types } from 'mongoose';

const roleSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
    },
  },
  { timestamps: true, collection: 'roles' },
);

// Un nombre de rol es único dentro de la empresa (multiempresa).
roleSchema.index({ companyId: 1, name: 1 }, { unique: true });

export type RoleSchemaType = InferSchemaType<typeof roleSchema>;
export type RoleDocument = HydratedDocument<RoleSchemaType>;
export const RoleModel = model<RoleSchemaType>('Role', roleSchema);

export type RoleId = Types.ObjectId;
