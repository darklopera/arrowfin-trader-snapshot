import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { APP_CONFIG, AppConfig } from '../config/env';
import { createPrismaClient } from '../shared/prisma.service';

/** Privileged (owner) connection: exists ONLY inside the dev module. */
@Injectable()
export class AdminPrisma implements OnModuleDestroy {
  readonly client: PrismaClient;
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = createPrismaClient(config.adminDatabaseUrl!);
  }
  onModuleDestroy() {
    return this.client.$disconnect();
  }
}
