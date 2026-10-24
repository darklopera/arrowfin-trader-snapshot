import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { APP_CONFIG, AppConfig } from '../config/env';
import { BrokerId } from './tenant';

export type TenantTx = Prisma.TransactionClient;

export function createPrismaClient(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/**
 * The request-path database client. It connects as `arrowfin_app`, a role with
 * SELECT only that is subject to Row Level Security.
 *
 * The one rule: all tenant data is read through `withTenant`, which opens a
 * transaction and sets `app.broker_id` with `set_config(..., is_local = true)`.
 * `is_local` scopes the value to THIS transaction, so a pooled connection that
 * is reused by the next request cannot leak the previous tenant.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = createPrismaClient(config.databaseUrl);
  }

  withTenant<T>(brokerId: BrokerId, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.broker_id', ${brokerId}, true)`;
      return fn(tx);
    });
  }

  /** Reference data that is not tenant-owned (instruments, marks). No RLS. */
  get reference(): PrismaClient {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
