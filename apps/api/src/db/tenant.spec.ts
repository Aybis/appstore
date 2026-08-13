import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { apps } from './apps.schema'
import { memberships, organizations, users } from './schema'
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

  it('deletes only the scoped organization row, leaving another tenant untouched', async () => {
    const deleted = await withTenant(ctx.db, acmeId, (tx) => tx.delete(apps).returning())
    expect(deleted).toHaveLength(1)
    expect(deleted[0]?.slug).toBe('payroll')

    // Globex's row survives an unfiltered DELETE scoped to Acme: FORCE RLS's
    // WITH CHECK / USING clause confines the delete to org_id = acmeId even
    // though the query itself has no WHERE clause at all.
    const globexRows = await withTenant(ctx.db, globexId, (tx) => tx.select().from(apps))
    expect(globexRows.map((row) => row.slug)).toEqual(['logistics'])
  })

  it('refuses a cross-org membership insert (42501), covering the other RLS-protected table', async () => {
    const [user] = await ctx.db
      .insert(users)
      .values({ email: 'lee@acme.test', passwordHash: 'x', displayName: 'Lee' })
      .returning()

    await expect(
      withTenant(ctx.db, acmeId, (tx) =>
        tx.insert(memberships).values({ orgId: globexId, userId: user!.id, role: 'owner' }),
      ),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/row-level security/i), code: '42501' } })
  })

  /**
   * C1 — SET LOCAL ROLE app_runtime (tenant.ts) has no other test that can fail
   * if it is removed: every other test in this file runs `ctx.db`, which is
   * ALREADY app_runtime, so dropping role there is a self-set no-op locally and
   * the suite structurally cannot notice its absence on this topology.
   *
   * `ctx.ownerDb` connects as a rolbypassrls=true role — the same shape as
   * Supabase's `postgres`, which is what the app authenticates as there. On
   * that topology the SET LOCAL ROLE line is the ONLY control standing between
   * a request and every tenant's data: the FORCE RLS policy does not even
   * apply to a bypassrls role. Running withTenant against ctx.ownerDb is the
   * only way this suite can exercise that line at all.
   */
  it('isolates even on a BYPASSRLS connection — SET LOCAL ROLE is the only control on Supabase', async () => {
    const rows = await withTenant(ctx.ownerDb, acmeId, (tx) => tx.select().from(apps))
    expect(rows.map((row) => row.slug)).toEqual(['payroll'])
  })

  /**
   * I2 — `TenantTx` is structurally assignable to `Database` (both expose
   * select/insert/update/delete/execute/transaction), so `withTenant(tx,
   * otherOrg, fn)` compiles with no friction from inside an already-scoped
   * callback. Left unguarded this silently repoints the OUTER transaction at
   * a different tenant: drizzle-orm turns the nested `db.transaction()` into
   * a SAVEPOINT, and a LOCAL setting made inside a savepoint persists past
   * RELEASE SAVEPOINT into the enclosing transaction. withTenant() must fail
   * loudly instead.
   */
  it('rejects a nested withTenant call scoped to a different organization', async () => {
    await expect(
      withTenant(ctx.db, acmeId, (outerTx) =>
        withTenant(outerTx, globexId, (innerTx) => innerTx.select().from(apps)),
      ),
    ).rejects.toThrow(/already scoped to org/i)
  })

  it('allows a nested withTenant call scoped to the SAME organization', async () => {
    // Legitimate composition — e.g. a service calling another service's
    // withTenant from within a handler that already opened one for the same
    // request — must keep working.
    const rows = await withTenant(ctx.db, acmeId, (outerTx) =>
      withTenant(outerTx, acmeId, (innerTx) => innerTx.select().from(apps)),
    )
    expect(rows.map((row) => row.slug)).toEqual(['payroll'])
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
