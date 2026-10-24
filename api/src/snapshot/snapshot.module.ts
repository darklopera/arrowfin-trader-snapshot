import { Module } from '@nestjs/common';
import { GetSnapshotUseCase } from './application/get-snapshot.use-case';
import { SNAPSHOT_REPOSITORY } from './application/ports';
import { PrismaSnapshotRepository } from './infrastructure/prisma-snapshot.repository';
import { SnapshotController } from './interface/snapshot.controller';

@Module({
  controllers: [SnapshotController],
  providers: [GetSnapshotUseCase, { provide: SNAPSHOT_REPOSITORY, useClass: PrismaSnapshotRepository }],
  exports: [GetSnapshotUseCase, SNAPSHOT_REPOSITORY],
})
export class SnapshotModule {}
