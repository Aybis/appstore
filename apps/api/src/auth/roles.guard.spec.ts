import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import type { Database } from '../db/database.provider'
import { memberships, organizations, users } from '../db/schema'
import { withTenant } from '../db/tenant'
import { IS_PUBLIC_KEY } from './public.decorator'
import { ROLES_KEY } from './roles.decorator'
import { RolesGuard } from './roles.guard'
import type { AccessClaims, MembershipRole } from './token.service'

/**
 * The brief's Step 1 sample builds a `RolesGuard` that reads `role` straight
 * off the (unverified-for-currency) token claims — cheap, but a demoted or
 * removed member keeps their old authority for up to the 30-day refresh TTL.
 * Per this task's coordinator dispatch — which required resolving a design
 * decision the written brief itself never raises; its Step 3 shows the
 * token-trusting version as plain, unqualified sample code — `RolesGuard`
 * instead re-reads the `memberships` row per request through `withTenant`,
 * so it needs a live `Database` handle, not just a mocked `Reflector`. The
 * handful of cases that never depend on DB state (no authenticated claims at
 * all, or a `@Public()` route) stay as fast pure-unit tests below; every
 * case that depends on current membership state moved to the integration
 * suite beneath it, against the real harness.
 */

/**
 * Key-aware: distinguishes `ROLES_KEY` and `IS_PUBLIC_KEY` from each other
 * and from anything else, so a test exercising one metadata key can't
 * accidentally trip the other (a single `() => required` stub would make
 * `getAllAndOverride(IS_PUBLIC_KEY, ...)` return the roles array too — a
 * truthy value that would silently mark every route "public").
 */
function fakeReflector(required: MembershipRole[] | undefined, isPublic = false): Reflector {
  return {
    getAllAndOverride: (key: string) => {
      if (key === IS_PUBLIC_KEY) return isPublic
      if (key === ROLES_KEY) return required
      return undefined
    },
  } as unknown as Reflector
}

function contextWithAuth(auth: AccessClaims | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext
}

