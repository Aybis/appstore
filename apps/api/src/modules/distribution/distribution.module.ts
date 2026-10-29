import { Module } from '@nestjs/common'
import { AndroidAdapter } from './android.adapter'
import { ItmsServicesAdapter } from './itms-services.adapter'
import { DistributionRegistry } from './distribution.registry'

@Module({
  providers: [AndroidAdapter, ItmsServicesAdapter, DistributionRegistry],
  exports: [DistributionRegistry, ItmsServicesAdapter],
})
export class DistributionModule {}
