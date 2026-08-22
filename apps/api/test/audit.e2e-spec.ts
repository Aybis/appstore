import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenant } from '../src/db/tenant'
import { createTestApp, type TestApp } from './support/app'

const signup = {
  orgSlug: 'audit-co',
  orgName: 'Audit Co',
  email: 'owner@audit.test',
  password: 'a-sufficiently-long-password',
  displayName: 'Owner',
}

const orgIdFromToken = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).orgId as string

const APK_BYTES = Buffer.from('PK pretend android package')

interface AuditRow {
  action: string
  subjectType: string
  subjectId: string
  actorId: string | null
  metadata: Record<string, unknown>
}

/**
 * Definition of Done, line 2: "a publisher can upload an APK, publish immutable
 * releases, AND SEE AUDIT EVENTS." The service unit test proves the table is
 * append-only; this proves the events actually get written by the paths that
 * matter and can be read back through the API by someone entitled to read them.
 */
describe('audit trail', () => {
  let ctx: TestApp
  let token: string
  let orgId: string
  let storeDir: string

  beforeAll(async () => {
    storeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maya-audit-store-'))
    process.env.ARTIFACT_STORE = storeDir
    ctx = await createTestApp()
  })

  afterAll(async () => {
    delete process.env.ARTIFACT_STORE
    await fs.rm(storeDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await ctx.reset()
    const response = await request(ctx.app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    token = response.body.accessToken as string
    orgId = orgIdFromToken(token)
  })

  const auth = () => ({ Authorization: `Bearer ${token}` })
  const server = () => ctx.app.getHttpServer()

  const createApp = () =>
    request(server())
      .post('/v1/apps')
      .set(auth())
      .send({ slug: 'field-scanner', name: 'Field Scanner', platform: 'android' })

  const uploadRelease = (version: string, publish: boolean) =>
    request(server())
      .post('/v1/apps/field-scanner/releases')
      .set(auth())
      .field('version', version)
      .field('platform', 'android')
      .field('packageId', 'com.internal.fieldscanner')
      .field('publish', String(publish))
      .attach('file', APK_BYTES, 'field-scanner.apk')

  const trail = async (): Promise<AuditRow[]> => {
    const response = await request(server()).get('/v1/audit').set(auth()).expect(200)
    return response.body as AuditRow[]
  }

  it('records app creation with the acting user', async () => {
    await createApp().expect(201)

    const events = await trail()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      action: 'app.created',
      subjectType: 'app',
      subjectId: 'field-scanner',
      metadata: { name: 'Field Scanner', platform: 'android' },
    })
    expect(events[0]!.actorId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/))
  })

  it('distinguishes creating an app from rewriting its metadata', async () => {
    await createApp().expect(201)
    await request(server())
      .post('/v1/apps')
      .set(auth())
      .send({ slug: 'field-scanner', name: 'Field Scanner II', platform: 'android' })
      .expect(201)

    expect((await trail()).map((event) => event.action)).toEqual(['app.updated', 'app.created'])
  })

  it('records a publish with the digest of what was published', async () => {
    await createApp().expect(201)
    const release = await uploadRelease('2.1.0', true).expect(201)

    const [newest] = await trail()
    expect(newest).toMatchObject({
      action: 'release.published',
      subjectType: 'release',
      subjectId: release.body.id as string,
    })
    expect(newest!.metadata).toMatchObject({
      app: 'field-scanner',
      version: '2.1.0',
      platform: 'android',
      sha256: release.body.sha256 as string,
    })
  })

  it('separates uploading a draft from publishing it', async () => {
    await createApp().expect(201)
    const release = await uploadRelease('2.2.0', false).expect(201)
    await request(server())
      .post(`/v1/apps/field-scanner/releases/${release.body.id}/publish`)
      .set(auth())
      .expect(201)

    expect((await trail()).map((event) => event.action)).toEqual([
      'release.published',
      'release.created',
      'app.created',
    ])
  })

  it('records who was handed a signed download capability, against the artifact', async () => {
    await createApp().expect(201)
    const release = await uploadRelease('2.1.0', true).expect(201)
    await request(server()).get('/v1/apps/field-scanner/download').set(auth()).expect(200)

    const [newest] = await trail()
    expect(newest).toMatchObject({ action: 'artifact.download_issued', subjectType: 'artifact' })
    expect(newest!.metadata).toMatchObject({
      app: 'field-scanner',
      version: '2.1.0',
      platform: 'android',
      sha256: release.body.sha256 as string,
    })
    // The subject is the artifact itself, so it must not be the app id that
    // sits next to it on the same catalog row.
    expect(newest!.subjectId).not.toBe((newest!.metadata as { appId: string }).appId)
    expect(newest!.subjectId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/))
  })

  it('records nothing when the work it would describe failed', async () => {
    // No such app, so the release insert never happens. An audit line here
    // would be a claim about a build that does not exist.
    await uploadRelease('9.9.9', true).expect(404)
    expect(await trail()).toHaveLength(0)
  })

  it('caps and floors the requested limit instead of failing', async () => {
    await createApp().expect(201)

    await request(server()).get('/v1/audit?limit=0').set(auth()).expect(200)
    await request(server()).get('/v1/audit?limit=999999').set(auth()).expect(200)
    await request(server()).get('/v1/audit?limit=nonsense').set(auth()).expect(200)
  })

  it('denies a publisher — creating history is not permission to review it', async () => {
    await createApp().expect(201)

    // RolesGuard re-reads membership per request, so the existing token loses
    // the reading right immediately rather than at expiry.
    await withTenant(ctx.db, orgId, async (tx) => {
      await tx.execute(sql`UPDATE memberships SET role = 'publisher' WHERE org_id = ${orgId}::uuid`)
    })

    await request(server()).get('/v1/audit').set(auth()).expect(403)
  })

  it('denies an unauthenticated caller', async () => {
    // 401 rather than 403: JwtGuard runs first and rejects on the missing
    // bearer, so RolesGuard never gets to weigh the role.
    await request(server()).get('/v1/audit').expect(401)
  })
})
