import { Types, type ClientSession, type FilterQuery, type UpdateQuery } from 'mongoose';
import type { SaleStatus } from '@erp/types';
import type { ListSalesQueryInput } from '@erp/validation';
import { escapeRegExp } from '../../shared/utils/regex.js';
import { SaleModel, type SaleDocument, type SaleSchemaType } from './sales.model.js';
import type { SaleCreatePersistInput, SaleListResult } from './sales.types.js';

/** Inicio del día calendario (UTC) de una fecha `AAAA-MM-DD`. */
function dayStartUTC(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

/** Primer instante del DÍA SIGUIENTE: límite superior (exclusivo) de `dateTo`. */
function nextDayStartUTC(isoDay: string): Date {
  const start = dayStartUTC(isoDay);
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
}

/**
 * Construye el filtro de listado. El scope multiempresa (`companyId`) SIEMPRE
 * se aplica aquí: el filtro del cliente nunca puede ampliar el alcance.
 * La búsqueda cubre los snapshots de cliente, nombre de producto y SKU
 * (escape de regex); `dateFrom`/`dateTo` son días completos e inclusivos.
 */
export function buildSaleFilter(
  companyId: string,
  query: ListSalesQueryInput,
): FilterQuery<SaleSchemaType> {
  const filter: FilterQuery<SaleSchemaType> = {
    companyId: new Types.ObjectId(companyId),
  };
  if (query.status) filter.status = query.status;
  if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
  if (query.warehouseId) filter.warehouseId = new Types.ObjectId(query.warehouseId);
  if (query.dateFrom || query.dateTo) {
    const range: { $gte?: Date; $lt?: Date } = {};
    if (query.dateFrom) range.$gte = dayStartUTC(query.dateFrom);
    if (query.dateTo) range.$lt = nextDayStartUTC(query.dateTo);
    filter.saleDate = range;
  }
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [
      { customerName: pattern },
      { 'items.productName': pattern },
      { 'items.productSku': pattern },
    ];
  }
  return filter;
}

export const salesRepository = {
  async findById(id: string): Promise<SaleDocument | null> {
    return SaleModel.findById(id).exec();
  },

  /** Listado paginado con filtros, búsqueda y orden seguros. */
  async list(companyId: string, query: ListSalesQueryInput): Promise<SaleListResult> {
    const filter = buildSaleFilter(companyId, query);
    const sort: Record<string, 1 | -1> = {
      [query.sort]: query.order === 'asc' ? 1 : -1,
    };
    const skip = (query.page - 1) * query.limit;

    const [sales, total] = await Promise.all([
      SaleModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      SaleModel.countDocuments(filter).exec(),
    ]);
    return { sales, total };
  },

  async create(input: SaleCreatePersistInput): Promise<SaleDocument> {
    return SaleModel.create(input);
  },

  /**
   * Reclamo atómico de transición de estado DENTRO de una transacción:
   * solo transiciona si el estado actual está permitido (`allowedStatuses`)
   * y devuelve el documento PREVIO (`new: false`) para que el service sepa,
   * p. ej., si una cancelación debe reponer stock (venta confirmada).
   * `null` = estado actual no permite la transición (o carrera perdida).
   */
  async claimTransition(
    companyId: string,
    id: string,
    allowedStatuses: SaleStatus[],
    update: UpdateQuery<SaleSchemaType>,
    session: ClientSession,
  ): Promise<SaleDocument | null> {
    return SaleModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId),
        status: { $in: allowedStatuses },
      },
      update,
      { new: false, session },
    ).exec();
  },
};
