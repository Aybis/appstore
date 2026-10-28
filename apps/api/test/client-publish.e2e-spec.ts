import { sql } from 'drizzle-orm'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenant } from '../src/db/tenant'
import { createTestApp, type TestApp } from './support/app'

const owner = {
  orgSlug: 'client-co',
  orgName: 'Client Co',
  email: 'owner@client.test',
  password: 'a-sufficiently-long-password',
  displayName: 'Owner',
}
const employee = {
  orgSlug: owner.orgSlug,
  email: 'ana@client.test',
  password: 'another-long-password-here',
  displayName: 'Ana',
}

const orgIdFromToken = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).orgId as string

describe('publishing a release as the MAYA client', () => {
  let ctx: TestApp
  let ownerToken: string
  let viewerToken: string
  let orgId: string

  const http = () => request(ctx.app.getHttpServer())
  const publish = (token: string | null, body: object) => {
    const call = http().post('/v1/client/publish')
    return (token ? call.set('Authorization', `Bearer ${token}`) : call).send(body)
  }

  /** A release plus artifact whose file is deliberately not in the blob store. */
  const seedRelease = (platform: 'android' | 'ios', status: string): Promise<string> =>
    withTenant(ctx.db, orgId, async (tx) => {
      const app = await tx.execute<{ id: string }>(sql`
        INSERT INTO apps (org_id, slug, name, platform)
        VALUES (${orgId}::uuid, ${`${platform}-${status}`}, 'x', ${platform}) RETURNING id`)
      const release = await tx.execute<{ id: string }>(sql`
        INSERT INTO releases (org_id, app_id, platform, version, min_os, status, published_at, track)
        VALUES (${orgId}::uuid, ${[...app][0]!.id}::uuid, ${platform}, '1.0.0', 'API 24',
                ${status}, now(), 'production') RETURNING id`)
      const id = [...release][0]!.id
      await tx.execute(sql`
        INSERT INTO artifacts (org_id, release_id, package_id, storage_key, sha256,
                               size_bytes, content_type, original_filename)
        VALUES (${orgId}::uuid, ${id}::uuid, 'com.test.client', 'does/not/exist.apk', 'a', 10,
                'application/vnd.android.package-archive', 'a.apk')`)
      return id
    })

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  beforeEach(async () => {
    await ctx.reset()
    const signup = await http().post('/v1/auth/signup').send(owner).expect(201)
    ownerToken = signup.body.accessToken as string
    orgId = orgIdFromToken(ownerToken)
    await http().post('/v1/auth/register').send(employee).expect(201)
    viewerToken = (await http().post('/v1/auth/login').send(employee).expect(200)).body.accessToken as string
  })

  it('needs a signed-in admin or owner', async () => {
    const id = await seedRelease('android', 'published')
    await publish(null, { releaseId: id }).expect(401)
    await publish(viewerToken, { releaseId: id }).expect(403)
  })

  it('rejects a release id that is not a uuid', async () => {
    await publish(ownerToken, { releaseId: 'not-a-uuid' }).expect(400)
    await publish(ownerToken, {}).expect(400)
  })

  it('404s for a release that does not exist', async () => {
    await publish(ownerToken, { releaseId: '00000000-0000-4000-8000-000000000000' }).expect(404)
  })

  it('refuses an iOS build and an unpublished one, before touching any file', async () => {
    const ios = await seedRelease('ios', 'published')
    const draft = await seedRelease('android', 'draft')
    await publish(ownerToken, { releaseId: ios }).expect(400)
    await publish(ownerToken, { releaseId: draft }).expect(400)
  })

  it('reports a missing file instead of publishing something else', async () => {
    const id = await seedRelease('android', 'published')
    await publish(ownerToken, { releaseId: id }).expect(404)
    // Nothing reached the public portal.
    const portal = await http().get('/v1/client').expect(200)
    expect(portal.body.builds).toEqual([])
  })
})
