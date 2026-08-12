import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { loadEnv } from '../config/env'
import { SignupService } from '../orgs/signup.service'
import { AuthController } from './auth.controller'
import { JwtGuard } from './jwt.guard'
import { LoginService } from './login.service'
import { PasswordService } from './password.service'
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
  providers: [PasswordService, TokenService, LoginService, SignupService, JwtGuard],
  exports: [TokenService, PasswordService, JwtGuard],
})
export class AuthModule {}
