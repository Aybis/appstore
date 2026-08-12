import { signupSchema, type SignupInput } from '@appstore/shared'
import { Body, Controller, Post } from '@nestjs/common'
import { ZodValidationPipe } from 'nestjs-zod'
import { SignupService, type SignupResult } from './signup.service'

@Controller('orgs')
export class OrgsController {
  constructor(private readonly signup: SignupService) {}

  @Post()
  signUp(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<SignupResult> {
    return this.signup.signUp(body)
  }
}
