import { sql } from 'drizzle-orm'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenant } from '../src/db/tenant'
import { createTestApp, type TestApp } from './support/app'

const signup = {
  orgSlug: 'catalog-co',
  orgName: 'Catalog Co',
  email: 'publisher@catalog.test',
  password: 'a-sufficiently-long-password',
  displayName: 'Publisher',
}

/** orgId is not in the signup response body; it is a claim on the access token. */
const orgIdFromToken = (token: string): string => {
  const payload = token.split('.')[1] ?? ''
  return JSON.parse(Buffer.from(payload, 'base64url').toString()).orgId as string
}

describe('catalog API', () => {
  let ctx: TestApp
  let token: string
  let orgId: string

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  beforeEach(async () => {
    await ctx.reset()

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/auth/signup')
      .send(signup)
      .expect(201)

    token = response.body.accessToken as string
    orgId = orgIdFromToken(token)

    // No publish endpoint yet (that is the rest of Plan 02), so the fixture is
    // written straight through withTenant — the same path the service uses.
    await withTenant(ctx.db, orgId, async (tx) => {
      const app = await tx.execute<{ id: string }>(sql`
        INSERT INTO apps (org_id, slug, name, category, platform, tagline, publisher, featured)
        VALUES (${orgId}::uuid, 'field-scanner', 'Field Scanner', 'Tools', 'android',
                'Barcode scanning', 'Platform Team', true)
        RETURNING id
      `)
      const appId = [...app][0]!.id

      const release = await tx.execute<{ id: string }>(sql`
        INSERT INTO releases (org_id, app_id, platform, version, min_os, status, published_at)
        VALUES (${orgId}::uuid, ${appId}::uuid, 'android', '2.1.0', 'API 28', 'published', now())
        RETURNING id
      `)
      const releaseId = [...release][0]!.id

      await tx.execute(sql`
        INSERT INTO artifacts (org_id, release_id, package_id, storage_key, sha256,
                               size_bytes, content_type, original_filename)
        VALUES (${orgId}::uuid, ${releaseId}::uuid, 'com.internal.fieldscanner',
                'k/ey', 'a'::text, 1234, 'application/vnd.android.package-archive',
                'field-scanner.apk')
      `)
    })
  })

  it('denies the catalog without a bearer token', async () => {
    await request(ctx.app.getHttpServer()).get('/v1/apps').expect(401)
  })

  it('returns the org catalog joined to its current release', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get('/v1/apps')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body).toHaveLength(1)
    expect(response.body[0]).toMatchObject({
      slug: 'field-scanner',
      name: 'Field Scanner',
      category: 'Tools',
      platform: 'android',
      version: '2.1.0',
      minOs: 'API 28',
      size: 1234,
      featured: true,
      accessStatus: 'available',
    })
  })

  it('filters to featured and matches on search', async () => {
    const server = ctx.app.getHttpServer()
    const auth = { Authorization: `Bearer ${token}` }

    await request(server).get('/v1/apps?featured=true').set(auth).expect(200).expect((r) => {
      expect(r.body).toHaveLength(1)
    })
    await request(server).get('/v1/apps/search?q=barcode').set(auth).expect(200).expect((r) => {
      expect(r.body).toHaveLength(1)
    })
    await request(server).get('/v1/apps/search?q=nothing-matches').set(auth).expect(200).expect((r) => {
      expect(r.body).toHaveLength(0)
    })
  })

  it('404s an unknown slug rather than leaking an empty 200', async () => {
    await request(ctx.app.getHttpServer())
      .get('/v1/apps/not-a-real-app')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  it('issues a download ticket carrying the checksum and a signed URL', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get('/v1/apps/field-scanner/download')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body).toMatchObject({ version: '2.1.0', platform: 'android', sizeBytes: 1234 })
    expect(response.body.url).toContain('/download/')
    expect(response.body.url).toMatch(/[?&]sig=[0-9a-f]{64}/)
    // Android streams directly; only iOS carries instructions.
    expect(response.body.instructions).toBeUndefined()
  })

  it('refuses an unsigned or tampered stream URL', async () => {
    const ticket = await request(ctx.app.getHttpServer())
      .get('/v1/apps/field-scanner/download')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const url: string = ticket.body.url
    const path = url.slice(url.indexOf('/download/'))

    await request(ctx.app.getHttpServer()).get(path.split('?')[0]!).expect(403)
    await request(ctx.app.getHttpServer())
      .get(path.replace(/sig=[0-9a-f]+/, `sig=${'0'.repeat(64)}`))
      .expect(403)
  })

  describe('version-check (public, for distributed apps)', () => {
    const base = '/v1/version-check?org=catalog-co&packageId=com.internal.fieldscanner&platform=android'

    it('answers without any bearer token — the calling app has no user session', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`${base}&version=2.0.0`)
        .expect(200)

      expect(response.body).toMatchObject({
        latestVersion: '2.1.0',
        updateAvailable: true,
        updateRequired: false,
        storeUrl: 'maya://app/field-scanner',
      })
    })

    it('reports no update once current', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`${base}&version=2.1.0`)
        .expect(200)
      expect(response.body.updateAvailable).toBe(false)
    })

    it('forces the update only below the minimum_version floor', async () => {
      await withTenant(ctx.db, orgId, async (tx) => {
        await tx.execute(
          sql`UPDATE apps SET minimum_version = '2.1.0' WHERE slug = 'field-scanner'`,
        )
      })

      const below = await request(ctx.app.getHttpServer())
        .get(`${base}&version=2.0.9`)
        .expect(200)
      expect(below.body.updateRequired).toBe(true)

      // At the floor is allowed — the floor is the oldest build still permitted.
      const atFloor = await request(ctx.app.getHttpServer())
        .get(`${base}&version=2.1.0`)
        .expect(200)
      expect(atFloor.body.updateRequired).toBe(false)
    })

    it('never leaks a binary URL', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`${base}&version=1.0.0`)
        .expect(200)
      expect(JSON.stringify(response.body)).not.toContain('/download/')
    })

    it('400s on a missing parameter and 404s on an unknown package', async () => {
      await request(ctx.app.getHttpServer())
        .get('/v1/version-check?org=catalog-co&platform=android&version=1.0.0')
        .expect(400)
      await request(ctx.app.getHttpServer())
        .get('/v1/version-check?org=catalog-co&packageId=com.nope&platform=android&version=1.0.0')
        .expect(404)
    })
  })
})
