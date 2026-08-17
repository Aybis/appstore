import { Module } from '@nestjs/common'
import { DatabaseModule } from '../db/database.provider'
import { CatalogController } from './catalog.controller'
import { CatalogService } from './catalog.service'
import { DownloadController } from './download.controller'
import { DownloadSigner } from './download-signer'
import { VersionCheckController } from './version-check.controller'

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController, DownloadController, VersionCheckController],
  providers: [CatalogService, DownloadSigner],
})
export class CatalogModule {}
