import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { apps } from './apps.schema'
import { organizations } from './schema'
import { withTenant } from './tenant'

describe('withTenant', () => {
  const ctx = useTestDb()
  let acmeId: string
  let globexId: string

  beforeEach(async () => {
    await truncateAll(ctx)
    const [acme] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    const [globex] = await ctx.db.insert(organizations).values({ slug: 'globex-inc', name: 'Globex' }).returning()
    acmeId = acme!.id
    globexId = globex!.id

    await withTenant(ctx.db, acmeId, (tx) =>
      tx.insert(apps).values({ orgId: acmeId, slug: 'payroll', name: 'Payroll', platform: 'android' }),
    )
    await withTenant(ctx.db, globexId, (tx) =>
      tx.insert(apps).values({ orgId: globexId, slug: 'logistics', name: 'Logistics', platform: 'ios' }),
    )
  })

  it('returns only the rows belonging to the scoped organization', async () => {
    const rows = await withTenant(ctx.db, acmeId, (tx) => tx.select().from(apps))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.slug).toBe('payroll')
  })

  it('hides another organization rows even from an unfiltered select', async () => {
    const rows = await withTenant(ctx.db, globexId, (tx) => tx.select().from(apps))
    expect(rows.map((row) => row.slug)).toEqual(['logistics'])
  })

  it('refuses to insert a row belonging to a different organization', async () => {
    // drizzle-orm's postgres-js driver wraps the underlying PostgresError in a
    // DrizzleQueryError whose own .message is "Failed query: ..."; the RLS
    // error text lives on the wrapped cause instead (see schema.spec.ts).
    // Matching on the cause message — rather than a generic query-failure
    // message — is what proves this rejection is an RLS denial and not, say,
    // a foreign-key violation.
    await expect(
      withTenant(ctx.db, acmeId, (tx) =>
        tx.insert(apps).values({ orgId: globexId, slug: 'smuggled', name: 'Smuggled', platform: 'android' }),
      ),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/row-level security/i) } })
  })

  it('cannot update a row owned by another organization', async () => {
    const updated = await withTenant(ctx.db, acmeId, (tx) =>
      tx.update(apps).set({ name: 'Hijacked' }).returning(),
    )
    expect(updated).toHaveLength(1)
    expect(updated[0]?.slug).toBe('payroll')
  })

  it('sees no rows at all when no tenant context is set', async () => {
    const rows = await ctx.db.transaction(async (tx) => {
      // Drop privilege WITHOUT setting a tenant, proving the policy defaults to deny.
      await tx.execute(sql`SET LOCAL ROLE app_runtime`)
      return tx.select().from(apps)
    })
    expect(rows).toHaveLength(0)
  })

  /**
   * REGRESSION GUARD — do not delete, and do not "simplify" the NULLIF out of
   * the policy that makes it pass.
   *
   * After withTenant commits, the LOCAL GUC unwinds to '' (empty string), NOT
   * NULL. A policy predicate of `current_setting(...)::uuid` therefore raises
   * 22P02 on the next unscoped query instead of denying it. Because connections
   * are pooled, a reused backend is the ordinary case, not an edge case.
   *
   * This test runs an unscoped query AFTER a scoped one on the same pool, which
   * is precisely the sequence that fails without NULLIF.
   */
  it('still denies rather than errors after a previous transaction set the context', async () => {
    await withTenant(ctx.db, acmeId, (tx) => tx.select().from(apps))

    const leaked = await ctx.db.execute(
      sql`SELECT coalesce(current_setting('app.current_org_id', true), 'NULL') AS value`,
    )
    expect(leaked[0]?.value).toBe('')

    const rows = await ctx.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE app_runtime`)
      return tx.select().from(apps)
    })
    expect(rows).toHaveLength(0)
  })

  it('rolls back the whole transaction when the callback throws', async () => {
    await expect(
      withTenant(ctx.db, acmeId, async (tx) => {
        await tx.insert(apps).values({ orgId: acmeId, slug: 'temp', name: 'Temp', platform: 'android' })
        throw new Error('deliberate failure')
      }),
    ).rejects.toThrow('deliberate failure')

    const rows = await withTenant(ctx.db, acmeId, (tx) => tx.select().from(apps))
    expect(rows).toHaveLength(1)
  })
})
