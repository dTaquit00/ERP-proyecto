import type { Request, RequestHandler, Response } from 'express';
import { requireAuth } from '../../shared/http/auth-req.js';
import { parseOrThrow } from '../../shared/http/parse.js';
import { listReportQuerySchema, reportQuerySchema } from '@erp/validation';
import { BadRequestError, ForbiddenError } from '../../shared/http/errors.js';
import type { Permission } from '@erp/types';
import { sendPaginated } from '../../shared/http/response.js';
import { reportsService } from './reports.service.js';

const TYPES = new Set(['sales', 'purchases', 'inventory', 'inventory-movements', 'products', 'customers', 'suppliers']);
function requireReportAccess(type: string, permissions: Permission[]) {
  const permission = `${type === 'inventory-movements' ? 'inventory' : type}.read`;
  if (!permissions.includes(permission as Permission)) {
    throw new ForbiddenError('Tu rol no tiene permiso para consultar este módulo en reportes', 'INSUFFICIENT_PERMISSIONS');
  }
}
export const reportsController = {
  list: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const type = req.params.type;
    if (typeof type !== 'string' || !TYPES.has(type)) throw new BadRequestError('Tipo de reporte no válido', 'INVALID_REPORT_TYPE');
    requireReportAccess(type, auth.permissions);
    const query = parseOrThrow(listReportQuerySchema, req.query);
    const { items, meta } = await reportsService.list(auth.user.companyId, type, query);
    return sendPaginated(res, items, meta);
  }) satisfies RequestHandler,

  csv: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const type = req.params.type;
    if (typeof type !== 'string' || !TYPES.has(type)) throw new BadRequestError('Tipo de reporte no válido', 'INVALID_REPORT_TYPE');
    requireReportAccess(type, auth.permissions);
    const query = parseOrThrow(reportQuerySchema, req.query);
    const content = await reportsService.exportCsv(auth.user.companyId, type, query);
    res.status(200).type('csv').setHeader('Content-Disposition', `attachment; filename="${type}.csv"`).send(content);
  }) satisfies RequestHandler,

  pdf: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const type = req.params.type;
    if (typeof type !== 'string' || !TYPES.has(type)) throw new BadRequestError('Tipo de reporte no válido', 'INVALID_REPORT_TYPE');
    requireReportAccess(type, auth.permissions);
    const query = parseOrThrow(reportQuerySchema, req.query);
    const content = await reportsService.exportPdf(auth.user.companyId, type, query);
    res.status(200).type('pdf').setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`).send(content);
  }) satisfies RequestHandler,
};
