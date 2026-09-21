import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const categorySchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, required: true, default: true },
    // Declarados para tiparlos; los gestiona mongoose gracias a `timestamps: true`.
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true, collection: 'categories' },
);

// Un nombre de categoría es único dentro de la empresa (multiempresa).
categorySchema.index({ companyId: 1, name: 1 }, { unique: true });
categorySchema.index({ companyId: 1, isActive: 1 });

export type CategorySchemaType = InferSchemaType<typeof categorySchema>;
export type CategoryDocument = HydratedDocument<CategorySchemaType>;
export const CategoryModel = model<CategorySchemaType>('Category', categorySchema);
