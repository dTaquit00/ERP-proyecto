import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** Dirección como subdocumento sin _id (en updates se reemplaza completa). */
const addressSchema = new Schema(
  {
    street: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    zipCode: { type: String, trim: true, maxlength: 20 },
  },
  { _id: false },
);

const customerSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 30 },
    dni: { type: String, trim: true, maxlength: 20 },
    address: { type: addressSchema },
    notes: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, required: true, default: true },
    // Declarados para tiparlos; los gestiona mongoose gracias a `timestamps: true`.
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true, collection: 'customers' },
);

// Sin unicidad de nombre/email/DNI: dos clientes pueden compartir nombre (decisión de negocio).
customerSchema.index({ companyId: 1, name: 1 });
customerSchema.index({ companyId: 1, isActive: 1 });

export type CustomerSchemaType = InferSchemaType<typeof customerSchema>;
export type CustomerDocument = HydratedDocument<CustomerSchemaType>;
export const CustomerModel = model<CustomerSchemaType>('Customer', customerSchema);
