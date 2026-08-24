import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { AuthThrottlerGuard } from './auth-throttle.guard'
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@appstore/shared'
import { ZodValidationPipe } from 'nestjs-zod'
import { SignupService } from '../orgs/signup.service'
import { LoginService, type LoginResult } from './login.service'
import {
  clearRefreshCookie,
  readCookie,
  REFRESH_COOKIE,
  setRefreshCookie,
  type CookieOptions,
} from './cookies'
import { loadEnv } from '../config/env'
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

/** Only the response surface these handlers touch. */
interface CookieResponse {
  setHeader(name: string, value: string): unknown
}

/**
 * How a client wants its refresh token handled.
 *
 * Absent means "in the response body", which is what the mobile app needs and
 * what every curl and CI script already does. A browser opts into cookie mode
 * explicitly, because guessing from headers is the kind of inference that
 * quietly breaks the day a proxy strips something.
 */
const COOKIE_MODE_HEADER = 'x-auth-mode'

const wantsCookie = (req: { get?: (header: string) => string | undefined }): boolean =>
  req.get?.(COOKIE_MODE_HEADER)?.toLowerCase() === 'cookie'

@Controller('auth')
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(
    private readonly signup: SignupService,
    private readonly loginService: LoginService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {}

  /** Read once per instance, matching download-signer.ts. */
  private readonly env = loadEnv(process.env)

  private get cookieOptions(): CookieOptions {
    return {
      secure: this.env.COOKIE_SECURE ?? this.env.NODE_ENV === 'production',
    }
  }

  /**
   * Puts the refresh token wherever the client asked for it.
   *
   * In cookie mode the token is REMOVED from the body, not merely duplicated
   * into the cookie. Leaving it in both places would mean an XSS could call
   * refresh — the cookie is attached automatically — and read the token
   * straight out of the reply, which is the exact thing httpOnly is for.
   */
  private deliver<T extends { refreshToken: string }>(
    pair: T,
    req: AgentRequest,
    res: CookieResponse,
  ): T | Omit<T, 'refreshToken'> {
    if (!wantsCookie(req)) return pair

    res.setHeader('Set-Cookie', setRefreshCookie(pair.refreshToken, this.cookieOptions))
    const { refreshToken: _omitted, ...rest } = pair
    return rest
  }

  /** The presented refresh token, from whichever place this client uses. */
  private presentedToken(body: { refreshToken?: string }, req: AgentRequest): string | null {
    return body?.refreshToken ?? readCookie(req.get?.('cookie'), REFRESH_COOKIE)
  }

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
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<TokenPair | Omit<TokenPair, 'refreshToken'>> {
    const { orgId, userId } = await this.signup.signUp(body)
    const pair = await this.tokens.issue({ sub: userId, orgId, role: 'owner' })
    await this.sessions.open(pair.refreshToken, {
      orgId,
      userId,
      userAgent: req.get?.('user-agent'),
    })
    return this.deliver(pair, req, res)
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: AgentRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<LoginResult | Omit<LoginResult, 'refreshToken'>> {
    const result = await this.loginService.login(body, req.get?.('user-agent'))
    return this.deliver(result, req, res)
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
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<TokenPair | Omit<TokenPair, 'refreshToken'>> {
    const token = this.presentedToken(body, req)
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

    return this.deliver(pair, req, res)
  }

  /**
   * Sign out.
   *
   * `@Public()` for the same reason refresh is: the credential being retired is
   * the refresh token in the body, and a client whose access token has already
   * expired must still be able to sign out. Presenting a token that is not
   * yours revokes nothing, because the lookup is by hash of the token itself.
   */
  /**
   * Ends every session this person holds in this org, not just the one in
   * front of them.
   *
   * The question it answers is "I think somebody has my token" — and the
   * ordinary logout cannot answer it, because it revokes the credential you
   * are already holding and leaves the attacker's untouched.
   *
   * NOT @Public(), unlike logout: this needs to know WHO, and the refresh
   * token in front of us is exactly what a person in this situation may not
   * trust. The access token identifies them instead.
   */
  @Post('logout-all')
  @HttpCode(200)
  async logoutEverywhere(
    @Req() req: AgentRequest & { auth?: { sub: string; orgId: string } },
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<{ revoked: number }> {
    const auth = req.auth
    if (!auth) throw new UnauthorizedException('Not signed in')

    const revoked = await this.sessions.revokeAllForUser(auth.orgId, auth.sub, 'logout')

    // The caller's own session is among those just revoked, so their cookie is
    // now pointing at nothing — clearing it is what makes the UI agree.
    if (wantsCookie(req)) {
      res.setHeader('Set-Cookie', clearRefreshCookie(this.cookieOptions))
    }

    return { revoked }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body() body: { refreshToken?: string },
    @Req() req: AgentRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<void> {
    // Cleared unconditionally, before anything can throw. A logout that leaves
    // the cookie in place because the token had already expired would leave the
    // browser presenting a dead credential on every later request.
    if (wantsCookie(req)) {
      res.setHeader('Set-Cookie', clearRefreshCookie(this.cookieOptions))
    }

    const token = this.presentedToken(body, req)
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
