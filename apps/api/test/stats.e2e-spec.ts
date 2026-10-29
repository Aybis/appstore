import { sql } from 'drizzle-orm'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenant } from '../src/database/tenant'
import { createTestApp, type TestApp } from './support/app'

/** orgId is not in the signup response body; it is a claim on the access token. */
const orgIdFromToken = (token: string): string => {
  const payload = token.split('.')[1] ?? ''
  return JSON.parse(Buffer.from(payload, 'base64url').toString()).orgId as string
}

describe('public stats', () => {
  let ctx: TestApp

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  beforeEach(async () => {
    await ctx.reset()
  })

  const signUpWithApp = async (slug: string, status: 'published' | 'draft') => {
    const response = await request(ctx.app.getHttpServer())
      .post('/v1/auth/signup')
      .send({
        orgSlug: slug,
        orgName: slug,
        email: `owner@${slug}.test`,
        password: 'a-sufficiently-long-password-1',
        displayName: 'Owner',
      })
      .expect(201)
    const orgId = orgIdFromToken(response.body.accessToken as string)

    await withTenant(ctx.db, orgId, async (tx) => {
      const app = await tx.execute<{ id: string }>(sql`
        INSERT INTO apps (org_id, slug, name, category, platform, publisher)
        VALUES (${orgId}::uuid, 'scanner', 'Scanner', 'Tools', 'android', 'Team')
        RETURNING id
      `)
      await tx.execute(sql`
        INSERT INTO releases (org_id, app_id, platform, version, min_os, status, published_at, track)
        VALUES (${orgId}::uuid, ${[...app][0]!.id}::uuid, 'android', '1.0.0', 'API 28',
                ${status}, ${status === 'published' ? sql`now()` : sql`NULL`}, 'production')
      `)
    })
  }

  it('is public and sums every organization, through RLS rather than around it', async () => {
    await signUpWithApp('stats-one', 'published')
    await signUpWithApp('stats-two', 'published')
    await signUpWithApp('stats-three', 'draft')

    const response = await request(ctx.app.getHttpServer()).get('/v1/stats').expect(200)

    // An unscoped count of `apps` as app_runtime would see zero; seeing two
    // proves each org was counted under its own tenant, and the draft proves
    // only published releases count.
    expect(response.body).toEqual({ users: 3, apps: 2, releases: 2, installs: 0, devices: 0 })
  })
})
