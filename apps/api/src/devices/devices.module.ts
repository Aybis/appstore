import { Module } from '@nestjs/common'

import { DatabaseModule } from '../db/database.provider'
import { DevicesController } from './devices.controller'
import { DevicesService } from './devices.service'

@Module({
  imports: [DatabaseModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
