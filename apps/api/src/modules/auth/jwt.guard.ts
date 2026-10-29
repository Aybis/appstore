import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ApiKeysService } from './api-keys.service'
import { IS_PUBLIC_KEY } from './public.decorator'
import { TokenService, type AccessClaims } from './token.service'

/** How a machine credential announces itself. See ApiKeysService. */
const API_KEY_PREFIX = 'maya_ci_'

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
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Registered globally (round 1, M4 — see auth.module.ts's APP_GUARD
    // providers), so this runs for every route unless it opts out with
    // `@Public()`. Checked first: a public route never even looks at the
    // Authorization header.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatableRequest>()
    const token = extractBearerToken(request.headers.authorization)
    if (!token) {
      throw new UnauthorizedException('Missing bearer token')
    }

    /*
     * A build server presents an API key in the same Authorization header a
     * person's access token uses. Distinguished by prefix rather than by a
     * separate header, so every existing client, proxy and CORS allowlist
     * keeps working unchanged.
     *
     * The resulting `request.auth` is deliberately the SAME shape a JWT
     * produces, which is what lets RolesGuard, withTenant and every controller
     * treat the two identically. `sub` carries the key's id: an audit event
     * naming which key pushed a release is more useful than one naming the
     * person who minted it months earlier.
     */
    if (token.startsWith(API_KEY_PREFIX)) {
      const key = await this.apiKeys.authenticate(token)
      if (!key) throw new UnauthorizedException('Invalid API key')

      request.auth = { sub: key.keyId, orgId: key.orgId, role: key.role, kind: 'api_key' }
      return true
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
