import type { ClientSession } from 'mongoose';
import { CompanyModel } from '../companies/companies.model.js';
import { ProductModel } from '../products/products.model.js';
import { CategoryModel } from '../categories/categories.model.js';
import { GymMemberModel, EnrollmentModel } from '../gym/gym.model.js';
import { RoleModel } from '../roles/roles.model.js';
import { UserModel } from '../users/users.model.js';
import { escapeRegExp } from '../../shared/utils/regex.js';

export const portalRepository = {
  companySettings: (companyId: string) => CompanyModel.findById(companyId).select('status settings'),
  otherPublicStore: (companyId: string) => CompanyModel.exists({ _id: { $ne: companyId }, status: 'active', 'settings.publicStoreEnabled': true }),
  setStoreEnabled: (companyId: string, enabled: boolean) => CompanyModel.updateOne({ _id: companyId }, { $set: { 'settings.publicStoreEnabled': enabled } }),
  productCounts: async (companyId: string) => {
    const [products, published] = await Promise.all([ProductModel.countDocuments({ companyId }), ProductModel.countDocuments({ companyId, isActive: true, isPublic: true })]);
    return { products, published };
  },
  publicCompanies: () => CompanyModel.find({ status: 'active', 'settings.publicStoreEnabled': true }).select('_id').limit(2).lean(),
  async catalog(companyId: string, query: { page: number; limit: number; search?: string }) {
    const filter = { companyId, isActive: true, isPublic: true, ...(query.search ? { name: new RegExp(escapeRegExp(query.search), 'i') } : {}) };
    const [products, total, categories] = await Promise.all([
      ProductModel.find(filter).select('name description salePrice image unit taxes categoryId').sort({ name: 1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      ProductModel.countDocuments(filter), CategoryModel.find({ companyId }).select('name').lean(),
    ]);
    return { products, total, categories };
  },
  ownMember: (companyId: string, userId: string) => GymMemberModel.findOne({ companyId, userId }),
  ownEnrollments: (companyId: string, memberId: string) => EnrollmentModel.find({ companyId, memberId }).sort({ startDate: -1, _id: -1 }).select('planName durationDays startDate endDate price amountPaid cancelledAt').lean(),
  memberRole: (companyId: string, session: ClientSession) => RoleModel.findOne({ companyId, name: 'socio' }).session(session),
  createMemberRole: async (companyId: string, session: ClientSession) => (await RoleModel.create([{ companyId, name: 'socio', displayName: 'Socio Gym OMH', permissions: ['portal.read'], isSystem: false }], { session }))[0]!,
  existingAccount: (companyId: string, email: string, session: ClientSession) => UserModel.exists({ companyId, email }).session(session),
  createAccount: async (input: { companyId: string; email: string; passwordHash: string; firstName: string; lastName: string; roleId: string }, session: ClientSession) => (await UserModel.create([{ ...input, isActive: true }], { session }))[0]!,
};
