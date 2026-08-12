import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module'

describe('GET /health', () => {
  let app: INestApplication

  beforeAll(async () => {
    // AppModule now wires DatabaseModule (Task 5), whose DATABASE provider
    // reads the full env schema via loadEnv(process.env) at boot — even
    // though /health never touches the database. These values only need to
    // satisfy zod's format checks: postgres.js connects lazily, so no live
    // Postgres/S3 endpoint is required for the app to compile and answer
    // /health. Set only what's missing so a developer's real .env (if
    // present) is not overridden.
    process.env.DATABASE_URL ??= 'postgres://app_runtime:devpassword@localhost:5433/appstore_test'
    process.env.JWT_SECRET ??= 'test-only-secret-at-least-32-characters-long'
    process.env.S3_ENDPOINT ??= 'http://localhost:9000'
    process.env.S3_BUCKET ??= 'test-artifacts'
    process.env.S3_ACCESS_KEY_ID ??= 'test'
    process.env.S3_SECRET_ACCESS_KEY ??= 'test'

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 200 with a status body', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200)
    expect(response.body).toMatchObject({ status: 'ok' })
  })
})
