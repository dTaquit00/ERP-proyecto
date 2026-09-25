import { Types } from 'mongoose';
import type { DashboardQueryInput } from '@erp/validation';
import { SaleModel } from '../sales/sales.model.js';
import { PurchaseModel } from '../purchases/purchases.model.js';
import { CustomerModel } from '../customers/customers.model.js';
import { SupplierModel } from '../suppliers/suppliers.model.js';
import { ProductModel } from '../products/products.model.js';
import { StockBalanceModel, InventoryMovementModel } from '../inventory/inventory.model.js';

function dayStart(date: Date): Date { const value = new Date(date); value.setUTCHours(0, 0, 0, 0); return value; }
function monthStart(date: Date): Date { const value = dayStart(date); value.setUTCDate(1); return value; }

export const dashboardService = {
  async summary(companyId: string, query: DashboardQueryInput) {
    const company = new Types.ObjectId(companyId);
    const saleScope: Record<string, unknown> = { companyId: company, status: { $in: ['confirmed', 'returned'] } };
    const purchaseScope: Record<string, unknown> = { companyId: company, status: { $ne: 'cancelled' } };
    const stockScope: Record<string, unknown> = { companyId: company };
    const movementScope: Record<string, unknown> = { companyId: company };
    if (query.branchId) saleScope.branchId = new Types.ObjectId(query.branchId);
    if (query.warehouseId) {
      saleScope.warehouseId = new Types.ObjectId(query.warehouseId);
      purchaseScope.warehouseId = new Types.ObjectId(query.warehouseId);
      stockScope.warehouseId = new Types.ObjectId(query.warehouseId);
      movementScope.warehouseId = new Types.ObjectId(query.warehouseId);
    }
    const now = new Date();
    const today = dayStart(now);
    const month = monthStart(now);
    const [salesToday, salesMonth, purchasesMonth, customers, suppliers, products, lowStock, outOfStock, valuation, recentSales, recentPurchases, recentMovements] = await Promise.all([
      SaleModel.aggregate<{ total: number }>([{ $match: { ...saleScope, saleDate: { $gte: today } } }, { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, { $multiply: ['$total', -1] }, '$total'] } } } }]),
      SaleModel.aggregate<{ total: number }>([{ $match: { ...saleScope, saleDate: { $gte: month } } }, { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, { $multiply: ['$total', -1] }, '$total'] } } } }]),
      PurchaseModel.aggregate<{ total: number }>([{ $match: { ...purchaseScope, purchaseDate: { $gte: month } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
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
