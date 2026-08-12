import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

export function createDb(url: string): { db: Database; close: () => Promise<void> } {
  // max: 1 during tests keeps SET LOCAL ROLE deterministic; production tunes this
  // via the pool size, but every tenant-scoped statement runs inside its own
  // transaction so connection reuse is safe.
  const sql = postgres(url, { max: 10, prepare: false })
  return { db: drizzle(sql, { schema }), close: async () => { await sql.end() } }
}

export { schema }
