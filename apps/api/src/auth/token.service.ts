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

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  async issue(claims: AccessClaims): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...claims, typ: 'access' }, { expiresIn: ACCESS_TTL_SECONDS }),
      this.jwt.signAsync({ ...claims, typ: 'refresh' }, { expiresIn: REFRESH_TTL_SECONDS }),
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
    let payload: { sub: string; orgId: string; role: MembershipRole; typ?: string }
    try {
      payload = await this.jwt.verifyAsync(token)
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
    if (payload.typ !== expected) {
      throw new UnauthorizedException('Invalid or expired token')
    }
    return { sub: payload.sub, orgId: payload.orgId, role: payload.role }
  }
}
