import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  aggregateTaxes,
  computeLineTotals,
  roundMoney,
  toSaleResponse,
} from './sales.service.js';
import type { SaleDocument } from './sales.model.js';

const ISO_DATE = '2026-09-22T12:00:00.000Z';

function makeSale(overrides: Partial<Record<string, unknown>> = {}): SaleDocument {
  const values = {
    _id: new Types.ObjectId(),
    companyId: new Types.ObjectId(),
    customerId: new Types.ObjectId(),
    customerName: 'Cliente Venta',
    userId: new Types.ObjectId(),
    userName: 'Ada Admin',
    warehouseId: new Types.ObjectId(),
    warehouseName: 'Depósito Central',
    branchId: undefined as Types.ObjectId | undefined,
    saleDate: new Date(ISO_DATE),
    status: 'confirmed' as const,
    notes: 'Venta de mostrador' as string | undefined,
    items: [
      {
        productId: new Types.ObjectId(),
        productSku: 'SKU-001',
        productName: 'Producto Uno',
        quantity: 3,
        unitPrice: 20,
        discount: 0,
        subtotal: 60,
        discountAmount: 0,
        taxes: [{ name: 'IVA', rate: 16, amount: 9.6 }],
        total: 69.6,
      },
    ],
    subtotal: 60,
    discountTotal: 0,
    taxes: [{ name: 'IVA', rate: 16, amount: 9.6 }],
    total: 69.6,
    history: [
      { action: 'created' as const, at: new Date(ISO_DATE), userId: new Types.ObjectId(), userName: 'Ada Admin' },
      {
        action: 'confirmed' as const,
        at: new Date('2026-09-22T12:05:00.000Z'),
        userId: new Types.ObjectId(),
        userName: 'Ada Admin',
      },
    ],
    confirmedAt: new Date('2026-09-22T12:05:00.000Z'),
    cancelledAt: undefined as Date | undefined,
    returnedAt: undefined as Date | undefined,
    createdAt: new Date(ISO_DATE),
    updatedAt: new Date('2026-09-22T12:05:00.000Z'),
    ...overrides,
  };
  return { id: values._id.toString(), ...values } as unknown as SaleDocument;
}

describe('roundMoney', () => {
  it('redondea a 2 decimales incluso con error de coma flotante', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(10.99 * 3)).toBe(32.97); // 32.969999999999996 en coma flotante
    expect(roundMoney(0)).toBe(0);
  });
});

describe('computeLineTotals', () => {
  it('calcula subtotal y total sin impuestos ni descuento', () => {
    const totals = computeLineTotals({ unitPrice: 20, quantity: 3, discount: 0, taxes: [] });
    expect(totals).toEqual({ subtotal: 60, discountAmount: 0, taxes: [], total: 60 });
  });

  it('aplica descuento antes que los impuestos (10% + IVA 16%)', () => {
    const totals = computeLineTotals({
      unitPrice: 20,
      quantity: 2,
      discount: 10,
      taxes: [{ name: 'IVA', rate: 16 }],
    });
    expect(totals.subtotal).toBe(40);
    expect(totals.discountAmount).toBe(4); // 40 − 10%
    expect(totals.taxes).toEqual([{ name: 'IVA', rate: 16, amount: 5.76 }]); // 16% de 36
    expect(totals.total).toBe(41.76); // 36 + 5.76
  });

  it('redondea importes a 2 decimales y acumula varios impuestos', () => {
    const totals = computeLineTotals({
      unitPrice: 10.99,
      quantity: 3,
      discount: 0,
      taxes: [
        { name: 'IVA', rate: 16 },
        { name: 'IEPS', rate: 8 },
      ],
    });
    expect(totals.subtotal).toBe(32.97); // 10.99 × 3 (evita 32.96999…)
    expect(totals.taxes[0]?.amount).toBe(5.28); // 16% de 32.97 → 5.2752
    expect(totals.taxes[1]?.amount).toBe(2.64); // 8% de 32.97 → 2.6376
    expect(totals.total).toBe(40.89); // 32.97 + 5.28 + 2.64
  });
});

describe('aggregateTaxes', () => {
  it('suma impuestos con el mismo nombre/tasa y separa los distintos', () => {
    const aggregated = aggregateTaxes([
      { taxes: [{ name: 'IVA', rate: 16, amount: 5.76 }, { name: 'IEPS', rate: 8, amount: 1 }] },
      { taxes: [{ name: 'IVA', rate: 16, amount: 3 }] },
    ]);
    expect(aggregated).toHaveLength(2);
    expect(aggregated.find((tax) => tax.name === 'IVA')?.amount).toBe(8.76);
    expect(aggregated.find((tax) => tax.name === 'IEPS')?.amount).toBe(1);
  });
});

describe('toSaleResponse', () => {
  it('mapea la venta con snapshots, ítems, impuestos e historial en ISO', () => {
    const response = toSaleResponse(makeSale());

    expect(response.status).toBe('confirmed');
    expect(response.customerName).toBe('Cliente Venta');
    expect(response.warehouseName).toBe('Depósito Central');
    expect(response.branchId).toBeNull(); // sucursal opcional (Fase 13)
    expect(response.saleDate).toBe(ISO_DATE);
    expect(response.confirmedAt).toBe('2026-09-22T12:05:00.000Z');
    expect(response.items[0]?.productName).toBe('Producto Uno');
    expect(response.items[0]?.total).toBe(69.6);
    expect(response.taxes).toEqual([{ name: 'IVA', rate: 16, amount: 9.6 }]);
    expect(response.history.map((event) => event.action)).toEqual(['created', 'confirmed']);
    expect(response.history[0]?.at).toBe(ISO_DATE);
    expect(response.createdAt).toBe(ISO_DATE);
  });

  it('devuelve null en campos opcionales y fechas de transición ausentes', () => {
    const response = toSaleResponse(
      makeSale({
        notes: undefined,
        branchId: undefined,
        confirmedAt: undefined,
        updatedAt: undefined,
      }),
    );

    expect(response.notes).toBeNull();
    expect(response.branchId).toBeNull();
    expect(response.confirmedAt).toBeNull();
    expect(response.cancelledAt).toBeNull();
    expect(response.returnedAt).toBeNull();
    expect(response.updatedAt).toBeNull();
  });

  it('nunca incluye passwordHash ni secretos', () => {
    const response = toSaleResponse(makeSale());
    expect(Object.keys(response)).not.toContain('passwordHash');
    expect(JSON.stringify(response)).not.toContain('passwordHash');
  });
});
