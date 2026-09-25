import type { AuditLogResponse, AuditResult, PaginationMeta } from '@erp/types';
import type { ListAuditQueryInput } from '@erp/validation';
import { Types } from 'mongoose';
import { AuditModel, type AuditDocument } from './audit.model.js';

function endOfDateFilter(value: Date): { $lte: Date } | { $lt: Date } {
  const end = new Date(value);
  if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0 && end.getUTCMilliseconds() === 0) {
    end.setUTCDate(end.getUTCDate() + 1);
    return { $lt: end };
  }
  return { $lte: end };
}

export interface AuditRecordInput {
  companyId: string; userId: string; userName: string; action: string; resource: string;
  resourceId?: string; ip?: string; userAgent?: string; result: AuditResult; metadata?: Record<string, unknown>;
}

function toResponse(log: AuditDocument): AuditLogResponse {
  return { id: log.id, companyId: log.companyId.toString(), userId: log.userId.toString(), userName: log.userName, action: log.action, resource: log.resource, resourceId: log.resourceId ?? null, ip: log.ip ?? null, userAgent: log.userAgent ?? null, result: log.result, metadata: (log.metadata as Record<string, unknown>) ?? {}, createdAt: log.createdAt.toISOString() };
}

export const auditService = {
  async record(input: AuditRecordInput): Promise<void> { await AuditModel.create(input); },
  async list(companyId: string, query: ListAuditQueryInput): Promise<{ items: AuditLogResponse[]; meta: PaginationMeta }> {
    const filter: Record<string, unknown> = { companyId: new Types.ObjectId(companyId) };
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.action) filter.action = query.action;
    if (query.resource) filter.resource = query.resource;
    if (query.result) filter.result = query.result;
    if (query.dateFrom || query.dateTo) filter.createdAt = { ...(query.dateFrom ? { $gte: query.dateFrom } : {}), ...(query.dateTo ? endOfDateFilter(query.dateTo) : {}) };
    const skip = (query.page - 1) * query.limit;
    const [logs, total] = await Promise.all([
      AuditModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).exec(),
      AuditModel.countDocuments(filter).exec(),
    ]);
    return { items: logs.map(toResponse), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },
  async get(companyId: string, id: string): Promise<AuditLogResponse | null> {
    const log = await AuditModel.findOne({ _id: id, companyId }).exec();
    return log ? toResponse(log) : null;
  },
};
