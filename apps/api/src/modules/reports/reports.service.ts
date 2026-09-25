import { Types } from 'mongoose';
import PDFDocument from 'pdfkit';
import type { ReportQueryInput } from '@erp/validation';
import { SaleModel } from '../sales/sales.model.js';
import { PurchaseModel } from '../purchases/purchases.model.js';
import { StockBalanceModel, InventoryMovementModel } from '../inventory/inventory.model.js';
import { ProductModel } from '../products/products.model.js';
import { CustomerModel } from '../customers/customers.model.js';
import { SupplierModel } from '../suppliers/suppliers.model.js';

const MAX_ROWS = 5000;
function endOfDateFilter(value: Date): { $lte: Date } | { $lt: Date } {
  const end = new Date(value);
  if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0 && end.getUTCMilliseconds() === 0) {
    end.setUTCDate(end.getUTCDate() + 1);
    return { $lt: end };
  }
  return { $lte: end };
}
const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
const csv = (rows: Array<Record<string, unknown>>): string => {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\r\n');
};

export const reportsService = {
  async exportCsv(companyId: string, type: string, query: ReportQueryInput = {}): Promise<string> {
    const filters = buildFilters(companyId, type, query);
    let rows: Array<Record<string, unknown>>;
    switch (type) {
      case 'sales': rows = await SaleModel.find(filters).sort({ saleDate: -1 }).limit(MAX_ROWS).lean().exec(); break;
      case 'purchases': rows = await PurchaseModel.find(filters).sort({ purchaseDate: -1 }).limit(MAX_ROWS).lean().exec(); break;
      case 'inventory': rows = await StockBalanceModel.find(filters).sort({ updatedAt: -1 }).limit(MAX_ROWS).lean().exec(); break;
      case 'inventory-movements': rows = await InventoryMovementModel.find(filters).sort({ createdAt: -1 }).limit(MAX_ROWS).lean().exec(); break;
      case 'products': rows = await ProductModel.find(filters).sort({ name: 1 }).limit(MAX_ROWS).lean().exec(); break;
      case 'customers': rows = await CustomerModel.find(filters).sort({ name: 1 }).limit(MAX_ROWS).lean().exec(); break;
      case 'suppliers': rows = await SupplierModel.find(filters).sort({ name: 1 }).limit(MAX_ROWS).lean().exec(); break;
      default: throw new Error(`Unsupported report type: ${type}`);
    }
    return csv(rows);
  },
  async exportPdf(companyId: string, type: string, query: ReportQueryInput = {}): Promise<Buffer> {
    const content = await this.exportCsv(companyId, type, query);
    return new Promise((resolve) => {
      const document = new PDFDocument({ margin: 40 });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.fontSize(18).text(`Reporte ${type}`, { underline: true });
      document.moveDown().fontSize(8).text(content.replaceAll('\r\n', '\n'));
      document.end();
    });
  },
};

function buildFilters(companyId: string, type: string, query: ReportQueryInput): Record<string, unknown> {
  const filters: Record<string, unknown> = { companyId: new Types.ObjectId(companyId) };
  if (query.status) filters.status = query.status;
  if (query.branchId) filters.branchId = new Types.ObjectId(query.branchId);
  if (query.warehouseId) filters.warehouseId = new Types.ObjectId(query.warehouseId);
  if (query.productId) {
    const productId = new Types.ObjectId(query.productId);
    if (type === 'sales' || type === 'purchases') filters.items = { $elemMatch: { productId } };
    else filters.productId = productId;
  }
  if (query.categoryId && type === 'products') filters.categoryId = new Types.ObjectId(query.categoryId);
  if (query.customerId) filters.customerId = new Types.ObjectId(query.customerId);
  if (query.supplierId) filters.supplierId = new Types.ObjectId(query.supplierId);
  if (query.userId) filters.userId = new Types.ObjectId(query.userId);
  const dateField = type === 'sales' ? 'saleDate' : type === 'purchases' ? 'purchaseDate' : 'createdAt';
  if (query.dateFrom || query.dateTo) filters[dateField] = {
    ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
    ...(query.dateTo ? endOfDateFilter(query.dateTo) : {}),
  };
  return filters;
}
