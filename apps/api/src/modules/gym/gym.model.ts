import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const memberSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, required: true, ref: 'Company' },
  customerId: { type: Schema.Types.ObjectId, required: true, ref: 'Customer' },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  memberNumber: { type: String, required: true, trim: true },
  firstName: { type: String, required: true, trim: true }, lastName: { type: String, required: true, trim: true },
  email: { type: String, default: '' }, phone: { type: String, default: '' }, notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true, required: true }, revision: { type: Number, default: 0, required: true },
}, { timestamps: true, collection: 'gym_members' });
memberSchema.index({ companyId: 1, memberNumber: 1 }, { unique: true });
memberSchema.index({ companyId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });
memberSchema.index({ companyId: 1, isActive: 1, lastName: 1 });

const planSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, required: true, ref: 'Company' },
  name: { type: String, required: true, trim: true }, description: { type: String, default: '' },
  durationDays: { type: Number, required: true, min: 1, max: 730 }, price: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true, required: true }, revision: { type: Number, default: 0, required: true },
}, { timestamps: true, collection: 'gym_membership_plans' });
planSchema.index({ companyId: 1, name: 1 }, { unique: true });

const enrollmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, required: true, ref: 'Company' },
  memberId: { type: Schema.Types.ObjectId, required: true, ref: 'GymMember' },
  planId: { type: Schema.Types.ObjectId, required: true, ref: 'GymMembershipPlan' },
  memberName: { type: String, required: true }, memberNumber: { type: String, required: true },
  planName: { type: String, required: true }, durationDays: { type: Number, required: true },
  startDate: { type: String, required: true }, endDate: { type: String, required: true },
  price: { type: Number, required: true }, amountPaid: { type: Number, required: true },
  notes: { type: String, default: '' }, cancelledAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
}, { timestamps: true, collection: 'gym_enrollments' });
enrollmentSchema.index({ companyId: 1, memberId: 1, startDate: 1, endDate: 1 });

export type GymMember = InferSchemaType<typeof memberSchema>;
export type MembershipPlan = InferSchemaType<typeof planSchema>;
export type Enrollment = InferSchemaType<typeof enrollmentSchema>;
export type GymMemberDocument = HydratedDocument<GymMember>;
export type MembershipPlanDocument = HydratedDocument<MembershipPlan>;
export type EnrollmentDocument = HydratedDocument<Enrollment>;
export const GymMemberModel = model('GymMember', memberSchema);
export const MembershipPlanModel = model('GymMembershipPlan', planSchema);
export const EnrollmentModel = model('GymEnrollment', enrollmentSchema);
