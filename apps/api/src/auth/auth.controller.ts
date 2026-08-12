import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@appstore/shared'
import { ZodValidationPipe } from 'nestjs-zod'
import { SignupService } from '../orgs/signup.service'
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
    const { orgId, userId } = await this.signup.signUp(body)
    return this.tokens.issue({ sub: userId, orgId, role: 'owner' })
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<TokenPair> {
    return this.loginService.login(body)
  }
}
