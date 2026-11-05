import { BadRequestError, ConflictError, NotFoundError } from '../../shared/http/errors.js';
import { hashPassword } from '../../shared/security/password.js';
import { withTransaction } from '../../shared/db/transaction.js';
import { gymRepository, gymToday } from '../gym/gym.repository.js';
import { portalRepository } from './portal.repository.js';

export const portalService = {
  async storeSettings(companyId: string) {
    const company = await portalRepository.companySettings(companyId);
    if (!company) throw new NotFoundError('Empresa no encontrada');
    const [counts, conflict] = await Promise.all([portalRepository.productCounts(companyId), portalRepository.otherPublicStore(companyId)]);
    const enabled = company.settings?.publicStoreEnabled === true;
    return { enabled, ready: enabled && company.status === 'active' && !conflict, companyActive: company.status === 'active', conflictingStore: Boolean(conflict), ...counts };
  },
  async updateStoreSettings(companyId: string, enabled: boolean) {
    const company = await portalRepository.companySettings(companyId);
    if (!company) throw new NotFoundError('Empresa no encontrada');
    if (enabled && company.status !== 'active') throw new BadRequestError('La empresa debe estar activa para habilitar la tienda');
    if (enabled && await portalRepository.otherPublicStore(companyId)) throw new ConflictError('Ya hay otra empresa con tienda habilitada. Revisa la configuración antes de publicar.', 'STORE_ALREADY_ENABLED');
    await portalRepository.setStoreEnabled(companyId, enabled);
    return this.storeSettings(companyId);
  },
  async catalog(query: { page: number; limit: number; search?: string }) {
    const companies = await portalRepository.publicCompanies();
    if (companies.length !== 1) return { enabled: false, items: [], meta: { ...query, total: 0, totalPages: 1 } };
    const result = await portalRepository.catalog(String(companies[0]!._id), query);
    const categories = new Map(result.categories.map((category) => [String(category._id), category.name]));
    return { enabled: true, items: result.products.map((product) => ({
      id: String(product._id), name: product.name, description: product.description ?? '',
      price: Math.round(product.salePrice * (1 + (product.taxes ?? []).reduce((sum, tax) => sum + tax.rate, 0) / 100) * 100) / 100,
      image: product.image && /^https?:\/\//i.test(product.image) ? product.image : null,
      unit: product.unit, category: categories.get(String(product.categoryId)) ?? 'Productos',
    })), meta: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / query.limit)) } };
  },
  async me(companyId: string, userId: string) {
    const member = await portalRepository.ownMember(companyId, userId);
    if (!member) throw new NotFoundError('Tu cuenta todavía no está vinculada a un socio. Contacta con recepción.', 'MEMBER_ACCOUNT_UNLINKED');
    const today = gymToday();
    const enrollments = (await portalRepository.ownEnrollments(companyId, member.id)).map((item) => ({
      id: String(item._id), planName: item.planName, startDate: item.startDate, endDate: item.endDate,
      price: item.price, amountPaid: item.amountPaid,
      status: item.cancelledAt ? 'cancelled' : item.startDate > today ? 'scheduled' : item.endDate < today ? 'expired' : 'active',
      remainingDays: item.cancelledAt || item.startDate > today || item.endDate < today ? 0 : Math.floor((Date.parse(`${item.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) + 1,
    }));
    return { member: { memberNumber: member.memberNumber, name: `${member.firstName} ${member.lastName}`, isActive: member.isActive }, today,
      currentMembership: member.isActive ? enrollments.find((item) => item.status === 'active') ?? null : null,
      nextMembership: member.isActive ? [...enrollments].reverse().find((item) => item.status === 'scheduled') ?? null : null,
      enrollments,
    };
  },
  async createAccount(companyId: string, memberId: string, input: { email: string; password: string }) {
    const passwordHash = await hashPassword(input.password);
    return withTransaction(async (session) => {
      const member = await gymRepository.lockMember(companyId, memberId, session);
      if (!member) throw new NotFoundError('Socio no encontrado');
      if (!member.isActive) throw new BadRequestError('Activa al socio antes de crear su acceso');
      if (member.userId) throw new ConflictError('Este socio ya tiene una cuenta de acceso', 'MEMBER_ALREADY_LINKED');
      if (await portalRepository.existingAccount(companyId, input.email, session)) throw new ConflictError('Este correo ya tiene una cuenta. Usa un correo diferente para el acceso de socio.', 'EMAIL_IN_USE');
      const role = await portalRepository.memberRole(companyId, session) ?? await portalRepository.createMemberRole(companyId, session);
      if (role.permissions.length !== 1 || role.permissions[0] !== 'portal.read') throw new ConflictError('El rol socio tiene permisos distintos. Corrígelo antes de crear accesos.', 'INVALID_MEMBER_ROLE');
      const user = await portalRepository.createAccount({ companyId, email: input.email, passwordHash, firstName: member.firstName, lastName: member.lastName, roleId: role.id }, session);
      member.userId = user._id; await member.save({ session });
      return { email: user.email, linked: true };
    });
  },
};
