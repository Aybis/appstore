import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@appstore/shared'
import { ZodValidationPipe } from 'nestjs-zod'
import { SignupService } from '../orgs/signup.service'
import { LoginService } from './login.service'
import { Public } from './public.decorator'
import { TokenService, type TokenPair } from './token.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly signup: SignupService,
    private readonly loginService: LoginService,
    private readonly tokens: TokenService,
  ) {}

  // Round 1 caught a duplicate-email conflict here and issued a decoy token
  // pair instead, to avoid disclosing whether the email was registered.
  // Round 2 reverted that: a two-request slug probe recovers the same
  // signal for free regardless of what this endpoint's body says (the
  // successful signup's own side effect — the new `organizations` row — is
  // the real oracle), so the decoy bought no privacy and did cost something
  // real: a structurally valid `role: 'owner'` JWT handed to an
  // unauthenticated caller. SignupService's ConflictException (for both a
  // slug and an email collision) is now allowed to propagate as-is. See
  // signup.service.ts's comment on the `catch` block in `signUp`, and
  // task-6-report.md, round 2.
  // Round 1, M4: JwtGuard/RolesGuard are now global (APP_GUARD in
  // auth.module.ts). Signup and login are how a caller GETS a token in the
  // first place, so both must stay reachable without one.
  @Public()
  @Post('signup')
  async signUp(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<TokenPair> {
    const { orgId, userId } = await this.signup.signUp(body)
    return this.tokens.issue({ sub: userId, orgId, role: 'owner' })
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<TokenPair> {
    return this.loginService.login(body)
  }
}
