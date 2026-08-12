import { sql } from 'drizzle-orm'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PostgresJsDatabase, PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import type { Database } from './client'
import type * as schema from './schema'

// `Database` (PostgresJsDatabase<typeof schema>) defaults its relational-config
// generic to `ExtractTablesWithRelations<typeof schema>` — not `Record<string,
// never>` — because schema.ts declares tables even though it declares no
// `relations()`. TenantTx must match that generic exactly, or the cast below
// from the base `PgTransaction` (what `db.transaction`'s callback is statically
// typed as) down to the `PostgresJsTransaction` subclass (what it actually is at
// runtime) fails as an insufficient-overlap type error rather than a narrowing one.
export type TenantTx = PostgresJsTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The single sanctioned path to tenant data.
 *
 * Opens a transaction, drops to the non-privileged `app_runtime` role, and binds
 * `app.current_org_id` for the transaction's lifetime. Both settings are LOCAL,
 * so they unwind on commit or rollback and cannot leak to the next borrower of
 * this pooled connection.
 *
 * `set_config` is used rather than `SET LOCAL` because only the former accepts a
 * bind parameter — interpolating the org id into a SET statement would be an
 * injection site.
 */
export async function withTenant<T>(
  db: Database,
  orgId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(orgId)) {
    throw new Error(`withTenant requires a UUID org id, received: ${orgId}`)
  }

  return db.transaction(async (tx) => {
    // Nesting guard. `TenantTx` is structurally assignable to `Database` (both
    // expose select/insert/update/delete/execute/transaction), so nothing stops
    // a caller from passing an already-scoped transaction back into withTenant —
    // e.g. a service that calls withTenant, invoked from a handler that opened
    // one already. drizzle-orm turns this nested db.transaction() into a
    // SAVEPOINT, and a LOCAL setting made inside a savepoint PERSISTS past
    // RELEASE SAVEPOINT into the enclosing transaction. Left unchecked, an
    // inner withTenant(tx, otherOrg, ...) would silently repoint the outer
    // transaction at a different tenant for the rest of its life. Reading the
    // GUC here — before this call's own SET LOCAL — sees exactly the enclosing
    // transaction's value if nested, or '' / NULL at true top level (a LOCAL
    // setting fully unwinds at the outer COMMIT, so a reused pooled connection
    // can never leak a stale org id in here). Same-tenant nesting is legitimate
    // composition and stays allowed; only a different tenant is a bug worth
    // failing loudly for.
    const [current] = await tx.execute<{ org_id: string | null }>(
      sql`SELECT current_setting('app.current_org_id', true) AS org_id`,
    )
    const enclosingOrgId = current?.org_id
    if (enclosingOrgId && enclosingOrgId !== orgId) {
      throw new Error(
        `withTenant() called for org ${orgId} while already scoped to org ${enclosingOrgId} in an ` +
          'enclosing transaction. Nested withTenant calls must use the same tenant as the transaction ' +
          'they are nested in.',
      )
    }

    await tx.execute(sql`SET LOCAL ROLE app_runtime`)
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`)
    return fn(tx as TenantTx)
  })
}

export type { PostgresJsDatabase }
