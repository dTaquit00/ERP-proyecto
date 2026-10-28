import { Types } from 'mongoose';
import PDFDocument from 'pdfkit';
import type { ListReportQueryInput, ReportQueryInput } from '@erp/validation';
import { SaleModel } from '../sales/sales.model.js';
import { PurchaseModel } from '../purchases/purchases.model.js';
import { StockBalanceModel, InventoryMovementModel } from '../inventory/inventory.model.js';
import { ProductModel } from '../products/products.model.js';
import { CustomerModel } from '../customers/customers.model.js';
import { SupplierModel } from '../suppliers/suppliers.model.js';
import { WarehouseModel } from '../warehouses/warehouses.model.js';

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
  async list(companyId: string, type: string, query: ListReportQueryInput) {
    const filters = await buildFilters(companyId, type, query);
    const skip = (query.page - 1) * query.limit;
    let items: Array<Record<string, unknown>>;
    let total: number;
    switch (type) {
      case 'sales': [items, total] = await Promise.all([SaleModel.find(filters).sort({ saleDate: -1 }).skip(skip).limit(query.limit).lean().exec(), SaleModel.countDocuments(filters).exec()]); break;
      case 'purchases': [items, total] = await Promise.all([PurchaseModel.find(filters).sort({ purchaseDate: -1 }).skip(skip).limit(query.limit).lean().exec(), PurchaseModel.countDocuments(filters).exec()]); break;
      case 'inventory': [items, total] = await Promise.all([StockBalanceModel.find(filters).sort({ updatedAt: -1 }).skip(skip).limit(query.limit).lean().exec(), StockBalanceModel.countDocuments(filters).exec()]); break;
      case 'inventory-movements': [items, total] = await Promise.all([InventoryMovementModel.find(filters).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean().exec(), InventoryMovementModel.countDocuments(filters).exec()]); break;
      case 'products': [items, total] = await Promise.all([ProductModel.find(filters).sort({ name: 1 }).skip(skip).limit(query.limit).lean().exec(), ProductModel.countDocuments(filters).exec()]); break;
      case 'customers': [items, total] = await Promise.all([CustomerModel.find(filters).sort({ name: 1 }).skip(skip).limit(query.limit).lean().exec(), CustomerModel.countDocuments(filters).exec()]); break;
      case 'suppliers': [items, total] = await Promise.all([SupplierModel.find(filters).sort({ name: 1 }).skip(skip).limit(query.limit).lean().exec(), SupplierModel.countDocuments(filters).exec()]); break;
      default: throw new Error(`Unsupported report type: ${type}`);
    }
    return {
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  },

  async exportCsv(companyId: string, type: string, query: ReportQueryInput = {}): Promise<string> {
    return csv(await fetchRows(companyId, type, query));
  },
  async exportPdf(companyId: string, type: string, query: ReportQueryInput = {}): Promise<Buffer> {
    const rows = await fetchRows(companyId, type, query);
    return new Promise((resolve) => {
      const document = new PDFDocument({ margin: 40 });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.fontSize(18).text(`Reporte: ${type.replaceAll('-', ' ')}`, { underline: true });
      document.moveDown().fontSize(9).fillColor('#52616b').text(`Generado: ${new Date().toLocaleString('es-MX')} · ${rows.length} registros`);
      if (!rows.length) {
        document.moveDown().fillColor('#172b27').text('No hay registros que coincidan con los filtros seleccionados.');
      } else {
        const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
        rows.forEach((row, index) => {
          document.moveDown(0.7).fontSize(11).fillColor('#172b27').text(`Registro ${index + 1}`, { underline: true });
          for (const column of columns) {
            const value = row[column];
            const printable = value === null || value === undefined
              ? '—'
              : typeof value === 'object' ? JSON.stringify(value) : String(value);
            document.fontSize(8).fillColor('#263238').text(`${column}: ${printable}`, { indent: 10, lineGap: 2 });
          }
        });
      }
      document.end();
    });
  },
};

async function fetchRows(companyId: string, type: string, query: ReportQueryInput): Promise<Array<Record<string, unknown>>> {
  const filters = await buildFilters(companyId, type, query);
  switch (type) {
    case 'sales': return SaleModel.find(filters).sort({ saleDate: -1 }).limit(MAX_ROWS).lean().exec();
    case 'purchases': return PurchaseModel.find(filters).sort({ purchaseDate: -1 }).limit(MAX_ROWS).lean().exec();
    case 'inventory': return StockBalanceModel.find(filters).sort({ updatedAt: -1 }).limit(MAX_ROWS).lean().exec();
    case 'inventory-movements': return InventoryMovementModel.find(filters).sort({ createdAt: -1 }).limit(MAX_ROWS).lean().exec();
    case 'products': return ProductModel.find(filters).sort({ name: 1 }).limit(MAX_ROWS).lean().exec();
    case 'customers': return CustomerModel.find(filters).sort({ name: 1 }).limit(MAX_ROWS).lean().exec();
    case 'suppliers': return SupplierModel.find(filters).sort({ name: 1 }).limit(MAX_ROWS).lean().exec();
    default: throw new Error(`Unsupported report type: ${type}`);
  }
}

async function buildFilters(companyId: string, type: string, query: ReportQueryInput): Promise<Record<string, unknown>> {
  const filters: Record<string, unknown> = { companyId: new Types.ObjectId(companyId) };
  if (query.status) filters.status = query.status;
  const branchScopedByWarehouse = type === 'inventory' || type === 'inventory-movements';
  if (query.branchId && branchScopedByWarehouse) {
    const warehouseIds = await WarehouseModel.find({
      companyId: new Types.ObjectId(companyId),
      branchId: new Types.ObjectId(query.branchId),
    }).distinct('_id').exec();
    const matchingIds = query.warehouseId
      ? warehouseIds.filter((id) => id.toString() === query.warehouseId)
      : warehouseIds;
    if (type === 'inventory-movements') {
      filters.$or = [
        { warehouseId: { $in: matchingIds } },
        { toWarehouseId: { $in: matchingIds } },
      ];
    } else {
      filters.warehouseId = { $in: matchingIds };
    }
  } else {
    if (query.branchId) filters.branchId = new Types.ObjectId(query.branchId);
    if (query.warehouseId) {
      const warehouseId = new Types.ObjectId(query.warehouseId);
      if (type === 'inventory-movements') {
        filters.$or = [{ warehouseId }, { toWarehouseId: warehouseId }];
      } else {
        filters.warehouseId = warehouseId;
      }
    }
  }
  if (query.productId) {
    const productId = new Types.ObjectId(query.productId);
    if (type === 'sales' || type === 'purchases') filters.items = { $elemMatch: { productId } };
    else if (type === 'products') filters._id = productId;
    else filters.productId = productId;
  }
  if (query.categoryId && type === 'products') filters.categoryId = new Types.ObjectId(query.categoryId);
  if (query.customerId) filters[type === 'customers' ? '_id' : 'customerId'] = new Types.ObjectId(query.customerId);
  if (query.supplierId) filters[type === 'suppliers' ? '_id' : 'supplierId'] = new Types.ObjectId(query.supplierId);
  if (query.userId) filters.userId = new Types.ObjectId(query.userId);
  const dateField = type === 'sales' ? 'saleDate' : type === 'purchases' ? 'purchaseDate' : 'createdAt';
  if (query.dateFrom || query.dateTo) filters[dateField] = {
    ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
    ...(query.dateTo ? endOfDateFilter(query.dateTo) : {}),
  };
  return filters;
}
