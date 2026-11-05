import type { Types, ClientSession, FilterQuery } from 'mongoose';
import type { GymListInput, EnrollmentListInput } from '@erp/validation';
import { CustomerModel } from '../customers/customers.model.js';
import { escapeRegExp } from '../../shared/utils/regex.js';
import { GymMemberModel, MembershipPlanModel, EnrollmentModel, type GymMember, type MembershipPlan, type Enrollment } from './gym.model.js';

export function gymToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function pageMeta(page: number, limit: number, total: number) { return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }; }
export const gymRepository = {
  initialize: () => Promise.all([GymMemberModel.init(), MembershipPlanModel.init(), EnrollmentModel.init()]),
  async listMembers(companyId: string, query: GymListInput) {
    const filter: FilterQuery<GymMember> = { companyId };
    if (query.status) filter.isActive = query.status === 'active';
    if (query.search) { const regex = new RegExp(escapeRegExp(query.search), 'i'); filter.$or = ['firstName', 'lastName', 'memberNumber', 'email'].map((key) => ({ [key]: regex })); }
    const [items, total] = await Promise.all([GymMemberModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), GymMemberModel.countDocuments(filter)]);
    return { items, meta: pageMeta(query.page, query.limit, total) };
  },
  async listPlans(companyId: string, query: GymListInput) {
    const filter: FilterQuery<MembershipPlan> = { companyId };
    if (query.status) filter.isActive = query.status === 'active';
    if (query.search) filter.name = new RegExp(escapeRegExp(query.search), 'i');
    const [items, total] = await Promise.all([MembershipPlanModel.find(filter).sort({ name: 1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit), MembershipPlanModel.countDocuments(filter)]);
    return { items, meta: pageMeta(query.page, query.limit, total) };
  },
  async listEnrollments(companyId: string, query: EnrollmentListInput) {
    const filter: FilterQuery<Enrollment> = { companyId };
    if (query.memberId) filter.memberId = query.memberId;
    const today = gymToday();
    if (query.status === 'cancelled') filter.cancelledAt = { $ne: null };
    else if (query.status) {
      filter.cancelledAt = null;
      if (query.status === 'active') { filter.startDate = { $lte: today }; filter.endDate = { $gte: today }; }
      if (query.status === 'scheduled') filter.startDate = { $gt: today };
      if (query.status === 'expired') filter.endDate = { $lt: today };
    }
    const [items, total] = await Promise.all([EnrollmentModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), EnrollmentModel.countDocuments(filter)]);
    return { items, meta: pageMeta(query.page, query.limit, total) };
  },
  member: (companyId: string, id: string) => GymMemberModel.findOne({ companyId, _id: id }),
  plan: (companyId: string, id: string) => MembershipPlanModel.findOne({ companyId, _id: id }),
  enrollment: (companyId: string, id: string) => EnrollmentModel.findOne({ companyId, _id: id }),
  createMember: async (input: Omit<GymMember, 'createdAt' | 'updatedAt' | 'revision' | 'customerId'>, session: ClientSession) => {
    const [customer] = await CustomerModel.create([{ companyId: input.companyId, name: `${input.firstName} ${input.lastName}`, email: input.email, phone: input.phone, isActive: true }], { session });
    const [member] = await GymMemberModel.create([{ ...input, customerId: customer!.id }], { session });
    return member!;
  },
  syncCustomer: (companyId: string, customerId: Types.ObjectId, input: { name: string; email: string; phone: string }, session: ClientSession) => CustomerModel.updateOne({ _id: customerId, companyId }, { $set: input }, { session }),
  createPlan: (input: Omit<MembershipPlan, 'createdAt' | 'updatedAt' | 'revision'>) => MembershipPlanModel.create(input),
  lockMember: (companyId: string, id: string, session: ClientSession) => GymMemberModel.findOneAndUpdate({ companyId, _id: id }, { $inc: { revision: 1 } }, { new: true, session }),
  lockPlan: (companyId: string, id: string, session: ClientSession) => MembershipPlanModel.findOneAndUpdate({ companyId, _id: id }, { $inc: { revision: 1 } }, { new: true, session }),
  overlaps: (companyId: string, memberId: string, startDate: string, endDate: string, session: ClientSession) => EnrollmentModel.exists({ companyId, memberId, cancelledAt: null, startDate: { $lte: endDate }, endDate: { $gte: startDate } }).session(session),
  createEnrollment: async (input: Omit<Enrollment, 'createdAt' | 'updatedAt' | 'cancelledAt'>, session: ClientSession) => (await EnrollmentModel.create([input], { session }))[0]!,
};
