import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ThrottlerModule } from '@nestjs/throttler'
import { loadEnv } from '../config/env'
import { SignupService } from '../orgs/signup.service'
import { AuthController } from './auth.controller'
import { AuthThrottlerGuard } from './auth-throttle.guard'
import { JwtGuard } from './jwt.guard'
import { LoginService } from './login.service'
import { PasswordService } from './password.service'
import { RolesGuard } from './roles.guard'
import { TokenService } from './token.service'

@Module({
  // registerAsync + useFactory defers loadEnv(process.env) to DI-instantiation
  // time (same reason DatabaseModule's databaseProvider uses a useFactory
  // instead of calling loadEnv directly): JwtModule.register's plain form
  // would evaluate its argument — including loadEnv(process.env) — the moment
  // this module's class decorator runs, i.e. at ES import time, before any
  // test harness gets a chance to set process.env.JWT_SECRET. That broke both
  // the health and auth e2e suites, which import AppModule (and thus this
  // module) at the top of the file, well before their setup code runs.
  imports: [
    JwtModule.registerAsync({ useFactory: () => ({ secret: loadEnv(process.env).JWT_SECRET }) }),
    /**
     * Four throttlers: two windows against two budgets.
     *
     * The `ip-` / `acct-` prefixes are load-bearing — AuthThrottlerGuard reads
     * them to decide which half of its composite tracker a throttler counts.
     *
     * The IP pair is loose on purpose. A whole office behind one NAT shares an
     * address, and refusing a building in order to slow one attacker is a bad
     * trade; its job is to stop bulk automation, not to police people.
     *
     * The account pair is tight, and safe to be tight: it can only ever refuse
     * attempts against one (org, email), and only after five wrong passwords in
     * a minute. The short window stops a tight loop; the long one stops the
     * patient version that would otherwise just wait the short window out.
     */
    ThrottlerModule.forRoot([
      { name: 'ip-burst', ttl: 60_000, limit: 20 },
      { name: 'ip-sustained', ttl: 3_600_000, limit: 100 },
      { name: 'acct-burst', ttl: 60_000, limit: 5 },
      { name: 'acct-sustained', ttl: 3_600_000, limit: 20 },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    PasswordService,
    TokenService,
    LoginService,
    SignupService,
    JwtGuard,
    RolesGuard,
    AuthThrottlerGuard,
    // Global guards (round 1, M4): every route in the application is
    // authenticated and role-checked by default from here on. Previously
    // both guards were opt-in via `@UseGuards(...)`, which meant a
    // controller that simply forgot to apply them was silently public —
    // fail-open by omission. A route that must stay open now has to say so
    // explicitly with `@Public()` (see public.decorator.ts) instead of every
    // OTHER route having to opt in. Order is significant and preserved by
    // registration order here: JwtGuard must run before RolesGuard, since
    // RolesGuard reads `request.auth`, which only JwtGuard populates.
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokenService, PasswordService, JwtGuard, RolesGuard],
})
export class AuthModule {}
