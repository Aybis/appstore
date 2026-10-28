import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { DatabaseModule } from '../db/database.provider'
import { ClientController } from './client.controller'
import { ClientPublishService } from './client-publish.service'
import { ClientService } from './client.service'

/** Distribution of the MAYA client itself — see ClientService for why this is
 *  a deploy artifact rather than a catalog app. */
@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [ClientController],
  providers: [ClientService, ClientPublishService],
})
export class ClientModule {}
