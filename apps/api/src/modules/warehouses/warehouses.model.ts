import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const warehouseSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, trim: true, maxlength: 200 },
    // M05 sucursales: FK opcional hasta que exista el módulo (validación en Fase 13).
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    isActive: { type: Boolean, required: true, default: true },
    // Declarados para tiparlos; los gestiona mongoose gracias a `timestamps: true`.
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true, collection: 'warehouses' },
);

// Un nombre de almacén es único dentro de la empresa (multiempresa).
warehouseSchema.index({ companyId: 1, name: 1 }, { unique: true });
warehouseSchema.index({ companyId: 1, isActive: 1 });

export type WarehouseSchemaType = InferSchemaType<typeof warehouseSchema>;
export type WarehouseDocument = HydratedDocument<WarehouseSchemaType>;
export const WarehouseModel = model<WarehouseSchemaType>('Warehouse', warehouseSchema);
