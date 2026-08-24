import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { DatabaseModule } from '../db/database.provider'
import { DistributionModule } from '../distribution/distribution.module'
import { CatalogController } from './catalog.controller'
import { CatalogService } from './catalog.service'
import { DownloadController } from './download.controller'
import { IconController } from './icon.controller'
import { IconStore } from '../storage/icon-store'
import { DownloadSigner } from './download-signer'
import { VersionCheckController } from './version-check.controller'

@Module({
  imports: [DatabaseModule, DistributionModule, AuditModule],
  controllers: [CatalogController, DownloadController, VersionCheckController, IconController],
  providers: [CatalogService, DownloadSigner, IconStore],
})
export class CatalogModule {}
