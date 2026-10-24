import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig, loadConfig } from '../config/env';
import { CLOCK, Clock } from '../snapshot/application/ports';
import { PrismaService } from './prisma.service';

/**
 * `SNAPSHOT_AS_OF` pins "now" so the demo shows the dataset cut
 * (2026-08-25T14:30Z) instead of whatever the real date is. It is refused in
 * production by loadConfig().
 */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: (): AppConfig => loadConfig() },
    {
      provide: CLOCK,
      inject: [APP_CONFIG],
      useFactory: (c: AppConfig): Clock => ({ now: () => c.snapshotAsOf ?? new Date() }),
    },
    PrismaService,
  ],
  exports: [APP_CONFIG, CLOCK, PrismaService],
})
export class SharedModule {}
