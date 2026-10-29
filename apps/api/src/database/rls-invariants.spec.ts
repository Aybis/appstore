import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDb } from '../../test/support/db'

interface RlsInvariantRow extends Record<string, unknown> {
  table_name: string
  relrowsecurity: boolean
  relforcerowsecurity: boolean
  has_policy: boolean
}

/**
 * I1 — a table can carry `org_id`, hold tenant data, and STILL leak, if RLS is
 * merely ENABLEd rather than FORCEd, or if no policy was ever attached. Neither
 * of those mistakes breaks a single query, an insert, or a type — they only
 * show up as a silent, catalog-level gap. `tenant.spec.ts` proves the two
 * tables it knows about (apps, memberships) are locked down; this file proves
 * the INVARIANT instead: every table with an `org_id` column, whichever they
 * are, must have row security enabled, forced, and at least one policy.
 *
 * Deliberately catalog-driven rather than a fixed table list, so a later task
 * that adds `releases`, `artifacts`, or `audit_events` with an `org_id` column
 * is covered automatically — nobody has to remember to extend this test.
 *
 * Queries pg_class/pg_policies via ownerDb: those are catalog views, not
 * tenant data, so bypassing RLS to read them is correct and is not the thing
 * under test here — the columns being asserted on (relrowsecurity,
 * relforcerowsecurity, has_policy) are.
 */
describe('RLS catalog invariants', () => {
  const ctx = useTestDb()

  it('every table with an org_id column has RLS enabled, forced, and policed', async () => {
    const rows = await ctx.ownerDb.execute<RlsInvariantRow>(sql`
      SELECT
        col.table_name,
        c.relrowsecurity,
        c.relforcerowsecurity,
        EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = col.table_name
        ) AS has_policy
      FROM information_schema.columns col
      JOIN pg_class c
        ON c.relname = col.table_name AND c.relnamespace = 'public'::regnamespace
      WHERE col.table_schema = 'public' AND col.column_name = 'org_id'
      ORDER BY col.table_name
    `)

    // Guards the guard: if this ever comes back empty, the query stopped
    // matching anything (e.g. a column rename) and every assertion below
    // would vacuously pass while proving nothing.
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map((row) => row.table_name)).toEqual(expect.arrayContaining(['apps', 'memberships']))

    for (const row of rows) {
      expect(row, `${row.table_name} must ENABLE ROW LEVEL SECURITY`).toMatchObject({ relrowsecurity: true })
      expect(row, `${row.table_name} must FORCE ROW LEVEL SECURITY`).toMatchObject({
        relforcerowsecurity: true,
      })
      expect(row, `${row.table_name} must have at least one RLS policy`).toMatchObject({ has_policy: true })
    }
  })
})
