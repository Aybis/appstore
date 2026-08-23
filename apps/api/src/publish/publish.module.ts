import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { DatabaseModule } from '../db/database.provider'
import { ArtifactStore } from '../storage/artifact-store'
import { PublishController } from './publish.controller'
import { PublishService } from './publish.service'
import { TestersService } from './testers.service'

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [PublishController],
  providers: [PublishService, TestersService, ArtifactStore],
})
export class PublishModule {}
