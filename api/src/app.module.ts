import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DevModule } from './dev/dev.module';
import { HealthController } from './health.controller';
import { RealtimeModule } from './realtime/realtime.module';
import { SharedModule } from './shared/shared.module';
import { SnapshotModule } from './snapshot/snapshot.module';

// Dev-only surface is opt-in AND impossible in production (see DevModule + loadConfig).
export const devModulesFor = (env: NodeJS.ProcessEnv) =>
  env.ENABLE_DEV_ENDPOINTS === 'true' && env.NODE_ENV !== 'production' ? [DevModule] : [];

@Module({
  imports: [SharedModule, AuthModule, SnapshotModule, RealtimeModule, ...devModulesFor(process.env)],
  controllers: [HealthController],
})
export class AppModule {}
