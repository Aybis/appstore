import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { TokenService, type AccessClaims } from './token.service'

// RFC 7235 §2.1: the auth-scheme token ("Bearer") is case-insensitive. The
// `i` flag only affects matching the literal "bearer" text; the captured
// group preserves the token's exact characters untouched. See
// task-6-report.md, round 1, M3.
const BEARER_PATTERN = /^Bearer\s+(.+)$/i

/**
 * The minimal request shape this guard needs. Avoids depending on Express's
 * own types (not installed as a direct dependency here) while still giving
 * `request.auth` a real type for downstream handlers/guards (Task 7's RBAC
 * guard reads it) instead of falling back to `any`.
 */
interface AuthenticatableRequest {
  headers: { authorization?: string | undefined }
  auth?: AccessClaims
}

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatableRequest>()
    const token = extractBearerToken(request.headers.authorization)
    if (!token) {
      throw new UnauthorizedException('Missing bearer token')
    }

    request.auth = await this.tokens.verifyAccess(token)
    return true
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  const match = header ? BEARER_PATTERN.exec(header) : null
  const token = match?.[1]?.trim()
  return token && token.length > 0 ? token : undefined
}
