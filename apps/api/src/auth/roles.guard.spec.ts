import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import type { Database } from '../db/database.provider'
import { memberships, organizations, users } from '../db/schema'
import { withTenant } from '../db/tenant'
import { RolesGuard } from './roles.guard'
import type { AccessClaims, MembershipRole } from './token.service'

/**
 * The brief's Step 1 sample builds a `RolesGuard` that reads `role` straight
 * off the (unverified-for-currency) token claims — cheap, but a demoted or
 * removed member keeps their old authority for up to the 30-day refresh TTL.
 * Per the design decision this task must resolve, `RolesGuard` instead
 * re-reads the `memberships` row per request through `withTenant`, so it
 * needs a live `Database` handle, not just a mocked `Reflector`. The handful
 * of cases that never depend on DB state (no authenticated claims at all)
 * stay as fast pure-unit tests below; every case that depends on current
 * membership state moved to the integration suite beneath it, against the
 * real harness.
 */

function fakeReflector(required: MembershipRole[] | undefined): Reflector {
  return { getAllAndOverride: () => required } as unknown as Reflector
}

function contextWithAuth(auth: AccessClaims | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext
}

describe('RolesGuard (unit — no database access required)', () => {
  it('denies an unauthenticated request without ever touching the database', async () => {
    const poisonedDb = {
      transaction: () => {
        throw new Error('RolesGuard queried the database before checking for auth claims')
      },
    } as unknown as Database
    const guard = new RolesGuard(fakeReflector(['viewer']), poisonedDb)

    await expect(guard.canActivate(contextWithAuth(undefined))).rejects.toBeInstanceOf(ForbiddenException)
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
})
