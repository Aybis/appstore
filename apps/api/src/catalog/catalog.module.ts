import { Module } from '@nestjs/common'
import { DatabaseModule } from '../db/database.provider'
import { CatalogController } from './catalog.controller'
import { CatalogService } from './catalog.service'
import { DownloadController } from './download.controller'
import { DownloadSigner } from './download-signer'

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController, DownloadController],
  providers: [CatalogService, DownloadSigner],
})
export class CatalogModule {}
