import { ConflictException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { PasswordService } from '../auth/password.service'
import { memberships, organizations, users } from '../db/schema'
import { withTenant } from '../db/tenant'
import { SignupService } from './signup.service'

describe('SignupService', () => {
  const ctx = useTestDb()
  let service: SignupService

  const input = {
    orgSlug: 'acme-corp',
    orgName: 'Acme Corp',
    email: 'lee@acme.test',
    password: 'correct horse battery staple',
    displayName: 'Lee',
  }

  beforeEach(async () => {
    await truncateAll(ctx)
    service = new SignupService(ctx.db, new PasswordService())
  })

  it('creates the organization, the user, and an owner membership', async () => {
    const result = await service.signUp(input)

    const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, result.orgId))
    const [user] = await ctx.db.select().from(users).where(eq(users.id, result.userId))
    // memberships carries FORCE RLS, so reading it — even the row this test
    // just created — requires the same sanctioned withTenant path production
    // code must use. An unscoped select here would see zero rows, not because
    // the insert failed, but because that is exactly what "deny by default"
    // means (see tenant.spec.ts).
    const found = await withTenant(ctx.db, result.orgId, (tx) =>
      tx.select().from(memberships).where(eq(memberships.orgId, result.orgId)),
    )

    expect(org?.slug).toBe('acme-corp')
    expect(user?.email).toBe('lee@acme.test')
    expect(found[0]?.role).toBe('owner')
  })

  it('never stores the password in plaintext', async () => {
    const result = await service.signUp(input)
    const [user] = await ctx.db.select().from(users).where(eq(users.id, result.userId))
    expect(user?.passwordHash).not.toContain('correct horse')
    expect(user?.passwordHash.startsWith('$argon2id$')).toBe(true)
  })

  it('normalizes the email to lowercase', async () => {
    const result = await service.signUp({ ...input, email: 'Lee@ACME.test' })
    const [user] = await ctx.db.select().from(users).where(eq(users.id, result.userId))
    expect(user?.email).toBe('lee@acme.test')
  })

  it('rejects a duplicate organization slug', async () => {
    await service.signUp(input)
    await expect(service.signUp({ ...input, email: 'other@acme.test' })).rejects.toBeInstanceOf(ConflictException)
  })

  it('leaves no orphaned organization when the user insert fails', async () => {
    await service.signUp(input)
    await expect(service.signUp({ ...input, orgSlug: 'globex-inc' })).rejects.toBeInstanceOf(ConflictException)

    const orgs = await ctx.db.select().from(organizations)
    expect(orgs.map((org) => org.slug)).toEqual(['acme-corp'])
  })

  it('rolls back the organization, the user, and the membership when a failure occurs after the membership savepoint releases', async () => {
    // The test above forces its failure at the SECOND insert (duplicate
    // email), which happens BEFORE the membership insert's withTenant
    // savepoint is ever entered — that exercises a plain transaction
    // rollback, not the savepoint path the membership insert introduces.
    // This test forces the failure AFTER that savepoint has released
    // (RELEASE SAVEPOINT has already run), which is exactly the point where
    // a swallowed error would leave a committed org with no owner
    // membership behind — unrecoverable through the API. SignupService has
    // no other seam for this: nothing runs after the membership insert in
    // production, so there is no real failure condition to exercise here.
    // `afterMembershipInsert` is a narrow, test-only, no-op-in-production
    // hook added specifically to reach this point (see signup.service.ts).
    class FailAfterMembershipInsert extends SignupService {
      protected override async afterMembershipInsert(): Promise<void> {
        throw new Error('deliberate failure after membership savepoint release')
      }
    }

    const failingService = new FailAfterMembershipInsert(ctx.db, new PasswordService())

    await expect(failingService.signUp(input)).rejects.toThrow(
      'deliberate failure after membership savepoint release',
    )

    const orgs = await ctx.db.select().from(organizations)
    const allUsers = await ctx.db.select().from(users)
    // memberships carries FORCE RLS: an unscoped app_runtime select would
    // return zero rows regardless of whether one actually exists, so it
    // cannot prove absence on its own. Read via the owner connection
    // (bypasses RLS, sees the whole table) for a real assertion — the same
    // way this was checked by hand during review, via psql on the owner
    // connection.
    const allMemberships = await ctx.ownerDb.select().from(memberships)

    expect(orgs).toHaveLength(0)
    expect(allUsers).toHaveLength(0)
    expect(allMemberships).toHaveLength(0)
  })
})
