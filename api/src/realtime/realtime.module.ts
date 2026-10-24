import { Module } from '@nestjs/common';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { SNAPSHOT_PUBLISHER } from '../snapshot/application/ports';
import { FillsGateway } from './fills.gateway';

@Module({
  imports: [SnapshotModule],
  providers: [FillsGateway, { provide: SNAPSHOT_PUBLISHER, useExisting: FillsGateway }],
  exports: [SNAPSHOT_PUBLISHER],
})
export class RealtimeModule {}
