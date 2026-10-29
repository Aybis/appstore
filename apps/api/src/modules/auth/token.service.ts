import { randomUUID } from 'node:crypto'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

export type MembershipRole = 'owner' | 'admin' | 'publisher' | 'viewer'

export interface AccessClaims {
  sub: string
  orgId: string
  role: MembershipRole
  /**
   * What kind of caller this is. Absent means a person, which is every JWT.
   *
   * Set to 'api_key' by JwtGuard for a machine credential, and read by
   * RolesGuard — which for a person re-reads `memberships` because the claim
   * can be up to a refresh TTL stale, and for a key must not, because a key's
   * subject is a key id with no membership row to find. The key's own row is
   * the authority there, it was read during this very request, and the
   * database caps its role at publisher (migration 0011).
   *
   * Never signed into a JWT — it is set on the request, not carried in a
   * token, so nothing a client sends can claim it.
   */
  kind?: 'api_key'
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

  /**
   * `jti` is what makes each token UNIQUE, and it is not decoration.
   *
   * A JWT is a deterministic function of its payload, and `iat`/`exp` have
   * one-second resolution — so issuing twice for the same subject within the
   * same second produced two byte-identical tokens. Rotation then handed the
   * client back the token it had just presented, and the sessions table
   * rejected the insert on its own unique index, which is how this was found.
   *
   * Without it, "rotate the refresh token" silently did nothing at all for any
   * client that refreshed inside a second of a previous issue.
   */
  async issue(claims: AccessClaims): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { ...claims, typ: 'access', jti: randomUUID() },
        { expiresIn: ACCESS_TTL_SECONDS, algorithm: ALGORITHM },
      ),
      this.jwt.signAsync(
        { ...claims, typ: 'refresh', jti: randomUUID() },
        { expiresIn: REFRESH_TTL_SECONDS, algorithm: ALGORITHM },
      ),
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
