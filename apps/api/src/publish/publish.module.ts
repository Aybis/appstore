import { Module } from '@nestjs/common'
import { DatabaseModule } from '../db/database.provider'
import { ArtifactStore } from '../storage/artifact-store'
import { PublishController } from './publish.controller'
import { PublishService } from './publish.service'

@Module({
  imports: [DatabaseModule],
  controllers: [PublishController],
  providers: [PublishService, ArtifactStore],
})
export class PublishModule {}
