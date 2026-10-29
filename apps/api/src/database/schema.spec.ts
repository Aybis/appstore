import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { memberships, organizations, users } from './schema'

describe('core schema', () => {
  const ctx = useTestDb()

  beforeEach(async () => {
    await truncateAll(ctx)
  })

  it('stores an organization with a generated id', async () => {
    const [org] = await ctx.db
      .insert(organizations)
      .values({ slug: 'acme-corp', name: 'Acme Corp' })
      .returning()
    expect(org?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('rejects a duplicate organization slug', async () => {
    await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' })
    // drizzle-orm's postgres-js driver wraps the underlying PostgresError in a
    // DrizzleQueryError whose own .message is "Failed query: ..."; the constraint
    // name is on the wrapped cause instead.
    await expect(
      ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme Two' }),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/organizations_slug_key/) } })
  })

  // memberships carries RLS as of the tenant-isolation migration (0002_rls.sql).
  // These tests exercise raw schema constraints, not the tenant boundary —
  // that boundary has its own exhaustive coverage in tenant.spec.ts — so they
  // read and write memberships through ownerDb, which bypasses RLS by design.
  it('links a user to an organization through a membership', async () => {
    const [org] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    const [user] = await ctx.db
      .insert(users)
      .values({ email: 'lee@acme.test', passwordHash: 'x', displayName: 'Lee' })
      .returning()

    await ctx.ownerDb.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: 'owner' })

    const found = await ctx.ownerDb.select().from(memberships).where(eq(memberships.userId, user!.id))
    expect(found).toHaveLength(1)
    expect(found[0]?.role).toBe('owner')
  })

  it('allows one user to hold different roles in two organizations', async () => {
    const [first] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    const [second] = await ctx.db.insert(organizations).values({ slug: 'globex-inc', name: 'Globex' }).returning()
    const [user] = await ctx.db
      .insert(users)
      .values({ email: 'lee@acme.test', passwordHash: 'x', displayName: 'Lee' })
      .returning()

    await ctx.ownerDb.insert(memberships).values([
      { orgId: first!.id, userId: user!.id, role: 'owner' },
      { orgId: second!.id, userId: user!.id, role: 'viewer' },
    ])

    const found = await ctx.ownerDb.select().from(memberships).where(eq(memberships.userId, user!.id))
    expect(found).toHaveLength(2)
  })

  it('rejects a second membership for the same user in the same organization', async () => {
    const [org] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    const [user] = await ctx.db
      .insert(users)
      .values({ email: 'lee@acme.test', passwordHash: 'x', displayName: 'Lee' })
      .returning()

    await ctx.ownerDb.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: 'owner' })
    // See the note above: the constraint name lives on the wrapped cause, not
    // on DrizzleQueryError's own message.
    await expect(
      ctx.ownerDb.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: 'viewer' }),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/memberships_org_user_key/) } })
  })
})
