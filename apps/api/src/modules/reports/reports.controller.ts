import type { Request, RequestHandler, Response } from 'express';
import { requireAuth } from '../../shared/http/auth-req.js';
import { parseOrThrow } from '../../shared/http/parse.js';
import { reportQuerySchema } from '@erp/validation';
import { BadRequestError } from '../../shared/http/errors.js';
import { reportsService } from './reports.service.js';

const TYPES = new Set(['sales', 'purchases', 'inventory', 'inventory-movements', 'products', 'customers', 'suppliers']);
export const reportsController = {
  csv: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const type = req.params.type;
    if (typeof type !== 'string' || !TYPES.has(type)) throw new BadRequestError('Tipo de reporte no válido', 'INVALID_REPORT_TYPE');
    const query = parseOrThrow(reportQuerySchema, req.query);
    const pdf = req.route.path.endsWith('.pdf');
    const content = pdf
      ? await reportsService.exportPdf(auth.user.companyId, type, query)
      : await reportsService.exportCsv(auth.user.companyId, type, query);
    const extension = pdf ? 'pdf' : 'csv';
    res.status(200).type(extension).setHeader('Content-Disposition', `attachment; filename="${type}.${extension}"`).send(content);
  }) satisfies RequestHandler,
};
