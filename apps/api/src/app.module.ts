import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { CatalogModule } from './catalog/catalog.module'
import { DatabaseModule } from './db/database.provider'
import { HealthModule } from './health/health.module'
import { PublishModule } from './publish/publish.module'

// OrgsModule (POST /orgs) was retired in Task 6 round 1 (finding I3): it
// duplicated AuthModule's signup path with a second DI instance of
// SignupService and a second route, which meant any future control added to
// AuthController — throttling, invite-only gating, an audit hook — would
// silently miss this one. AuthController's POST /auth/signup is now the only
// signup entry point. See task-6-report.md.
@Module({ imports: [DatabaseModule, AuthModule, HealthModule, CatalogModule, PublishModule] })
export class AppModule {}
