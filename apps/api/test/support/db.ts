import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, inject } from 'vitest'
import { createDb, type Database } from '../../src/db/client'

export interface TestDb {
  /** Connects as app_runtime. RLS applies. Use this for anything under test. */
  get db(): Database
  /** Connects as the schema owner. RLS does NOT apply. Setup and teardown only. */
  get ownerDb(): Database
  get url(): string
}

/**
 * Opens connections to the shared test database. Migration already happened once
 * in global setup — do NOT migrate here: vitest.config.ts pins singleFork, so
 * every suite shares this database and concurrent migrations would deadlock on
 * the migrations table.
 *
 * Two handles, and the difference matters. `db` connects as app_runtime, which
 * has no BYPASSRLS, so tests exercise the same privilege boundary production
 * does. `ownerDb` bypasses RLS and exists only to seed and truncate — using it
 * for an assertion would silently test nothing.
 */
export function useTestDb(): TestDb {
  let db: Database
  let ownerDb: Database
  let close: () => Promise<void>
  let closeOwner: () => Promise<void>
  let url: string

  beforeAll(() => {
    url = inject('postgresUrl')
    const app = createDb(url)
    const owner = createDb(inject('postgresOwnerUrl'))
    db = app.db
    ownerDb = owner.db
    close = app.close
    closeOwner = owner.close
  })

  afterAll(async () => {
    await close?.()
    await closeOwner?.()
  })

  return {
    get db() { return db },
    get ownerDb() { return ownerDb },
    get url() { return url },
  }
}

/**
 * Removes all tenant data between tests. Runs as the OWNER, deliberately: the
 * runtime role is blocked by RLS from deleting rows it cannot see, so a
 * truncate issued as app_runtime would leave other tenants' rows behind and
 * leak state into the next test.
 */
export async function truncateAll(ctx: TestDb): Promise<void> {
  await ctx.ownerDb.execute(sql`TRUNCATE organizations, users RESTART IDENTITY CASCADE`)
}
