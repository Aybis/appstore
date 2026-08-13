import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import type { GlobalSetupContext } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connects as app_runtime — RLS applies. What suites use. */
    postgresUrl: string
    /** Connects as the schema owner — RLS does NOT apply. Migrations and seeding only. */
    postgresOwnerUrl: string
  }
}

const DEFAULT_APP_URL = 'postgres://app_runtime:devpassword@localhost:5433/appstore_test'
const DEFAULT_OWNER_URL = 'postgres://localhost:5433/appstore_test'

export async function setup({ provide }: GlobalSetupContext): Promise<void> {
  const appUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_APP_URL
  const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL ?? DEFAULT_OWNER_URL

  const sql = postgres(ownerUrl, { max: 1, prepare: false })
  try {
    await sql`select 1`
  } catch (cause) {
    throw new Error(
      `Cannot reach the test database at ${ownerUrl}. ` +
        'Run ./infra/local/setup.sh, and check that PostgreSQL 17 is running ' +
        '(brew services start postgresql@17).',
      { cause },
    )
  }

  // Migrate once per run rather than per suite: vitest.config.ts pins
  // singleFork, so suites share this database and concurrent migrations
  // would deadlock on the migrations table.
  await migrate(drizzle(sql), { migrationsFolder: `${__dirname}/../../drizzle` })
  await sql.end()

  provide('postgresUrl', appUrl)
  provide('postgresOwnerUrl', ownerUrl)
}

export async function teardown(): Promise<void> {
  // Nothing to tear down: the database is long-lived and owned by the developer,
  // not by the test run. Suites clean up after themselves via truncateAll().
}
