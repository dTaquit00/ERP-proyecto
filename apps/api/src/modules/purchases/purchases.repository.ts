import { Types, type ClientSession, type FilterQuery, type UpdateQuery } from 'mongoose';
import type { ListPurchasesQueryInput } from '@erp/validation';
import type { PurchaseStatus } from '@erp/types';
import { PurchaseModel, type PurchaseDocument, type PurchaseSchemaType } from './purchases.model.js';
import type { PurchaseListResult, PurchasePersistInput } from './purchases.types.js';

export function buildPurchaseFilter(companyId: string, query: ListPurchasesQueryInput): FilterQuery<PurchaseSchemaType> {
  const filter: FilterQuery<PurchaseSchemaType> = { companyId: new Types.ObjectId(companyId) };
  if (query.status) filter.status = query.status;
  if (query.supplierId) filter.supplierId = new Types.ObjectId(query.supplierId);
  if (query.warehouseId) filter.warehouseId = new Types.ObjectId(query.warehouseId);
  return filter;
}

export const purchasesRepository = {
  async findById(id: string, session?: ClientSession): Promise<PurchaseDocument | null> {
    const query = PurchaseModel.findById(id);
    if (session) query.session(session);
    return query.exec();
  },
  async list(companyId: string, query: ListPurchasesQueryInput): Promise<PurchaseListResult> {
    const filter = buildPurchaseFilter(companyId, query);
    const sort: Record<string, 1 | -1> = { [query.sort]: query.order === 'asc' ? 1 : -1 };
    const skip = (query.page - 1) * query.limit;
    const [purchases, total] = await Promise.all([
      PurchaseModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      PurchaseModel.countDocuments(filter).exec(),
    ]);
    return { purchases, total };
  },
  async create(input: PurchasePersistInput): Promise<PurchaseDocument> { return PurchaseModel.create(input); },
  async claimTransition(companyId: string, id: string, statuses: PurchaseStatus[], update: UpdateQuery<PurchaseSchemaType>, session: ClientSession): Promise<PurchaseDocument | null> {
    return PurchaseModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), companyId: new Types.ObjectId(companyId), status: { $in: statuses } },
      update,
      { new: false, session },
    ).exec();
  },
  async save(purchase: PurchaseDocument, session: ClientSession): Promise<PurchaseDocument> {
    await purchase.save({ session });
    return purchase;
  },
};
