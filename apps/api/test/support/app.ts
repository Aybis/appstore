import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, inject } from 'vitest'
import { AppModule } from '../../src/app.module'
import { createDb, type Database } from '../../src/db/client'
import { DATABASE } from '../../src/db/database.provider'
import { truncateAll, type TestDb } from './db'

export interface TestApp {
  app: INestApplication
  db: Database
  reset: () => Promise<void>
}

let cached: TestApp | undefined

export async function createTestApp(): Promise<TestApp> {
  if (cached) return cached

  const url = inject('postgresUrl')
  const ownerUrl = inject('postgresOwnerUrl')
  process.env.DATABASE_URL = url
  process.env.JWT_SECRET = 'a'.repeat(32)
  process.env.S3_ENDPOINT ??= 'http://localhost:9000'
  process.env.S3_BUCKET ??= 'artifacts'
  process.env.S3_ACCESS_KEY_ID ??= 'minioadmin'
  process.env.S3_SECRET_ACCESS_KEY ??= 'minioadmin'

  // Migrations already ran once in global setup (test/support/postgres.global.ts).
  // Do NOT migrate again here: vitest.config.ts pins singleFork so every suite
  // shares this database, and re-running migrate() would be redundant at best.
  // It would also outright fail here — this `db` connects as app_runtime (see
  // below), which only has SELECT/INSERT/UPDATE/DELETE on `public` (granted in
  // 0002_rls.sql), not the DDL/schema privileges migrate() needs.
  const { db, close } = createDb(url)

  // truncateAll expects the TestDb shape (db + ownerDb), not a bare Database —
  // it truncates via the schema owner because app_runtime has no TRUNCATE
  // grant. Build that handle here rather than passing `db` alone.
  const { db: ownerDb, close: closeOwner } = createDb(ownerUrl)
  const testDb: TestDb = { db, ownerDb, url }

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE)
    .useValue(db)
    .compile()

  const app = moduleRef.createNestApplication()
  // MUST mirror main.ts. Every end-to-end test in this plan requests `/v1/...`,
  // and Nest applies no prefix unless asked — without this line the whole suite
  // 404s from Task 6 onward, in a way that looks like a routing bug in the
  // controllers rather than a missing line in the harness.
  app.setGlobalPrefix('v1', { exclude: ['health'] })
  await app.init()

  cached = { app, db, reset: () => truncateAll(testDb) }
  afterAll(async () => {
    await app.close()
    // app.close() only tears down Nest's lifecycle — it doesn't know about
    // these two postgres-js pools, since DATABASE was overridden with an
    // already-constructed `db` value rather than left to DatabaseModule's own
    // factory. Close them explicitly or their connections (and the owner
    // pool, never handed to Nest at all) outlive this test file.
    await close()
    await closeOwner()
    cached = undefined
  })
  return cached
}
