import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { DatabaseModule } from './db/database.provider'
import { HealthModule } from './health/health.module'
import { OrgsModule } from './orgs/orgs.module'

@Module({ imports: [DatabaseModule, AuthModule, HealthModule, OrgsModule] })
export class AppModule {}
