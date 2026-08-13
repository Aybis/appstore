import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { loadEnv } from '../config/env'
import { SignupService } from '../orgs/signup.service'
import { AuthController } from './auth.controller'
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
  imports: [JwtModule.registerAsync({ useFactory: () => ({ secret: loadEnv(process.env).JWT_SECRET }) })],
  controllers: [AuthController],
  providers: [
    PasswordService,
    TokenService,
    LoginService,
    SignupService,
    JwtGuard,
    RolesGuard,
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
