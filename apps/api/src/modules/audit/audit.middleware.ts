import type { RequestHandler } from 'express';
import { auditService } from './audit.service.js';

function businessAction(method: string, resource: string, tail: string[], body: unknown): string {
  const prefix: Record<string, string> = {
    products: 'PRODUCT', categories: 'CATEGORY', customers: 'CUSTOMER', suppliers: 'SUPPLIER',
    warehouses: 'WAREHOUSE', branches: 'BRANCH', users: 'USER', roles: 'ROLE', companies: 'COMPANY',
    sales: 'SALE', purchases: 'PURCHASE',
  };
  if (resource === 'inventory' && method === 'POST' && tail[0] === 'movements') {
    const type = (body as { type?: string } | undefined)?.type;
    if (type === 'ADJUSTMENT') return 'INVENTORY_ADJUSTED';
    if (type === 'TRANSFER') return 'INVENTORY_TRANSFERRED';
    if (type === 'IN') return 'INVENTORY_RECEIVED';
    if (type === 'OUT') return 'INVENTORY_ISSUED';
    if (type === 'RETURN') return 'INVENTORY_RETURNED';
    return 'INVENTORY_MOVEMENT_CREATED';
  }

  const entity = prefix[resource];
  if (!entity) return `${method} ${resource.toUpperCase()}`;
  if (method === 'POST' && tail.length === 0) return `${entity}_CREATED`;
  if (method === 'PATCH' || method === 'PUT') return `${entity}_UPDATED`;
  if (method === 'DELETE') return `${entity}_DELETED`;
  if (method === 'POST') {
    const transition: Record<string, string> = {
      confirm: 'CONFIRMED', cancel: 'CANCELLED', return: 'RETURNED', receive: 'RECEIVED',
      deactivate: 'DEACTIVATED', activate: 'ACTIVATED',
    };
    const suffix = transition[tail[1] ?? ''];
    if (suffix) return `${entity}_${suffix}`;
  }
  return `${method} ${resource}`;
}

export const auditRequestMiddleware: RequestHandler = (req, res, next) => {
  const shouldAudit = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
  if (!shouldAudit) return next();
  res.on('finish', () => {
    const auth = req.auth;
    if (!auth || req.path.startsWith('/auth')) return;
    const segments = req.originalUrl.split('?')[0]!.split('/').filter(Boolean);
    const resourceIndex = segments[0] === 'api' && segments[1] === 'v1' ? 2 : 0;
    const resource = segments[resourceIndex] ?? 'unknown';
    const tail = segments.slice(resourceIndex + 1);
    const candidateId = tail[0];
    const resourceId = candidateId && !['confirm', 'receive', 'cancel', 'return', 'activate', 'deactivate', 'movements'].includes(candidateId) ? candidateId : undefined;
    const action = businessAction(req.method, resource, tail, req.body);
    void auditService.record({
      companyId: auth.user.companyId,
      userId: auth.user.id,
      userName: `${auth.user.firstName} ${auth.user.lastName}`,
      action,
      resource,
      resourceId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      result: res.statusCode < 400 ? 'success' : 'failure',
      metadata: {
        statusCode: res.statusCode,
        ...(resource === 'inventory' && (req.body as { type?: string } | undefined)?.type
          ? { movementType: (req.body as { type: string }).type }
          : {}),
      },
    }).catch(() => undefined);
  });
  next();
};
