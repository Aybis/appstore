import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup'
import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { ClientModule } from './modules/client/client.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { DevicesModule } from './modules/devices/devices.module'
import { DatabaseModule } from './database/database.provider'
import { HealthModule } from './modules/health/health.module'
import { MembersModule } from './modules/members/members.module'
import { PublishModule } from './modules/publish/publish.module'
import { AccountModule } from './modules/account/account.module'

// OrgsModule (POST /orgs) was retired in Task 6 round 1 (finding I3): it
// duplicated AuthModule's signup path with a second DI instance of
// SignupService and a second route, which meant any future control added to
// AuthController — throttling, invite-only gating, an audit hook — would
// silently miss this one. AuthController's POST /auth/signup is now the only
// signup entry point. See task-6-report.md.
@Module({
  // SentryModule first, so its interceptor wraps every other module's routes.
  // The filter reports unexpected errors and leaves HttpExceptions (a 403, a
  // 404, a failed validation) alone — those are answers, not incidents.
  imports: [SentryModule.forRoot(), DatabaseModule, AuthModule, AuditModule, HealthModule, CatalogModule, PublishModule, ClientModule, MembersModule, DashboardModule, DevicesModule, AccountModule],
  providers: [{ provide: APP_FILTER, useClass: SentryGlobalFilter }],
})
export class AppModule {}
