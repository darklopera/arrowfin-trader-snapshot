import Decimal from 'decimal.js';
import { computeSnapshot } from './snapshot.calculator';
import { FillInput, InstrumentSpec, UnknownInstrumentError } from './types';

const D = (v: number | string) => new Decimal(v);
const SESSION = new Date('2026-08-24T22:00:00Z');
const instruments = new Map<string, InstrumentSpec>([
  ['MES', { symbol: 'MES', pointValueUsd: D(5) }],
  ['ES', { symbol: 'ES', pointValueUsd: D(50) }],
  ['6E', { symbol: '6E', pointValueUsd: D(125000) }],
]);

let n = 0;
type FillSpec = Omit<Partial<FillInput>, 'price'> & Pick<FillInput, 'side' | 'quantity'> & { price: number | string };
function fill(p: FillSpec): FillInput {
  n += 1;
  return {
    id: `F${String(n).padStart(4, '0')}`,
    symbol: 'MES',
    filledAt: new Date(`2026-08-25T10:00:${String(n % 60).padStart(2, '0')}Z`),
    orderId: `O${n}`,
    commissionUsd: D(0),
    ...p,
    price: D(p.price),
  };
}
const run = (fills: FillInput[], marks: Record<string, number> = {}, balance = 50000) =>
  computeSnapshot({
    fills,
    instruments,
    marks: new Map(Object.entries(marks).map(([k, v]) => [k, D(v)])),
    balance: D(balance),
    sessionStart: SESSION,
  });

