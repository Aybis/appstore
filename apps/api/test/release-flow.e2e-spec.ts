import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenant } from '../src/db/tenant'
import { createTestApp, type TestApp } from './support/app'
import { buildApk } from './support/package'

const signup = {
  orgSlug: 'release-co',
  orgName: 'Release Co',
  email: 'lead@release.test',
  password: 'a-sufficiently-long-password',
  displayName: 'Lead',
}

const orgIdFromToken = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).orgId as string

/** Distinct bytes per version — see the (org_id, sha256) note in the suite below. */
const apkFor = (version: string): Buffer => buildApk(version)

/**
 * The release process this models, in the organization's own words:
 *
 *   dev uploads a new version -> nobody is told a new app exists
 *     -> QA installs it and smoke-tests it
 *       -> it is released to production
 *         -> distributed apps see it, and a major bump cannot be dismissed
 *
 * Each step is asserted from the outside, through HTTP, because the guarantee
 * that matters is what a member and a distributed app can actually observe.
 */
describe('release flow: internal -> beta -> production', () => {
  let ctx: TestApp
  let staffToken: string
  let orgId: string
  let storeDir: string

  beforeAll(async () => {
    storeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maya-release-'))
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
    staffToken = response.body.accessToken as string
    orgId = orgIdFromToken(staffToken)
  })

  const server = () => ctx.app.getHttpServer()
  const staff = () => ({ Authorization: `Bearer ${staffToken}` })

  const createApp = () =>
    request(server())
      .post('/v1/apps')
      .set(staff())
      .send({ slug: 'calculator', name: 'Calculator', platform: 'android' })
      .expect(201)

  const upload = (version: string, track: string) =>
    request(server())
      .post('/v1/apps/calculator/releases')
      .set(staff())
      .field('version', version)
      .field('platform', 'android')
      .field('packageId', 'com.internal.calculator')
      .field('publish', 'true')
      .field('track', track)
      .attach('file', apkFor(version), `calculator-${version}.apk`)

  /** A second member with no special role — the ordinary employee. */
  const addMember = async (email: string): Promise<string> => {
    const created = await request(server())
      .post('/v1/auth/signup')
      .send({
        ...signup,
        orgSlug: `home-${email.split('@')[0]}`,
        email,
        orgName: 'Home',
      })
      .expect(201)
    const userId = JSON.parse(
      Buffer.from((created.body.accessToken as string).split('.')[1] ?? '', 'base64url').toString(),
    ).sub as string

    await withTenant(ctx.db, orgId, async (tx) => {
      await tx.execute(sql`
        INSERT INTO memberships (org_id, user_id, role)
        VALUES (${orgId}::uuid, ${userId}::uuid, 'viewer')
      `)
    })

    const login = await request(server())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email, password: signup.password })
      .expect(200)
    return login.body.accessToken as string
  }

  const catalogFor = async (token: string): Promise<string[]> => {
    const response = await request(server())
      .get('/v1/apps')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200)
    return (response.body as { slug: string }[]).map((app) => app.slug)
  }

  it('hides an internal build from ordinary members but not from staff', async () => {
    await createApp()
    await upload('1.0.0', 'internal').expect(201)

    const memberToken = await addMember('viewer@release.test')

    expect(await catalogFor(memberToken)).toEqual([])
    expect(await catalogFor(staffToken)).toEqual(['calculator'])
  })

  it('does not announce an internal build to distributed apps', async () => {
    await createApp()
    await upload('1.0.0', 'production').expect(201)
    await upload('1.1.0', 'internal').expect(201)

    // The Calculator app itself asks. It must still be told 1.0.0 is current:
    // 1.1.0 exists but has not been released.
    const check = await request(server())
      .get('/v1/version-check?org=release-co&packageId=com.internal.calculator&platform=android&version=1.0.0')
      .expect(200)

    expect(check.body).toMatchObject({ latestVersion: '1.0.0', updateAvailable: false })
  })

  it('shows a beta build to an enrolled tester and to nobody else', async () => {
    await createApp()
    await upload('1.1.0', 'beta').expect(201)

    const testerToken = await addMember('tester@release.test')
    const bystanderToken = await addMember('bystander@release.test')

    expect(await catalogFor(testerToken)).toEqual([])

    await request(server())
      .post('/v1/apps/calculator/testers')
      .set(staff())
      .send({ email: 'tester@release.test' })
      .expect(201)

    expect(await catalogFor(testerToken)).toEqual(['calculator'])
    expect(await catalogFor(bystanderToken)).toEqual([])
  })

  it('keeps a promoted build visible to the testers who tested it', async () => {
    await createApp()
    const release = await upload('1.1.0', 'beta').expect(201)

    const testerToken = await addMember('tester@release.test')
    await request(server())
      .post('/v1/apps/calculator/testers')
      .set(staff())
      .send({ email: 'tester@release.test' })
      .expect(201)

    await request(server())
      .post(`/v1/apps/calculator/releases/${release.body.id}/promote`)
      .set(staff())
      .send({ track: 'production' })
      .expect(201)

    // A tester enrolled at 'beta' must still see production, or promoting would
    // make the build vanish for exactly the people who validated it.
    expect(await catalogFor(testerToken)).toEqual(['calculator'])
  })

  it('releases to everyone only once promoted to production', async () => {
    await createApp()
    const release = await upload('1.1.0', 'internal').expect(201)
    const memberToken = await addMember('viewer@release.test')

    expect(await catalogFor(memberToken)).toEqual([])

    await request(server())
      .post(`/v1/apps/calculator/releases/${release.body.id}/promote`)
      .set(staff())
      .send({ track: 'production' })
      .expect(201)

    expect(await catalogFor(memberToken)).toEqual(['calculator'])
  })

  it('forces the update when the released version is a major bump', async () => {
    await createApp()
    await upload('1.0.0', 'production').expect(201)
    const next = await upload('1.1.0', 'internal').expect(201)

    const url =
      '/v1/version-check?org=release-co&packageId=com.internal.calculator&platform=android&version=1.0.0'

    const before = await request(server()).get(url).expect(200)
    expect(before.body).toMatchObject({ updateAvailable: false })

    await request(server())
      .post(`/v1/apps/calculator/releases/${next.body.id}/promote`)
      .set(staff())
      .send({ track: 'production' })
      .expect(201)

    const after = await request(server()).get(url).expect(200)
    expect(after.body).toMatchObject({
      latestVersion: '1.1.0',
      updateAvailable: true,
      severity: 'major',
      updateRequired: true,
    })
  })

  it('leaves a patch release dismissible', async () => {
    await createApp()
    await upload('1.0.0', 'production').expect(201)
    await upload('1.0.1', 'production').expect(201)

    const check = await request(server())
      .get('/v1/version-check?org=release-co&packageId=com.internal.calculator&platform=android&version=1.0.0')
      .expect(200)

    expect(check.body).toMatchObject({
      latestVersion: '1.0.1',
      severity: 'minor',
      updateRequired: false,
    })
  })

  // Regression for the (org_id, sha256) unique constraint that used to swallow
  // the artifact of any release whose bytes matched an earlier one.
  it('publishes a release whose binary is identical to an earlier one', async () => {
    await createApp()
    const identical = buildApk('identical')

    const first = await request(server())
      .post('/v1/apps/calculator/releases')
      .set(staff())
      .field('version', '1.0.0')
      .field('platform', 'android')
      .field('packageId', 'com.internal.calculator')
      .field('publish', 'true')
      .field('track', 'production')
      .attach('file', identical, 'calculator-1.0.0.apk')
      .expect(201)

    const retagged = await request(server())
      .post('/v1/apps/calculator/releases')
      .set(staff())
      .field('version', '1.0.1')
      .field('platform', 'android')
      .field('packageId', 'com.internal.calculator')
      .field('publish', 'true')
      .field('track', 'production')
      .attach('file', identical, 'calculator-1.0.1.apk')
      .expect(201)

    expect(retagged.body.sha256).toBe(first.body.sha256)

    // The re-tagged build must be the one the catalog serves, and it must have
    // a downloadable artifact rather than silently having none.
    const ticket = await request(server())
      .get('/v1/apps/calculator/download')
      .set(staff())
      .expect(200)
    expect(ticket.body.version).toBe('1.0.1')
  })

  it('refuses to demote a released build', async () => {
    await createApp()
    const release = await upload('1.0.0', 'production').expect(201)

    await request(server())
      .post(`/v1/apps/calculator/releases/${release.body.id}/promote`)
      .set(staff())
      .send({ track: 'internal' })
      .expect(409)
  })

  it('refuses to enrol somebody who is not a member', async () => {
    await createApp()
    await request(server())
      .post('/v1/apps/calculator/testers')
      .set(staff())
      .send({ email: 'stranger@elsewhere.test' })
      .expect(404)
  })

  it('denies tester management to a viewer', async () => {
    await createApp()
    const memberToken = await addMember('viewer@release.test')

    await request(server())
      .get('/v1/apps/calculator/testers')
      .set({ Authorization: `Bearer ${memberToken}` })
      .expect(403)
  })
})
