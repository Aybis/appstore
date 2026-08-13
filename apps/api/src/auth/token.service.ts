import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

export type MembershipRole = 'owner' | 'admin' | 'publisher' | 'viewer'

export interface AccessClaims {
  sub: string
  orgId: string
  role: MembershipRole
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

const ACCESS_TTL_SECONDS = 15 * 60
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60

/**
 * Pinned on both sign and verify. `jsonwebtoken`/`@nestjs/jwt` will happily
 * verify a token signed with any HMAC algorithm as long as the secret
 * matches if no `algorithms` allowlist is given — an HS384 token signed with
 * this same secret verified successfully before this was added. Harmless
 * today (only this service signs tokens, and only with HS256), but it's the
 * latent shape of algorithm-confusion: pin both directions so a future
 * change elsewhere can't widen what's accepted here. See task-6-report.md,
 * round 1, M1.
 */
const ALGORITHM = 'HS256'

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  async issue(claims: AccessClaims): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...claims, typ: 'access' }, { expiresIn: ACCESS_TTL_SECONDS, algorithm: ALGORITHM }),
      this.jwt.signAsync({ ...claims, typ: 'refresh' }, { expiresIn: REFRESH_TTL_SECONDS, algorithm: ALGORITHM }),
    ])
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS }
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    return this.verify(token, 'access')
  }

  async verifyRefresh(token: string): Promise<AccessClaims> {
    return this.verify(token, 'refresh')
  }

  /**
   * The `typ` check prevents token-type confusion: a 30-day refresh token must
   * never be accepted where a 15-minute access token is expected.
   */
  private async verify(token: string, expected: 'access' | 'refresh'): Promise<AccessClaims> {
    let payload: { sub?: string; orgId?: string; role?: MembershipRole; typ?: string }
    try {
      payload = await this.jwt.verifyAsync(token, { algorithms: [ALGORITHM] })
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
    if (payload.typ !== expected) {
      throw new UnauthorizedException('Invalid or expired token')
    }
    // A token signed with this same secret but missing a required claim
    // (e.g. hand-crafted, or from a future signer that changes shape) would
    // otherwise decode to `{ sub: undefined, orgId: undefined, ... }` and
    // flow straight into request.auth — Task 7's RBAC guard reads `.role`
    // off that. Fail closed instead. See task-6-report.md, round 1, M2.
    if (!payload.sub || !payload.orgId || !payload.role) {
      throw new UnauthorizedException('Invalid or expired token')
    }
    return { sub: payload.sub, orgId: payload.orgId, role: payload.role }
  }
}
