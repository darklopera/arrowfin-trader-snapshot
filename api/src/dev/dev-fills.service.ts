import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { GetSnapshotUseCase } from '../snapshot/application/get-snapshot.use-case';
import { SNAPSHOT_PUBLISHER, SnapshotPublisherPort } from '../snapshot/application/ports';
import { asBrokerId, asTraderId } from '../shared/tenant';
import { AdminPrisma } from './admin-prisma';
import { DevFillDto } from './dev-fills.controller';

/**
 * Stand-in for the matching-engine feed. The production equivalent is a queue
 * consumer that persists the fill and then calls the same two lines at the
 * bottom: recompute, publish. Nothing downstream knows this is a simulator.
 */
@Injectable()
export class DevFillsService {
  constructor(
    private readonly admin: AdminPrisma,
    private readonly getSnapshot: GetSnapshotUseCase,
    @Inject(SNAPSHOT_PUBLISHER) private readonly publisher: SnapshotPublisherPort,
  ) {}

  async ingest(dto: DevFillDto) {
    const db = this.admin.client;
    const account = await db.account.findUnique({
      where: { id: dto.account_id },
      select: { id: true, brokerId: true, traderId: true },
    });
    if (!account) throw new NotFoundException('Unknown account');
    const instrument = await db.instrument.findUnique({ where: { symbol: dto.instrument_symbol } });
    if (!instrument) throw new BadRequestException('Unknown instrument');

    const filledAt = new Date();
    await db.fill.create({
      data: {
        id: `FIL-DEV-${randomUUID().slice(0, 8)}`,
        // broker comes from the ACCOUNT row, never from the request body
        brokerId: account.brokerId,
        accountId: account.id,
        instrumentSymbol: instrument.symbol,
        side: dto.side,
        quantity: dto.quantity,
        price: dto.price,
        filledAt,
        orderId: `ORD-DEV-${randomUUID().slice(0, 8)}`,
        liquidity: 'taker',
        commissionUsd: dto.commission_usd ?? 0,
      },
    });

    const scope = { brokerId: asBrokerId(account.brokerId), traderId: asTraderId(account.traderId) };
    const snapshot = await this.getSnapshot.execute(scope, account.id);
    if (!snapshot) throw new NotFoundException();
    this.publisher.publish(scope.brokerId, {
      accountId: account.id,
      version: snapshot.version,
      snapshot,
      lastFill: { symbol: instrument.symbol, side: dto.side, quantity: dto.quantity, price: dto.price, filledAt: filledAt.toISOString() },
    });
    return { accepted: true, version: snapshot.version };
  }
}
