import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenant } from '../src/db/tenant'
import { createTestApp, type TestApp } from './support/app'

const signup = {
  orgSlug: 'publish-co',
  orgName: 'Publish Co',
  email: 'owner@publish.test',
  password: 'a-sufficiently-long-password',
  displayName: 'Owner',
}

const orgIdFromToken = (token: string): string =>
  JSON.parse(
    Buffer.from(token.split('.')[1] ?? '', 'base64url').toString(),
  ).orgId as string

/** Flattens DrizzleQueryError -> PostgresError so assertions see the real message. */
const messageChain = (error: unknown): string => {
  const parts: string[] = []
  for (let cur = error; cur != null; cur = (cur as { cause?: unknown }).cause) {
    if (cur instanceof Error) parts.push(cur.message)
  }
  return parts.join(' | ')
}

/** Stand-in for an APK — the pipeline never parses it, only hashes and stores it. */
const APK_BYTES = Buffer.from('PK pretend android package')
const APK_SHA256 = createHash('sha256').update(APK_BYTES).digest('hex')

describe('publish API', () => {
  let ctx: TestApp
  let token: string
  let orgId: string
  let storeDir: string

  beforeAll(async () => {
    // Redirect the artifact store so the suite never writes into ./store.
    storeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maya-store-'))
    process.env.ARTIFACT_STORE = storeDir
    ctx = await createTestApp()
  })

  afterAll(async () => {
    delete process.env.ARTIFACT_STORE
    await fs.rm(storeDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await ctx.reset()
    const response = await request(ctx.app.getHttpServer())
      .post('/v1/auth/signup')
      .send(signup)
      .expect(201)

    token = response.body.accessToken as string
    orgId = orgIdFromToken(token)
  })

  const auth = () => ({ Authorization: `Bearer ${token}` })

  const createApp = () =>
    request(ctx.app.getHttpServer())
      .post('/v1/apps')
      .set(auth())
      .send({ slug: 'field-scanner', name: 'Field Scanner', platform: 'android' })

  it('creates an app', async () => {
    const response = await createApp().expect(201)
    expect(response.body).toMatchObject({ slug: 'field-scanner' })
  })

  it('accepts a build and computes the digest from the bytes, not the client', async () => {
    await createApp().expect(201)

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/apps/field-scanner/releases')
      .set(auth())
      .field('version', '2.1.0')
      .field('platform', 'android')
      .field('packageId', 'com.internal.fieldscanner')
      .field('publish', 'true')
      // A lie the server must ignore — it hashes what it received.
      .field('sha256', '0'.repeat(64))
      .attach('file', APK_BYTES, 'field-scanner.apk')
      .expect(201)

    expect(response.body).toMatchObject({
      version: '2.1.0',
      platform: 'android',
      status: 'published',
      sha256: APK_SHA256,
      sizeBytes: APK_BYTES.length,
    })

    // And the object actually landed in the store, keyed by that digest.
    const stored = path.join(storeDir, orgId, APK_SHA256.slice(0, 2), `${APK_SHA256}.apk`)
    await expect(fs.stat(stored)).resolves.toBeTruthy()
  })

  it('makes an uploaded build downloadable through the catalog', async () => {
    await createApp().expect(201)
    await request(ctx.app.getHttpServer())
      .post('/v1/apps/field-scanner/releases')
      .set(auth())
      .field('version', '2.1.0')
      .field('platform', 'android')
      .field('packageId', 'com.internal.fieldscanner')
      .field('publish', 'true')
      .attach('file', APK_BYTES, 'field-scanner.apk')
      .expect(201)

    const ticket = await request(ctx.app.getHttpServer())
      .get('/v1/apps/field-scanner/download?platform=android')
      .set(auth())
      .expect(200)

    expect(ticket.body.checksum).toBe(APK_SHA256)

    const streamPath = (ticket.body.url as string).slice(
      (ticket.body.url as string).indexOf('/download/'),
    )
    const download = await request(ctx.app.getHttpServer())
      .get(streamPath)
      .responseType('blob')   // otherwise supertest parses the stream to {}
      .expect(200)
    expect(Buffer.from(download.body as Buffer)).toEqual(APK_BYTES)
  })

  it('rejects a duplicate version — a shipped build must not be redefined', async () => {
    await createApp().expect(201)

    const upload = () =>
      request(ctx.app.getHttpServer())
        .post('/v1/apps/field-scanner/releases')
        .set(auth())
        .field('version', '2.1.0')
        .field('platform', 'android')
        .field('packageId', 'com.internal.fieldscanner')
        .attach('file', APK_BYTES, 'field-scanner.apk')

    await upload().expect(201)
    await upload().expect(409)
  })

  it('rejects anything that is not an .apk or .ipa', async () => {
    await createApp().expect(201)
    await request(ctx.app.getHttpServer())
      .post('/v1/apps/field-scanner/releases')
      .set(auth())
      .field('version', '2.1.0')
      .field('platform', 'android')
      .field('packageId', 'com.internal.fieldscanner')
      .attach('file', Buffer.from('nope'), 'notes.txt')
      .expect(400)
  })

  it('denies a viewer — reading the catalog is not permission to fill it', async () => {
    await createApp().expect(201)

    // Demote this member to viewer; RolesGuard re-reads membership per request,
    // so the existing token immediately loses publish rights.
    await withTenant(ctx.db, orgId, async (tx) => {
      await tx.execute(sql`UPDATE memberships SET role = 'viewer' WHERE org_id = ${orgId}::uuid`)
    })

    await request(ctx.app.getHttpServer())
      .post('/v1/apps')
      .set(auth())
      .send({ slug: 'sneaky', name: 'Sneaky', platform: 'android' })
      .expect(403)

    // ...but reading still works.
    await request(ctx.app.getHttpServer()).get('/v1/apps').set(auth()).expect(200)
  })

  it('freezes a published release at the database level', async () => {
    await createApp().expect(201)
    await request(ctx.app.getHttpServer())
      .post('/v1/apps/field-scanner/releases')
      .set(auth())
      .field('version', '2.1.0')
      .field('platform', 'android')
      .field('packageId', 'com.internal.fieldscanner')
      .field('publish', 'true')
      .attach('file', APK_BYTES, 'field-scanner.apk')
      .expect(201)

    // Not through a service method — straight at the table, which is the point:
    // the guarantee must not depend on going through the right code path.
    const failure = await withTenant(ctx.db, orgId, async (tx) => {
      await tx.execute(sql`UPDATE releases SET version = '9.9.9' WHERE version = '2.1.0'`)
    }).catch((error: unknown) => error)

    expect(messageChain(failure)).toMatch(/immutable/)
  })

  it('still allows withdrawing a published release', async () => {
    await createApp().expect(201)
    await request(ctx.app.getHttpServer())
      .post('/v1/apps/field-scanner/releases')
      .set(auth())
      .field('version', '2.1.0')
      .field('platform', 'android')
      .field('packageId', 'com.internal.fieldscanner')
      .field('publish', 'true')
      .attach('file', APK_BYTES, 'field-scanner.apk')
      .expect(201)

    // Unpublishing is a supported operation — it withdraws a build from the
    // catalog without pretending it was never distributed.
    await expect(
      withTenant(ctx.db, orgId, async (tx) => {
        await tx.execute(sql`UPDATE releases SET status = 'unpublished' WHERE version = '2.1.0'`)
      }),
    ).resolves.not.toThrow()
  })
})
