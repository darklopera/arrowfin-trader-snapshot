import Decimal from 'decimal.js';
import {
  FillInput,
  PositionView,
  RiskLevel,
  SnapshotInput,
  SnapshotResult,
  UnknownInstrumentError,
} from './types';

const ZERO = new Decimal(0);
const money = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber();

interface Lot {
  qty: number; // signed
  avg: Decimal;
}

/**
 * PURE function: no I/O, no clock, no ORM. Everything it needs is passed in, so
 * it is trivially unit-testable and reusable from the REST path and the
 * WebSocket path (both must give identical numbers).
 *
 * Method: replay ALL of the account's fills in time order (positions carry over
 * between sessions), using average-cost accounting.
 *  - A fill that increases a position re-averages the entry price.
 *  - A fill that reduces it realizes P&L = (fillPrice - avg) * direction * qty * pointValue
 *    on the closed quantity; avg is unchanged.
 *  - A fill that flips through zero closes the old side then opens the rest at fill price.
 * Only fills at/after `sessionStart` contribute to "day" realized P&L and
 * commissions, but every fill shapes the open position.
 *
 * Money uses decimal.js: futures point values (6E = 125,000) magnify binary
 * floating-point error into real cents.
 */
export function computeSnapshot(input: SnapshotInput): SnapshotResult {
  const { instruments, marks, balance, sessionStart } = input;

  // Deterministic order: time, then id as tie-break (fills share timestamps).
  const fills = [...input.fills].sort(compareFills);

  const lots = new Map<string, Lot>();
  let realizedGross = ZERO;
  let commissions = ZERO;
  let fillsToday = 0;
  const ordersToday = new Set<string>();

  for (const fill of fills) {
    const spec = instruments.get(fill.symbol);
    if (!spec) throw new UnknownInstrumentError(fill.symbol);

    const lot = lots.get(fill.symbol) ?? { qty: 0, avg: ZERO };
    const realized = applyFill(lot, fill, spec.pointValueUsd);
    lots.set(fill.symbol, lot);

    if (fill.filledAt >= sessionStart) {
      realizedGross = realizedGross.plus(realized);
      commissions = commissions.plus(fill.commissionUsd);
      fillsToday += 1;
      ordersToday.add(fill.orderId);
    }
  }

  const positions: PositionView[] = [];
  let unrealized = ZERO;
  let grossNotional = ZERO;

  for (const [symbol, lot] of lots) {
    if (lot.qty === 0) continue;
    const pointValue = instruments.get(symbol)!.pointValueUsd;
    const mark = marks.get(symbol) ?? null;
    const reference = mark ?? lot.avg; // no mark: value at cost, unrealized = 0
    const notional = reference.times(Math.abs(lot.qty)).times(pointValue);
    const open = reference.minus(lot.avg).times(lot.qty).times(pointValue);

    unrealized = unrealized.plus(open);
    grossNotional = grossNotional.plus(notional);
    positions.push({
      symbol,
      netQty: lot.qty,
      avgPrice: lot.avg.toDecimalPlaces(6).toNumber(),
      markPrice: mark ? mark.toNumber() : null,
      notionalUsd: money(notional),
      unrealizedPnlUsd: money(open),
    });
  }
  positions.sort((a, b) => a.symbol.localeCompare(b.symbol));

  const realizedNet = realizedGross.minus(commissions);
  const { score, level } = riskFrom(grossNotional, balance);

  return {
    positions,
    pnl: {
      realizedGrossUsd: money(realizedGross),
      commissionsUsd: money(commissions),
      realizedNetUsd: money(realizedNet),
      unrealizedUsd: money(unrealized),
      totalUsd: money(realizedNet.plus(unrealized)),
    },
    risk: { score, level, grossNotionalUsd: money(grossNotional) },
    activity: { fillsToday, ordersToday: ordersToday.size },
  };
}

/**
 * risk = min(100, |positions_notional| / account_balance * 100).
 * Edge cases the raw formula ignores: balance <= 0 would divide by zero or go
 * negative. With exposure and no balance the account is as risky as it gets
 * (100); with no exposure it is 0.
 */
export function riskFrom(grossNotional: Decimal, balance: Decimal): { score: number; level: RiskLevel } {
  let raw: Decimal;
  if (grossNotional.isZero()) raw = ZERO;
  else if (balance.lte(0)) raw = new Decimal(100);
  else raw = grossNotional.div(balance).times(100);

  const score = Decimal.min(raw, 100).toDecimalPlaces(1, Decimal.ROUND_HALF_EVEN).toNumber();
  const level: RiskLevel = score > 75 ? 'high' : score > 50 ? 'elevated' : 'low';
  return { score, level };
}

/** Mutates `lot`; returns the gross P&L realized by this fill (0 if it only opens/adds). */
function applyFill(lot: Lot, fill: FillInput, pointValue: Decimal): Decimal {
  const signed = fill.side === 'BUY' ? fill.quantity : -fill.quantity;

  if (lot.qty === 0 || Math.sign(lot.qty) === Math.sign(signed)) {
    const newQty = lot.qty + signed;
    lot.avg = lot.avg
      .times(Math.abs(lot.qty))
      .plus(fill.price.times(fill.quantity))
      .div(Math.abs(newQty));
    lot.qty = newQty;
    return ZERO;
  }

  const direction = Math.sign(lot.qty); // +1 long, -1 short
  const closing = Math.min(fill.quantity, Math.abs(lot.qty));
  const realized = fill.price.minus(lot.avg).times(direction).times(closing).times(pointValue);

  lot.qty += signed;
  if (lot.qty === 0) lot.avg = ZERO;
  else if (Math.sign(lot.qty) !== direction) lot.avg = fill.price; // flipped: remainder opens at fill price
  return realized;
}

function compareFills(a: FillInput, b: FillInput): number {
  const dt = a.filledAt.getTime() - b.filledAt.getTime();
  return dt !== 0 ? dt : a.id.localeCompare(b.id);
}
