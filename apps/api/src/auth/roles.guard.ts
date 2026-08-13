import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { eq } from 'drizzle-orm'
import { DATABASE, type Database } from '../db/database.provider'
import { memberships } from '../db/schema'
import { withTenant } from '../db/tenant'
import { ROLES_KEY } from './roles.decorator'
import type { AccessClaims, MembershipRole } from './token.service'

/**
 * The minimal request shape this guard needs. `JwtGuard` populates `.auth`
 * from a verified access token before this guard ever runs (both are applied
 * together via `@UseGuards(JwtGuard, RolesGuard)`), but this guard must not
 * assume that happened — see the no-auth branch below.
 */
interface AuthenticatedRequest {
  auth?: AccessClaims
}

/**
 * Enforces `@Roles(...)` — and, independent of any specific role
 * requirement, that the caller still HAS a membership at all.
 *
 * DESIGN DECISION (task-7-brief.md): a verified access token proves who
 * signed it and that it hasn't expired — nothing more. It does NOT prove the
 * subject is still a member of the claimed org, or still holds the claimed
 * role: the refresh TTL is 30 days, so `role` on the token can be up to 30
 * days stale. Trusting the token's `role` claim directly (cheap: no query
 * per request) would let a demoted or fully removed member keep their old
 * authority for up to 30 days after an admin revokes it — unacceptable for a
 * B2B SaaS where "revoke my ex-colleague's access" must take effect on their
 * very next request.
 *
 * So this guard re-reads the `memberships` row for (sub, orgId) on every
 * request, through `withTenant` — the only sanctioned path to tenant data —
 * and treats THAT row's role as authoritative, not the token's. The token's
 * `role` claim is not read at all here; only `sub` and `orgId` (identity and
 * scope) are trusted, and even those are meaningless without a live
 * membership row backing them:
 *
 *   - No membership row for (sub, orgId) → deny, unconditionally, even for a
 *     route with no `@Roles()` at all. No row means no standing in this org,
 *     full stop — a route that merely requires "any authenticated member"
 *     still requires that the caller currently BE one.
 *   - A membership row exists but its role isn't in the required list (and
 *     isn't 'owner') → deny.
 *   - A membership row exists with a sufficient role → allow.
 *
 * This costs one indexed query (`memberships_org_user_key`) per guarded
 * request. That's the accepted tradeoff for authority that is always
 * current rather than frozen at token-issuance time.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const auth = context.switchToHttp().getRequest<AuthenticatedRequest>().auth
    // Checked before the reflector/DB work below: an unauthenticated request
    // is refused regardless of what (if anything) `@Roles()` requires, and
    // without spending a query on it.
    if (!auth) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const required = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const currentRole = await this.currentRole(auth.sub, auth.orgId)
    // The token was valid, but nothing currently backs it in this org —
    // removed member, or a token scoped to an org the subject never
    // (or no longer) belongs to.
    if (!currentRole) {
      throw new ForbiddenException('Insufficient permissions')
    }

    if (!required || required.length === 0) {
      return true
    }
    // Owner is the org's root authority and is never locked out of its own
    // data, no matter what a specific route's `@Roles()` lists.
    if (currentRole === 'owner' || required.includes(currentRole)) {
      return true
    }
    throw new ForbiddenException('Insufficient permissions')
  }

  private async currentRole(userId: string, orgId: string): Promise<MembershipRole | undefined> {
    const rows = await withTenant(this.db, orgId, (tx) =>
      tx.select({ role: memberships.role }).from(memberships).where(eq(memberships.userId, userId)).limit(1),
    )
    return rows[0]?.role
  }
}
