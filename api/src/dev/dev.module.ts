import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { AdminPrisma } from './admin-prisma';
import { DevAuthController } from './dev-auth.controller';
import { DevFillsController } from './dev-fills.controller';
import { DevFillsService } from './dev-fills.service';

/**
 * Development-only surface (fill simulator + demo login). AppModule imports
 * this module ONLY when ENABLE_DEV_ENDPOINTS=true and NODE_ENV!=production; in
 * every other case the routes are not registered at all (404), and the
 * privileged DB connection is never created. loadConfig() additionally refuses
 * to boot if both are set. See SECURITY.md.
 */
@Module({
  imports: [SnapshotModule, RealtimeModule],
  controllers: [DevFillsController, DevAuthController],
  providers: [AdminPrisma, DevFillsService],
})
export class DevModule {}
