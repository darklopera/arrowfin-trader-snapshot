import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../shared/prisma.service';
import { TenantScope } from '../../shared/tenant';
import { InstrumentSpec } from '../domain/types';
import { AccountSummary, SnapshotData, SnapshotRepositoryPort } from '../application/ports';

const dec = (v: { toString(): string }) => new Decimal(v.toString());

/**
 * Tenant isolation, layer 2 of 3 (see SECURITY.md):
 *   1. JWT guard derives the scope from verified claims.
 *   2. THIS file: every query runs inside withTenant() AND repeats
 *      `brokerId` (and `traderId`) in its WHERE clause explicitly.
 *   3. Postgres RLS rejects whatever layer 2 might one day forget.
 *
 * Each query uses `select` so only the columns the feature needs are read:
 * no `SELECT *`, so a column added to the table later never flows out by accident.
 */
@Injectable()
export class PrismaSnapshotRepository implements SnapshotRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  listAccounts(scope: TenantScope): Promise<AccountSummary[]> {
    return this.prisma.withTenant(scope.brokerId, (tx) =>
      tx.account.findMany({
        where: { brokerId: scope.brokerId, traderId: scope.traderId },
        select: { id: true, accountNumber: true, accountType: true, status: true },
        orderBy: { id: 'asc' },
      }),
    );
  }

  loadSnapshotData(scope: TenantScope, accountId: string): Promise<SnapshotData | null> {
    return this.prisma.withTenant(scope.brokerId, async (tx) => {
      const account = await tx.account.findFirst({
        where: { id: accountId, brokerId: scope.brokerId, traderId: scope.traderId },
        select: { id: true, accountNumber: true, accountType: true, status: true, balance: true },
      });
      if (!account) return null; // not found == not yours: callers cannot tell the difference

      // Served by fills_account_filled_at_id_idx (account_id, filled_at, id):
      // index range scan, already in the order the calculator needs.
      const fills = await tx.fill.findMany({
        where: { accountId: account.id, brokerId: scope.brokerId },
        orderBy: [{ filledAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true, instrumentSymbol: true, side: true, quantity: true,
          price: true, filledAt: true, orderId: true, commissionUsd: true,
        },
      });
      const instruments = await tx.instrument.findMany({ select: { symbol: true, pointValueUsd: true } });
      const marks = await tx.marketPrice.findMany({ select: { symbol: true, markPrice: true, asOf: true } });

      return {
        account: { ...account, balance: dec(account.balance) },
        fills: fills.map((f) => ({
          id: f.id, symbol: f.instrumentSymbol, side: f.side, quantity: f.quantity,
          price: dec(f.price), filledAt: f.filledAt, orderId: f.orderId, commissionUsd: dec(f.commissionUsd),
        })),
        instruments: new Map<string, InstrumentSpec>(
          instruments.map((i) => [i.symbol, { symbol: i.symbol, pointValueUsd: dec(i.pointValueUsd) }]),
        ),
        marks: new Map(marks.map((m) => [m.symbol, dec(m.markPrice)])),
        marksAsOf: marks.length ? new Date(Math.max(...marks.map((m) => m.asOf.getTime()))) : null,
      };
    });
  }
}
