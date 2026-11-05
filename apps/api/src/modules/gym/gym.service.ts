import { Types } from 'mongoose';
import type { CreateGymMemberInput, UpdateGymMemberInput, CreateMembershipPlanInput, UpdateMembershipPlanInput, CreateEnrollmentInput, GymListInput, EnrollmentListInput } from '@erp/validation';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/http/errors.js';
import { withTransaction } from '../../shared/db/transaction.js';
import { gymRepository, gymToday } from './gym.repository.js';
import type { GymMemberDocument, MembershipPlanDocument, EnrollmentDocument } from './gym.model.js';

function required<T>(value: T | null, label: string): T { if (!value) throw new NotFoundError(`${label} no encontrado`); return value; }
function validateName(value: { firstName: string; lastName: string }) { if (`${value.firstName} ${value.lastName}`.length > 120) throw new BadRequestError('El nombre completo del socio no puede superar 120 caracteres'); }
function memberResponse(member: GymMemberDocument) {
  return { id: member.id, customerId: member.customerId.toString(), memberNumber: member.memberNumber, firstName: member.firstName, lastName: member.lastName, name: `${member.firstName} ${member.lastName}`, email: member.email, phone: member.phone, notes: member.notes, isActive: member.isActive, createdAt: member.createdAt, updatedAt: member.updatedAt };
}
function planResponse(plan: MembershipPlanDocument) { return { id: plan.id, name: plan.name, description: plan.description, durationDays: plan.durationDays, price: plan.price, isActive: plan.isActive, createdAt: plan.createdAt, updatedAt: plan.updatedAt }; }
function enrollmentResponse(item: EnrollmentDocument) {
  const today = gymToday();
  const status = item.cancelledAt ? 'cancelled' : item.startDate > today ? 'scheduled' : item.endDate < today ? 'expired' : 'active';
  return { id: item.id, memberId: item.memberId.toString(), planId: item.planId.toString(), memberName: item.memberName, memberNumber: item.memberNumber, planName: item.planName, durationDays: item.durationDays, startDate: item.startDate, endDate: item.endDate, price: item.price, amountPaid: item.amountPaid, balance: Math.round((item.price - item.amountPaid) * 100) / 100, status, notes: item.notes, cancelledAt: item.cancelledAt, createdAt: item.createdAt };
}
export const gymService = {
  initialize: () => gymRepository.initialize(),
  async listMembers(companyId: string, query: GymListInput) { const result = await gymRepository.listMembers(companyId, query); return { ...result, items: result.items.map(memberResponse) }; },
  async getMember(companyId: string, id: string) { return memberResponse(required(await gymRepository.member(companyId, id), 'Socio')); },
  async createMember(companyId: string, input: CreateGymMemberInput) {
    validateName(input);
    return withTransaction(async (session) => memberResponse(await gymRepository.createMember({ ...input, companyId: new Types.ObjectId(companyId) }, session)));
  },
  async updateMember(companyId: string, id: string, input: UpdateGymMemberInput) {
    return withTransaction(async (session) => {
      const member = required(await gymRepository.member(companyId, id).session(session), 'Socio');
      Object.assign(member, input);
      validateName(member);
      await member.save({ session });
      await gymRepository.syncCustomer(companyId, member.customerId, { name: `${member.firstName} ${member.lastName}`, email: member.email, phone: member.phone }, session);
      return memberResponse(member);
    });
  },
  async listPlans(companyId: string, query: GymListInput) { const result = await gymRepository.listPlans(companyId, query); return { ...result, items: result.items.map(planResponse) }; },
  async getPlan(companyId: string, id: string) { return planResponse(required(await gymRepository.plan(companyId, id), 'Membresía')); },
  async createPlan(companyId: string, input: CreateMembershipPlanInput) { return planResponse(await gymRepository.createPlan({ ...input, companyId: new Types.ObjectId(companyId) })); },
  async updatePlan(companyId: string, id: string, input: UpdateMembershipPlanInput) {
    const plan = required(await gymRepository.plan(companyId, id), 'Membresía');
    Object.assign(plan, input); await plan.save(); return planResponse(plan);
  },
  async listEnrollments(companyId: string, query: EnrollmentListInput) { const result = await gymRepository.listEnrollments(companyId, query); return { ...result, items: result.items.map(enrollmentResponse) }; },
  async getEnrollment(companyId: string, id: string) { return enrollmentResponse(required(await gymRepository.enrollment(companyId, id), 'Inscripción')); },
  async createEnrollment(companyId: string, input: CreateEnrollmentInput, actorId: string) {
    return withTransaction(async (session) => {
      // Serialize enrollments per member; concurrent renewals cannot overlap.
      const member = required(await gymRepository.lockMember(companyId, input.memberId, session), 'Socio');
      const plan = required(await gymRepository.lockPlan(companyId, input.planId, session), 'Membresía');
      if (!member.isActive || !plan.isActive) throw new BadRequestError('El socio y la membresía deben estar activos', 'GYM_INACTIVE_REFERENCE');
      const end = new Date(`${input.startDate}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + plan.durationDays - 1);
      const endDate = end.toISOString().slice(0, 10);
      const amountPaid = input.amountPaid ?? plan.price;
      if (amountPaid > plan.price) throw new BadRequestError('El monto registrado no puede superar el precio de la membresía', 'GYM_INVALID_PAYMENT');
      if (await gymRepository.overlaps(companyId, input.memberId, input.startDate, endDate, session)) throw new ConflictError('El socio ya tiene una inscripción para ese periodo', 'GYM_ENROLLMENT_OVERLAP');
      return enrollmentResponse(await gymRepository.createEnrollment({ companyId: new Types.ObjectId(companyId), memberId: member._id, planId: plan._id, memberName: `${member.firstName} ${member.lastName}`, memberNumber: member.memberNumber, planName: plan.name, durationDays: plan.durationDays, startDate: input.startDate, endDate, price: plan.price, amountPaid, notes: input.notes, createdBy: new Types.ObjectId(actorId) }, session));
    });
  },
  async cancelEnrollment(companyId: string, id: string) {
    return withTransaction(async (session) => {
      const item = required(await gymRepository.enrollment(companyId, id).session(session), 'Inscripción');
      await gymRepository.lockMember(companyId, item.memberId.toString(), session);
      if (!item.cancelledAt) { item.cancelledAt = new Date(); await item.save({ session }); }
      return enrollmentResponse(item);
    });
  },
};