describe('RolesGuard (unit — no database access required)', () => {
  function poisonedDb(): Database {
    return {
      transaction: () => {
        throw new Error('RolesGuard queried the database when it should not have')
      },
    } as unknown as Database
  }

  it('denies an unauthenticated request without ever touching the database', async () => {
    const guard = new RolesGuard(fakeReflector(['viewer']), poisonedDb())

    await expect(guard.canActivate(contextWithAuth(undefined))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('allows a @Public() route without checking auth or touching the database (round 1, M4)', async () => {
    const guard = new RolesGuard(fakeReflector(undefined, true), poisonedDb())

    await expect(guard.canActivate(contextWithAuth(undefined))).resolves.toBe(true)
  })
})

describe('RolesGuard (integration — real membership re-read)', () => {
  const ctx = useTestDb()
  let orgId: string
  let userId: string

  beforeEach(async () => {
    await truncateAll(ctx)
    const [org] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    const [user] = await ctx.db
      .insert(users)
      .values({ email: 'lee@acme.test', passwordHash: 'x', displayName: 'Lee' })
      .returning()
    orgId = org!.id
    userId = user!.id
  })

  async function seedMembership(role: MembershipRole): Promise<void> {
    await withTenant(ctx.db, orgId, (tx) => tx.insert(memberships).values({ orgId, userId, role }))
  }

  function tokenClaiming(role: MembershipRole): AccessClaims {
    return { sub: userId, orgId, role }
  }

  function guardRequiring(required: MembershipRole[] | undefined): RolesGuard {
    return new RolesGuard(fakeReflector(required), ctx.db)
  }

  it('allows any currently-authorized role when no roles are required', async () => {
    await seedMembership('viewer')
    const guard = guardRequiring(undefined)

    await expect(guard.canActivate(contextWithAuth(tokenClaiming('viewer')))).resolves.toBe(true)
  })

  it('allows a role that is explicitly listed', async () => {
    await seedMembership('publisher')
    const guard = guardRequiring(['publisher', 'admin'])

    await expect(guard.canActivate(contextWithAuth(tokenClaiming('publisher')))).resolves.toBe(true)
  })

  it('denies a role that is not listed', async () => {
    await seedMembership('viewer')
    const guard = guardRequiring(['publisher', 'admin'])

    await expect(guard.canActivate(contextWithAuth(tokenClaiming('viewer')))).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it("treats the database's owner role as satisfying any requirement", async () => {
    await seedMembership('owner')
    const guard = guardRequiring(['publisher'])

    await expect(guard.canActivate(contextWithAuth(tokenClaiming('owner')))).resolves.toBe(true)
  })

  it('denies when the request carries no authenticated claims', async () => {
    const guard = guardRequiring(['viewer'])

    await expect(guard.canActivate(contextWithAuth(undefined))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("uses the database's current role over a stale token claim to ALLOW what the token alone would have denied", async () => {
    // Token was minted while this member was 'admin'; they have since been
    // demoted to 'viewer' by an org admin. The route only requires 'viewer'.
    // A token-trusting guard would already allow this (admin satisfies
    // viewer), so this alone wouldn't prove much — the next test is the one
    // that actually distinguishes the two designs. Kept for symmetry/coverage.
    await seedMembership('viewer')
    const guard = guardRequiring(['viewer'])
    const staleAdminToken = tokenClaiming('admin')

    await expect(guard.canActivate(contextWithAuth(staleAdminToken))).resolves.toBe(true)
  })

  it("uses the database's current role over a stale token claim to DENY what the token alone would have allowed", async () => {
    // This is the case that actually distinguishes "trust the token" from
    // "re-read the database": the token still says 'admin', but the
    // membership row backing it now says 'viewer'. A guard that read `role`
    // off the token claims (the brief's literal Step 3 code) would grant
    // this. The mandated design must deny it, because DB authority — not the
    // token — decides.
    await seedMembership('viewer')
    const guard = guardRequiring(['admin'])
    const staleAdminToken = tokenClaiming('admin')

    await expect(guard.canActivate(contextWithAuth(staleAdminToken))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('denies entirely once the membership row has been deleted, even with an otherwise-valid token', async () => {
    // Simulates a colleague being removed from the org: their access token
    // is still cryptographically valid and unexpired (refresh TTL is 30
    // days), but the membership backing it is gone. No @Roles() requirement
    // at all — proving this isn't merely a role-mismatch case.
    await seedMembership('admin')
    await withTenant(ctx.db, orgId, (tx) => tx.delete(memberships))
    const guard = guardRequiring(undefined)
    const removedMemberToken = tokenClaiming('admin')

    await expect(guard.canActivate(contextWithAuth(removedMemberToken))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('denies when the token names an org the user has no membership row in at all', async () => {
    const [otherOrg] = await ctx.db.insert(organizations).values({ slug: 'globex-inc', name: 'Globex' }).returning()
    await seedMembership('owner') // membership in `orgId`, not `otherOrg.id`
    const guard = guardRequiring(undefined)
    const crossOrgToken: AccessClaims = { sub: userId, orgId: otherOrg!.id, role: 'owner' }

    await expect(guard.canActivate(contextWithAuth(crossOrgToken))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it(
    'denies for a member of BOTH orgs when the token is scoped to the org where they hold the LESSER role ' +
      '(round 1, I1 — catches a wrong-row pick, not just total scope loss)',
    async () => {
      // The previous cross-org test uses an org the user has NO membership in
      // at all, which only proves total scope loss is caught. It says
      // nothing about a query that picks the WRONG membership row out of
      // several belonging to the same user — which is exactly what
      // `currentRole`'s query without an explicit `org_id` predicate is
      // exposed to: `memberships.userId = X` alone, with no `ORDER BY`, is
      // satisfied equally by every org this user belongs to. Here the user
      // is 'viewer' in `orgId` (org A) and 'owner' in a second org (org B).
      // The token is scoped to org A. A route requiring 'admin' must DENY —
      // if the query ever picked up org B's 'owner' row instead (privilege
      // escalation via wrong-row pick), this would wrongly ALLOW.
      const [otherOrg] = await ctx.db
        .insert(organizations)
        .values({ slug: 'globex-inc', name: 'Globex' })
        .returning()
      await seedMembership('viewer') // this user is 'viewer' in orgId (org A)
      await withTenant(ctx.db, otherOrg!.id, (tx) =>
        tx.insert(memberships).values({ orgId: otherOrg!.id, userId, role: 'owner' }),
      ) // and 'owner' in otherOrg (org B)

      const guard = guardRequiring(['admin'])
      const tokenScopedToOrgA: AccessClaims = { sub: userId, orgId, role: 'viewer' }

      await expect(guard.canActivate(contextWithAuth(tokenScopedToOrgA))).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    },
  )
})
