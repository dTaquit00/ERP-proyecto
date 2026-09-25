import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const branchSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 300 },
    phone: { type: String, trim: true, maxlength: 50 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    manager: { type: String, trim: true, maxlength: 160 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: 'branches' },
);

branchSchema.index({ companyId: 1, code: 1 }, { unique: true });
branchSchema.index({ companyId: 1, isActive: 1 });

export type BranchSchemaType = InferSchemaType<typeof branchSchema>;
export type BranchDocument = HydratedDocument<BranchSchemaType>;
export const BranchModel = model<BranchSchemaType>('Branch', branchSchema);
