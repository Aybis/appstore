import { Module } from '@nestjs/common'

import { ClientController } from './client.controller'
import { ClientService } from './client.service'

/** Distribution of the MAYA client itself — see ClientService for why this is
 *  a deploy artifact rather than a catalog app. */
@Module({
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
