import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

export function createDb(url: string): { db: Database; close: () => Promise<void> } {
  // max: 10 here and in tests alike. Pool size does not need to be 1 for
  // SET LOCAL / set_config(..., true) to be safe: both are scoped LOCAL to the
  // transaction that sets them and unwind at COMMIT/ROLLBACK, so a connection
  // handed back to the pool never carries a stale role or org id to its next
  // borrower. That reuse is exactly what the NULLIF in the RLS policy (see
  // 0002_rls.sql) and the "still denies rather than errors" regression test in
  // tenant.spec.ts are guarding: the LOCAL value unwinds to '' on a reused
  // backend, not NULL, and the policy has to treat both as "no tenant".
  const sql = postgres(url, { max: 10, prepare: false })
  return { db: drizzle(sql, { schema }), close: async () => { await sql.end() } }
}

export { schema }
