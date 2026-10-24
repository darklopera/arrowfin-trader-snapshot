import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

type Row = Record<string, string>;
const read = (dir: string, file: string): Row[] =>
  parse(readFileSync(join(dir, file), 'utf8'), { columns: true, skip_empty_lines: true });

/**
 * Loads the assessment CSVs with a PRIVILEGED client (owner/superuser: it must
 * bypass RLS to write to every tenant). The API role never gets write access.
 *
 * DATA MINIMISATION happens here: from traders.csv we keep ONLY id, broker_id,
 * kyc_status, created_at. first/last name, email, phone, dob, ssn_last4,
 * address, notes and audit_notes are deliberately dropped on the floor, because
 * this feature does not need them and data we never store cannot leak.
 * brokers.api_key_hash is dropped too.
 */
export async function seedDatabase(prisma: PrismaClient, datasetDir: string) {
  const d = (s: string) => new Date(s);

  await prisma.broker.createMany({
    data: read(datasetDir, 'brokers.csv').map((r) => ({
      id: r.id, name: r.name, type: r.type, whiteLabelName: r.white_label_name, createdAt: d(r.created_at),
    })),
    skipDuplicates: true,
  });
  await prisma.trader.createMany({
    data: read(datasetDir, 'traders.csv').map((r) => ({
      id: r.id, brokerId: r.broker_id, kycStatus: r.kyc_status, createdAt: d(r.created_at),
    })),
    skipDuplicates: true,
  });

  const traderBroker = new Map(read(datasetDir, 'traders.csv').map((r) => [r.id, r.broker_id]));
  const accounts = read(datasetDir, 'accounts.csv');
  await prisma.account.createMany({
    data: accounts.map((r) => ({
      id: r.id,
      brokerId: traderBroker.get(r.trader_id)!, // derived from the trader: single source of truth
      traderId: r.trader_id,
      accountNumber: r.account_number,
      accountType: r.account_type,
      balance: r.balance,
      maxPositionSize: Number(r.max_position_size),
      status: r.status,
      createdAt: d(r.created_at),
    })),
    skipDuplicates: true,
  });

  await prisma.instrument.createMany({
    data: read(datasetDir, 'instruments.csv').map((r) => ({
      symbol: r.symbol, description: r.description, exchange: r.exchange,
      pointValueUsd: r.point_value_usd, tickSize: r.tick_size, tickValueUsd: r.tick_value_usd,
    })),
    skipDuplicates: true,
  });
  await prisma.marketPrice.createMany({
    data: read(datasetDir, 'market_prices.csv').map((r) => ({
      symbol: r.symbol, markPrice: r.mark_price, asOf: d(r.as_of),
    })),
    skipDuplicates: true,
  });

  const accountBroker = new Map(accounts.map((r) => [r.id, traderBroker.get(r.trader_id)!]));
  const fills = read(datasetDir, 'fills.csv').map((r) => ({
    id: r.id,
    brokerId: accountBroker.get(r.account_id)!,
    accountId: r.account_id,
    instrumentSymbol: r.instrument_symbol,
    side: r.side as 'BUY' | 'SELL',
    quantity: Number(r.quantity),
    price: r.price,
    filledAt: d(r.filled_at),
    orderId: r.order_id,
    liquidity: r.liquidity as 'maker' | 'taker',
    commissionUsd: r.commission_usd,
  }));
  for (let i = 0; i < fills.length; i += 500) {
    await prisma.fill.createMany({ data: fills.slice(i, i + 500), skipDuplicates: true });
  }
  return { brokers: 3, fills: fills.length };
}
