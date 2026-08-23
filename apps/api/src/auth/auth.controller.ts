import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { AuthThrottlerGuard } from './auth-throttle.guard'
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@appstore/shared'
import { ZodValidationPipe } from 'nestjs-zod'
import { SignupService } from '../orgs/signup.service'
import { LoginService, type LoginResult } from './login.service'
import { SessionService } from './session.service'
import { Public } from './public.decorator'
import { TokenService, type TokenPair } from './token.service'

/**
 * Every route here is rate limited (security review S-3).
 *
 * Applied at the controller so a route added later is covered by default —
 * the same fail-closed reasoning that made the auth guards global. These are
 * the only endpoints that mint or renew credentials, which is exactly what an
 * attacker is after.
 */
/** Structural, matching this package's no-@types/express convention. */
interface AgentRequest {
  get?(header: string): string | undefined
}

@Controller('auth')
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(
    private readonly signup: SignupService,
    private readonly loginService: LoginService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
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
  async signUp(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Req() req: AgentRequest,
  ): Promise<TokenPair> {
    const { orgId, userId } = await this.signup.signUp(body)
    const pair = await this.tokens.issue({ sub: userId, orgId, role: 'owner' })
    await this.sessions.open(pair.refreshToken, {
      orgId,
      userId,
      userAgent: req.get?.('user-agent'),
    })
    return pair
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: AgentRequest,
  ): Promise<LoginResult> {
    return this.loginService.login(body, req.get?.('user-agent'))
  }

  /**
   * Exchanges a refresh token for a fresh pair.
   *
   * Access tokens live 15 minutes; without this route the refresh token the
   * issuer already mints was unredeemable, so every client silently died a
   * quarter of an hour after signing in.
   *
   * `@Public()` because the caller by definition has no valid access token —
   * the refresh token itself is the credential, and verifyRefresh() rejects
   * anything not signed by us with `typ: 'refresh'`.
   *
   * The re-issued pair carries the claims from the refresh token, but no
   * authority flows from them: RolesGuard re-reads `memberships` on every
   * request, so a role revoked mid-session still takes effect immediately.
   */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: AgentRequest,
  ): Promise<TokenPair> {
    const token = body?.refreshToken
    if (!token) throw new UnauthorizedException('refreshToken is required')

    const claims = await this.tokens.verifyRefresh(token)
    const pair = await this.tokens.issue(claims)

    // Rotation happens AFTER the new pair exists so both can be written in one
    // transaction — and it is what turns a valid signature into a valid
    // session. A signature alone no longer buys anything: the row has to be
    // live, unexpired, and unrevoked.
    await this.sessions.rotate(token, pair.refreshToken, {
      orgId: claims.orgId,
      userId: claims.sub,
      userAgent: req.get?.('user-agent'),
    })

    return pair
  }

  /**
   * Sign out.
   *
   * `@Public()` for the same reason refresh is: the credential being retired is
   * the refresh token in the body, and a client whose access token has already
   * expired must still be able to sign out. Presenting a token that is not
   * yours revokes nothing, because the lookup is by hash of the token itself.
   */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: { refreshToken?: string }): Promise<void> {
    const token = body?.refreshToken
    if (!token) return

    // A token that no longer verifies is already useless; saying so would tell
    // an attacker which of their guesses was once real.
    try {
      const claims = await this.tokens.verifyRefresh(token)
      await this.sessions.revoke(token, claims.orgId, 'logout')
    } catch {
      // Deliberately silent — logout is idempotent and reveals nothing.
    }
  }
}
