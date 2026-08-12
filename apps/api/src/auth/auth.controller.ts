import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@appstore/shared'
import { randomUUID } from 'node:crypto'
import { ZodValidationPipe } from 'nestjs-zod'
import { EmailAlreadyRegisteredException, SignupService } from '../orgs/signup.service'
import { LoginService } from './login.service'
import { TokenService, type TokenPair } from './token.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly signup: SignupService,
    private readonly loginService: LoginService,
    private readonly tokens: TokenService,
  ) {}

  @Post('signup')
  async signUp(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<TokenPair> {
    try {
      const { orgId, userId } = await this.signup.signUp(body)
      return await this.tokens.issue({ sub: userId, orgId, role: 'owner' })
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredException) {
        // The org slug was free but the email belongs to an existing
        // account. Respond exactly like a real signup — same status, same
        // body shape — so an unauthenticated caller can't use this endpoint
        // as an email-existence oracle (attacker controls the slug, so a
        // distinguishable response here is a clean enumeration signal; see
        // task-6-report.md, round 1, I2). No row is written for this
        // request: the tokens below are bound to a `sub`/`orgId` that exist
        // nowhere in the database, so they authenticate as structurally
        // valid JWTs but grant access to nothing — the real account is
        // neither touched nor notified.
        return await this.tokens.issue({ sub: randomUUID(), orgId: randomUUID(), role: 'owner' })
      }
      throw error
    }
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<TokenPair> {
    return this.loginService.login(body)
  }
}
