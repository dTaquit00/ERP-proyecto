import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    legalName: { type: String, trim: true, maxlength: 200 },
    taxId: { type: String, trim: true, maxlength: 50 },
    phone: { type: String, trim: true, maxlength: 50 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    address: { type: String, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
    },
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'companies' },
);

companySchema.index({ name: 1 });

export type CompanySchemaType = InferSchemaType<typeof companySchema>;
export type CompanyDocument = HydratedDocument<CompanySchemaType>;
export const CompanyModel = model<CompanySchemaType>('Company', companySchema);
