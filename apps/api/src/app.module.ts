import { Module } from '@nestjs/common'
import { DatabaseModule } from './db/database.provider'
import { HealthModule } from './health/health.module'
import { OrgsModule } from './orgs/orgs.module'

@Module({ imports: [DatabaseModule, HealthModule, OrgsModule] })
export class AppModule {}
