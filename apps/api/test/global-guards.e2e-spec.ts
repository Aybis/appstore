import { Controller, Get, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { AppModule } from '../src/app.module'
import { createDb, type Database } from '../src/db/client'
import { DATABASE } from '../src/db/database.provider'
import { truncateAll, type TestDb } from './support/db'

/**
 * Zero decorators — no `@Public()`, no `@Roles()`, nothing. Exists only to
 * prove round 1's M4 fix: `JwtGuard`/`RolesGuard` are now registered
 * globally via `APP_GUARD` (see auth.module.ts), so a controller that
 * forgets to opt in is denied by default instead of silently public — the
 * exact failure mode M4 closes. Never added to the real `AppModule`;
 * registered only into this file's own isolated testing module below, where
 * it still inherits the SAME globally-registered guards the real app uses,
 * since those are wired at the `AuthModule` level via `APP_GUARD`.
 */
@Controller('probe')
class BareProbeController {
  @Get()
  ping(): { ok: true } {
    return { ok: true }
  }
}

const signup = {
  orgSlug: 'probe-org',
  orgName: 'Probe Org',
  email: 'probe@example.test',
  password: 'correct horse battery staple',
  displayName: 'Probe',
}

describe('global guards secure a bare, undecorated route by default (round 1, M4)', () => {
  let app: INestApplication
  let closeApp: () => Promise<void>
  let closeOwner: () => Promise<void>
  let testDb: TestDb

  beforeAll(async () => {
    const url = inject('postgresUrl')
    const ownerUrl = inject('postgresOwnerUrl')
    process.env.DATABASE_URL = url
    process.env.JWT_SECRET = 'a'.repeat(32)
    process.env.S3_ENDPOINT ??= 'http://localhost:9000'
    process.env.S3_BUCKET ??= 'artifacts'
    process.env.S3_ACCESS_KEY_ID ??= 'minioadmin'
    process.env.S3_SECRET_ACCESS_KEY ??= 'minioadmin'

    const appPool = createDb(url)
    const ownerPool = createDb(ownerUrl)
    closeApp = appPool.close
    closeOwner = ownerPool.close
    testDb = { db: appPool.db as Database, ownerDb: ownerPool.db as Database, url }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [BareProbeController],
    })
      .overrideProvider(DATABASE)
      .useValue(appPool.db)
      .compile()

    app = moduleRef.createNestApplication()
    // Mirrors main.ts / test/support/app.ts: every request in this suite
    // goes through /v1/..., health excepted.
    app.setGlobalPrefix('v1', { exclude: ['health'] })
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    await closeApp()
    await closeOwner()
  })

  beforeEach(async () => {
    await truncateAll(testDb)
  })

  it('denies an unauthenticated request to a route with no decorators at all', async () => {
    const response = await request(app.getHttpServer()).get('/v1/probe')
    expect(response.status).toBe(401)
  })

  it('allows the same route once authenticated — proving the guards work, not just block everything', async () => {
    const signedUp = await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)

    await request(app.getHttpServer())
      .get('/v1/probe')
      .set('Authorization', `Bearer ${signedUp.body.accessToken}`)
      .expect(200, { ok: true })
  })

  it('still denies with a well-formed but bogus bearer token', async () => {
    const response = await request(app.getHttpServer()).get('/v1/probe').set('Authorization', 'Bearer not-a-real-jwt')
    expect(response.status).toBe(401)
  })
})
