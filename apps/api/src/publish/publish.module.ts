import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { DatabaseModule } from '../db/database.provider'
import { ArtifactStore } from '../storage/artifact-store'
import { PublishController } from './publish.controller'
import { TestingController } from './testing.controller'
import { SpoolCleanupInterceptor } from './spool-cleanup.interceptor'
import { UploadSlots } from './upload-slots'
import { ApiKeysController } from './api-keys.controller'
import { PublishService } from './publish.service'
import { TestersService } from './testers.service'

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  controllers: [PublishController, TestingController, ApiKeysController],
  providers: [PublishService, TestersService, ArtifactStore, UploadSlots, SpoolCleanupInterceptor],
})
export class PublishModule {}
