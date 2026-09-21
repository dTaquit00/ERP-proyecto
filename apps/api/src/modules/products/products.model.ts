import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { ProductTax } from '@erp/types';

const productSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    code: { type: String, trim: true, maxlength: 60 },
    // Normalizado en mayúsculas por la validación de entrada (Zod).
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    // Impuestos configurables por producto: [{ name, rate }] con rate 0–100.
    taxes: {
      type: [{ _id: false, name: { type: String, required: true }, rate: { type: Number, required: true } }],
      default: [],
    },
    unit: { type: String, required: true, trim: true, maxlength: 20 },
    isActive: { type: Boolean, required: true, default: true },
    image: { type: String, trim: true, maxlength: 500 },
    barcode: { type: String, trim: true, maxlength: 60 },
    // Declarados para tiparlos; los gestiona mongoose gracias a `timestamps: true`.
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true, collection: 'products' },
);

// El SKU es único dentro de la empresa (dos empresas pueden compartir SKU).
productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
productSchema.index({ companyId: 1, categoryId: 1 });
productSchema.index({ companyId: 1, isActive: 1 });

type InferredProduct = InferSchemaType<typeof productSchema>;
/**
 * `taxes` se tipea como array plano (no DocumentArray) para poder sustituirlo
 * en updates; el cast lo hace mongoose en tiempo de ejecución.
 */
export type ProductSchemaType = Omit<InferredProduct, 'taxes'> & { taxes: ProductTax[] };
export type ProductDocument = HydratedDocument<ProductSchemaType>;
export const ProductModel = model<ProductSchemaType>('Product', productSchema);
