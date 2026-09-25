import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const auditSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  userName: { type: String, required: true },
  action: { type: String, required: true, maxlength: 80 },
  resource: { type: String, required: true, maxlength: 80 },
  resourceId: { type: String, maxlength: 80 },
  ip: { type: String, maxlength: 100 },
  userAgent: { type: String, maxlength: 500 },
  result: { type: String, enum: ['success', 'failure'], required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' });

auditSchema.index({ companyId: 1, createdAt: -1 });
auditSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
export type AuditDocument = HydratedDocument<InferSchemaType<typeof auditSchema>>;
export const AuditModel = model('AuditLog', auditSchema);
