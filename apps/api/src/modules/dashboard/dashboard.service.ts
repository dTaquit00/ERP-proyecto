import { Types } from 'mongoose';
import type { DashboardQueryInput } from '@erp/validation';
import { SaleModel } from '../sales/sales.model.js';
import { PurchaseModel } from '../purchases/purchases.model.js';
import { CustomerModel } from '../customers/customers.model.js';
import { SupplierModel } from '../suppliers/suppliers.model.js';
import { ProductModel } from '../products/products.model.js';
import { StockBalanceModel, InventoryMovementModel } from '../inventory/inventory.model.js';
import { WarehouseModel } from '../warehouses/warehouses.model.js';

const BUSINESS_TIME_ZONE = 'America/Mexico_City';
const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function dateParts(date: Date): Record<string, number> {
  return Object.fromEntries(businessDateFormatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]));
}

function localMidnightUtc(year: number, month: number, day: number): Date {
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  // Recompute the zone offset at the guessed instant to handle DST transitions.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateParts(new Date(guess));
    const representedAsUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
    const nextGuess = target - (representedAsUtc - guess);
    if (nextGuess === guess) break;
    guess = nextGuess;
  }
  return new Date(guess);
}

function dayStart(date: Date): Date {
  const parts = dateParts(date);
  return localMidnightUtc(parts.year!, parts.month!, parts.day!);
}

function monthStart(date: Date): Date {
  const parts = dateParts(date);
  return localMidnightUtc(parts.year!, parts.month!, 1);
}

export const dashboardService = {
  async summary(companyId: string, query: DashboardQueryInput) {
    const company = new Types.ObjectId(companyId);
    const saleScope: Record<string, unknown> = { companyId: company, status: { $in: ['confirmed', 'returned'] } };
    const purchaseScope: Record<string, unknown> = { companyId: company, status: { $ne: 'cancelled' } };
    const stockScope: Record<string, unknown> = { companyId: company };
    const movementScope: Record<string, unknown> = { companyId: company };
    if (query.branchId) saleScope.branchId = new Types.ObjectId(query.branchId);
    if (query.branchId || query.warehouseId) {
      const warehouseFilter: Record<string, unknown> = { companyId: company };
      if (query.branchId) warehouseFilter.branchId = new Types.ObjectId(query.branchId);
      if (query.warehouseId) warehouseFilter._id = new Types.ObjectId(query.warehouseId);
      const warehouseIds = (await WarehouseModel.find(warehouseFilter).distinct('_id')).map((id) => new Types.ObjectId(id));
      saleScope.warehouseId = { $in: warehouseIds };
      purchaseScope.warehouseId = { $in: warehouseIds };
      stockScope.warehouseId = { $in: warehouseIds };
      movementScope.$or = [
        { warehouseId: { $in: warehouseIds } },
        { toWarehouseId: { $in: warehouseIds } },
      ];
    }
    const now = new Date();
    const today = dayStart(now);
    const month = monthStart(now);
    const [salesToday, salesMonth, purchasesMonth, customers, suppliers, products, lowStock, outOfStock, valuation, recentSales, recentPurchases, recentMovements] = await Promise.all([
      SaleModel.aggregate<{ total: number }>([{ $match: { ...saleScope, saleDate: { $gte: today, $lte: now } } }, { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, { $multiply: ['$total', -1] }, '$total'] } } } }]),
      SaleModel.aggregate<{ total: number }>([{ $match: { ...saleScope, saleDate: { $gte: month, $lte: now } } }, { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, { $multiply: ['$total', -1] }, '$total'] } } } }]),
      PurchaseModel.aggregate<{ total: number }>([{ $match: { ...purchaseScope, purchaseDate: { $gte: month, $lte: now } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      CustomerModel.countDocuments({ companyId: company, isActive: true }),
      SupplierModel.countDocuments({ companyId: company, isActive: true }),
      ProductModel.countDocuments({ companyId: company, isActive: true }),
      StockBalanceModel.countDocuments({ ...stockScope, $expr: { $and: [{ $gt: ['$minStock', 0] }, { $lt: ['$quantity', '$minStock'] }] } }),
      StockBalanceModel.countDocuments({ ...stockScope, quantity: 0 }),
      StockBalanceModel.aggregate<{ value: number }>([
        { $match: stockScope },
        { $lookup: {
          from: 'products',
          let: { productId: '$productId', companyId: '$companyId' },
          pipeline: [{
            $match: { $expr: { $and: [
              { $eq: ['$_id', '$$productId'] },
              { $eq: ['$companyId', '$$companyId'] },
            ] } },
          }, { $project: { purchasePrice: 1 } }],
          as: 'product',
        } },
        { $unwind: '$product' },
        { $group: { _id: null, value: { $sum: { $multiply: ['$quantity', '$product.purchasePrice'] } } } },
      ]),
      SaleModel.find(saleScope).sort({ saleDate: -1 }).limit(5).select('id customerName total status saleDate').lean().exec(),
      PurchaseModel.find(purchaseScope).sort({ purchaseDate: -1 }).limit(5).select('id supplierName total status purchaseDate').lean().exec(),
      InventoryMovementModel.find(movementScope).sort({ createdAt: -1 }).limit(5).select('id type productName quantity createdAt').lean().exec(),
    ]);
    return {
      ventasHoy: salesToday[0]?.total ?? 0,
      ventasMes: salesMonth[0]?.total ?? 0,
      comprasMes: purchasesMonth[0]?.total ?? 0,
      clientesActivos: customers,
      proveedoresActivos: suppliers,
      productosActivos: products,
      stockBajo: lowStock,
      productosAgotados: outOfStock,
      inventarioValorizado: valuation[0]?.value ?? 0,
      ventasRecientes: recentSales,
      comprasRecientes: recentPurchases,
      movimientosRecientes: recentMovements,
    };
  },
};
