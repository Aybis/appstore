import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { and, eq } from 'drizzle-orm'
import { DATABASE, type Database } from '../db/database.provider'
import { memberships } from '../db/schema'
import { withTenant } from '../db/tenant'
import { IS_PUBLIC_KEY } from './public.decorator'
import { ROLES_KEY } from './roles.decorator'
import type { AccessClaims, MembershipRole } from './token.service'

/**
 * The minimal request shape this guard needs. `JwtGuard` populates `.auth`
 * from a verified access token before this guard ever runs — both are
 * registered globally, in that order (round 1, M4 — see auth.module.ts's
 * `APP_GUARD` providers) — but this guard must not assume that happened,
 * since a request to a `@Public()` route never gets an `.auth` at all. See
 * the no-auth branch below.
 */
interface AuthenticatedRequest {
  auth?: AccessClaims
}

/**
 * Enforces `@Roles(...)` — and, independent of any specific role
 * requirement, that the caller still HAS a membership at all.
 *
 * DESIGN DECISION — mandated by the Task 7 coordinator dispatch, not the
 * written brief (whose Step 3 sample shows the token-trusting version
 * below, as its literal, unqualified code): a verified access token proves
 * who signed it and that it hasn't expired — nothing more. It does NOT
 * prove the subject is still a member of the claimed org, or still holds
 * the claimed role: the refresh TTL is 30 days, so `role` on the token can
 * be up to 30 days stale. Trusting the token's `role` claim directly
 * (cheap: no query per request) would let a demoted or fully removed
 * member keep their old authority for up to 30 days after an admin revokes
 * it — unacceptable for a B2B SaaS where "revoke my ex-colleague's access"
 * must take effect on their very next request.
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
 * COST (measured, not estimated — round 1 review): a warm connection pays
 * SIX round trips per guarded request, not one query — `withTenant` opens a
 * transaction and, inside it: BEGIN, the same-tenant nesting-guard SELECT on
 * `current_setting`, `SET LOCAL ROLE app_runtime`, `set_config` for
 * `app.current_org_id`, the membership SELECT itself, then COMMIT. Once a
 * Task 8 handler opens its OWN `withTenant` for the actual request work, a
 * single guarded request is two separate transactions and twelve round
 * trips total, not one. That's the accepted tradeoff for authority that is
 * always current rather than frozen at token-issuance time — but plan
 * capacity off twelve, not one.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Registered globally (round 1, M4), so this runs for every route unless
    // it opts out with `@Public()`. Checked first, before the auth/DB work
    // below: a public route pays no cost here at all, same as JwtGuard.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const auth = context.switchToHttp().getRequest<AuthenticatedRequest>().auth
    // An unauthenticated request to a non-public route is refused regardless
    // of what (if anything) `@Roles()` requires, and without spending a
    // query on it.
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
    // Explicit org_id predicate, not just userId: RLS's policy already scopes
    // every row this query can see to `orgId` (the GUC `withTenant` just set),
    // so under normal operation this predicate is redundant with RLS and
    // can't change the result — `memberships_org_user_key` is UNIQUE on
    // (org_id, user_id), so once RLS narrows to one org there is at most one
    // row regardless of this WHERE clause. It is NOT redundant as a defense
    // in depth: RLS is the ONLY thing scoping this particular query, and this
    // query has no `ORDER BY`, so if RLS is ever bypassed or misconfigured —
    // a future migration mistake, a role accidentally granted BYPASSRLS —
    // `WHERE user_id = X LIMIT 1` alone degrades to a silent WRONG-ROW pick
    // instead of an error: whichever of the user's memberships across ALL
    // their orgs Postgres happens to scan first wins, which can hand back a
    // role from a completely different org than the one the request is
    // scoped to. Reproduced concretely in a rolled-back transaction (see
    // task-7-report.md, round 1, I1): with RLS disabled and no org_id
    // predicate, a GUC pinned to an org where the caller is merely 'viewer'
    // returned 'owner' from an unrelated org's row for the same user. Adding
    // `org_id` to the WHERE clause closes that even if RLS is gone entirely,
    // and costs nothing extra — `memberships_org_user_key` already covers
    // both columns.
    const rows = await withTenant(this.db, orgId, (tx) =>
      tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
        .limit(1),
    )
    return rows[0]?.role
  }
}