describe('computeSnapshot', () => {
  it('returns an empty, valid snapshot for an account with no fills', () => {
    const s = run([]);
    expect(s.positions).toEqual([]);
    expect(s.pnl.totalUsd).toBe(0);
    expect(s.risk).toEqual({ score: 0, level: 'low', grossNotionalUsd: 0 });
    expect(s.activity).toEqual({ fillsToday: 0, ordersToday: 0 });
  });

  it('opens a long and values it against the mark using the POINT VALUE (MES=5)', () => {
    const s = run([fill({ side: 'BUY', quantity: 2, price: 5600 })], { MES: 5610 });
    expect(s.positions[0]).toMatchObject({ symbol: 'MES', netQty: 2, avgPrice: 5600, markPrice: 5610 });
    expect(s.pnl.unrealizedUsd).toBe(100); // 10 pts * 2 * $5
  });

  it('ES is 10x MES for the same move (contract sizes differ)', () => {
    const mes = run([fill({ side: 'BUY', quantity: 1, price: 5600 })], { MES: 5610 });
    const es = run([fill({ side: 'BUY', quantity: 1, price: 5600, symbol: 'ES' })], { ES: 5610 });
    expect(es.pnl.unrealizedUsd).toBe(mes.pnl.unrealizedUsd * 10);
  });

  it('shorts profit when price falls', () => {
    const s = run([fill({ side: 'SELL', quantity: 3, price: 5600 })], { MES: 5590 });
    expect(s.positions[0].netQty).toBe(-3);
    expect(s.pnl.unrealizedUsd).toBe(150);
  });

  it('re-averages the entry price when adding to a position', () => {
    const s = run([
      fill({ side: 'BUY', quantity: 1, price: 5600 }),
      fill({ side: 'BUY', quantity: 3, price: 5604 }),
    ], { MES: 5604 });
    expect(s.positions[0].avgPrice).toBe(5603);
  });

  it('realizes P&L on a partial close and keeps the average price', () => {
    const s = run([
      fill({ side: 'BUY', quantity: 4, price: 5600 }),
      fill({ side: 'SELL', quantity: 1, price: 5610 }),
    ], { MES: 5610 });
    expect(s.pnl.realizedGrossUsd).toBe(50); // 10 pts * 1 * $5
    expect(s.positions[0]).toMatchObject({ netQty: 3, avgPrice: 5600 });
    expect(s.pnl.unrealizedUsd).toBe(150);
  });

  it('a fully closed position disappears from open positions but its P&L stays', () => {
    const s = run([
      fill({ side: 'BUY', quantity: 2, price: 5600 }),
      fill({ side: 'SELL', quantity: 2, price: 5605 }),
    ], { MES: 5700 });
    expect(s.positions).toEqual([]);
    expect(s.pnl.realizedGrossUsd).toBe(50);
    expect(s.pnl.unrealizedUsd).toBe(0);
  });

  it('handles a flip through zero: closes the old side, opens the rest at the fill price', () => {
    const s = run([
      fill({ side: 'BUY', quantity: 2, price: 5600 }),
      fill({ side: 'SELL', quantity: 5, price: 5610 }),
    ], { MES: 5610 });
    expect(s.pnl.realizedGrossUsd).toBe(100); // closed 2 long: 10pts*2*5
    expect(s.positions[0]).toMatchObject({ netQty: -3, avgPrice: 5610 });
  });

  it('subtracts commissions (real money) from day realized P&L', () => {
    const s = run([
      fill({ side: 'BUY', quantity: 1, price: 5600, commissionUsd: D('0.70') }),
      fill({ side: 'SELL', quantity: 1, price: 5610, commissionUsd: D('0.70') }),
    ]);
    expect(s.pnl.realizedGrossUsd).toBe(50);
    expect(s.pnl.commissionsUsd).toBe(1.4);
    expect(s.pnl.realizedNetUsd).toBe(48.6);
  });

  it('counts an order that filled in several pieces as ONE order', () => {
    const s = run([
      fill({ side: 'BUY', quantity: 5, price: 5600, orderId: 'ORD-1' }),
      fill({ side: 'BUY', quantity: 5, price: 5600, orderId: 'ORD-1' }),
      fill({ side: 'SELL', quantity: 10, price: 5601, orderId: 'ORD-2' }),
    ]);
    expect(s.activity).toEqual({ fillsToday: 3, ordersToday: 2 });
  });

  it('carries positions over from a previous session but excludes their P&L/commissions from "today"', () => {
    const yesterday = new Date('2026-08-24T15:00:00Z'); // before sessionStart
    const s = run([
      fill({ side: 'BUY', quantity: 2, price: 5600, filledAt: yesterday, commissionUsd: D(1.4) }),
      fill({ side: 'SELL', quantity: 1, price: 5610, commissionUsd: D(0.7) }),
    ], { MES: 5610 });
    expect(s.positions[0]).toMatchObject({ netQty: 1, avgPrice: 5600 });
    expect(s.pnl.realizedGrossUsd).toBe(50); // today's close of a carried position
    expect(s.pnl.commissionsUsd).toBe(0.7); // only today's commission
    expect(s.activity.fillsToday).toBe(1);
  });

  it('is independent of input order (sorts by time, then id)', () => {
    const a = fill({ side: 'BUY', quantity: 2, price: 5600, filledAt: new Date('2026-08-25T10:00:00Z') });
    const b = fill({ side: 'SELL', quantity: 2, price: 5610, filledAt: new Date('2026-08-25T10:05:00Z') });
    expect(run([b, a])).toEqual(run([a, b]));
  });

  it('does not accumulate floating point error on large point values (6E)', () => {
    const s = run([
      fill({ side: 'BUY', quantity: 1, price: '1.10425', symbol: '6E' }),
      fill({ side: 'SELL', quantity: 1, price: '1.10435', symbol: '6E' }),
    ]);
    expect(s.pnl.realizedGrossUsd).toBe(12.5); // 1 tick = $12.50 exactly
  });

  it('values a position at cost when there is no mark (and reports markPrice null)', () => {
    const s = run([fill({ side: 'BUY', quantity: 1, price: 5600 })], {});
    expect(s.positions[0].markPrice).toBeNull();
    expect(s.pnl.unrealizedUsd).toBe(0);
    expect(s.risk.grossNotionalUsd).toBe(28000);
  });

  it('throws a typed error for an instrument without a specification', () => {
    expect(() => run([fill({ side: 'BUY', quantity: 1, price: 1, symbol: 'XX' })])).toThrow(UnknownInstrumentError);
  });

  describe('risk indicator', () => {
    it('is min(100, grossNotional / balance * 100)', () => {
      const s = run([fill({ side: 'BUY', quantity: 1, price: 5600 })], { MES: 5600 }, 56000);
      expect(s.risk).toEqual({ score: 50, level: 'low', grossNotionalUsd: 28000 });
    });
    it('caps at 100', () => {
      const s = run([fill({ side: 'BUY', quantity: 10, price: 5600 })], { MES: 5600 }, 1000);
      expect(s.risk.score).toBe(100);
      expect(s.risk.level).toBe('high');
    });
    it('uses gross exposure: a long and a short do not net each other out', () => {
      const s = run([
        fill({ side: 'BUY', quantity: 1, price: 5600 }),
        fill({ side: 'SELL', quantity: 1, price: 100, symbol: '6E' }),
      ], { MES: 5600, '6E': 100 }, 1000000);
      expect(s.positions).toHaveLength(2);
      expect(s.risk.grossNotionalUsd).toBe(28000 + 100 * 125000);
    });
    it('zero balance with exposure is maximum risk, never NaN/Infinity', () => {
      const s = run([fill({ side: 'BUY', quantity: 1, price: 5600 })], { MES: 5600 }, 0);
      expect(s.risk).toMatchObject({ score: 100, level: 'high' });
    });
    it('zero balance with no exposure is zero risk', () => {
      expect(run([], {}, 0).risk.score).toBe(0);
    });
    it('level boundaries: >75 is high, >50 elevated', () => {
      const at = (pct: number) => run([fill({ side: 'BUY', quantity: 1, price: 5600 })], { MES: 5600 }, 28000 / (pct / 100)).risk.level;
      expect(at(50)).toBe('low');
      expect(at(60)).toBe('elevated');
      expect(at(75)).toBe('elevated');
      expect(at(76)).toBe('high');
    });
  });
});
