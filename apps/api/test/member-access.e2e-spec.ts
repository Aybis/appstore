import { sql } from 'drizzle-orm'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenant } from '../src/db/tenant'
import { createTestApp, type TestApp } from './support/app'

const owner = {
  orgSlug: 'access-co',
  orgName: 'Access Co',
  email: 'owner@access.test',
  password: 'a-sufficiently-long-password',
  displayName: 'Owner',
}
const employee = {
  orgSlug: owner.orgSlug,
  email: 'ana@access.test',
  password: 'another-long-password-here',
  displayName: 'Ana',
}

const orgIdFromToken = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).orgId as string

describe('registration, deactivation and app access', () => {
  let ctx: TestApp
  let ownerToken: string
  let orgId: string
  let employeeId: string

  const http = () => request(ctx.app.getHttpServer())

  const login = (body: { orgSlug: string; email: string; password: string }) =>
    http().post('/v1/auth/login').send(body)

  const catalogSlugs = async (token: string): Promise<string[]> => {
    const response = await http().get('/v1/apps').set('Authorization', `Bearer ${token}`).expect(200)
    const list = (response.body.apps ?? response.body) as { slug: string }[]
    return list.map((entry) => entry.slug).sort()
  }

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  beforeEach(async () => {
    await ctx.reset()
    const signup = await http().post('/v1/auth/signup').send(owner).expect(201)
    ownerToken = signup.body.accessToken as string
    orgId = orgIdFromToken(ownerToken)

    await withTenant(ctx.db, orgId, async (tx) => {
      for (const slug of ['alpha', 'beta']) {
        const app = await tx.execute<{ id: string }>(sql`
          INSERT INTO apps (org_id, slug, name, platform)
          VALUES (${orgId}::uuid, ${slug}, ${slug}, 'android') RETURNING id`)
        const release = await tx.execute<{ id: string }>(sql`
          INSERT INTO releases (org_id, app_id, platform, version, min_os, status, published_at, track)
          VALUES (${orgId}::uuid, ${[...app][0]!.id}::uuid, 'android', '1.0.0', 'API 28',
                  'published', now(), 'production') RETURNING id`)
        await tx.execute(sql`
          INSERT INTO artifacts (org_id, release_id, package_id, storage_key, sha256,
                                 size_bytes, content_type, original_filename)
          VALUES (${orgId}::uuid, ${[...release][0]!.id}::uuid, ${'com.test.' + slug},
                  ${'k/' + slug}, 'a', 10, 'application/vnd.android.package-archive', 'a.apk')`)
      }
    })
  })

  const register = async () => {
    await http().post('/v1/auth/register').send(employee).expect(201)
    const members = await http().get('/v1/members').set('Authorization', `Bearer ${ownerToken}`).expect(200)
    employeeId = (members.body as { userId: string; email: string }[]).find(
      (member) => member.email === employee.email,
    )!.userId
  }

  const asOwner = (method: 'patch' | 'put', path: string, body: object) =>
    http()[method](path).set('Authorization', `Bearer ${ownerToken}`).send(body)

  it('registers an employee who can sign in and sees no apps', async () => {
    const response = await http().post('/v1/auth/register').send(employee).expect(201)
    // No credential comes back from a public endpoint.
    expect(response.body).toEqual({ registered: true })

    const signedIn = await login(employee).expect(200)
    expect(signedIn.body.user.role).toBe('viewer')
    expect(await catalogSlugs(signedIn.body.accessToken as string)).toEqual([])
  })

  it('refuses a duplicate email and an unknown organization', async () => {
    await http().post('/v1/auth/register').send(employee).expect(201)
    await http().post('/v1/auth/register').send(employee).expect(409)
    await http().post('/v1/auth/register').send({ ...employee, orgSlug: 'no-such-org', email: 'x@y.test' }).expect(404)
  })

  it('shows only the apps an admin grants, and everything again on "all"', async () => {
    await register()
    const token = (await login(employee).expect(200)).body.accessToken as string

    await asOwner('put', `/v1/members/${employeeId}/apps`, { mode: 'selected', apps: ['beta'] }).expect(200)
    expect(await catalogSlugs(token)).toEqual(['beta'])

    await asOwner('put', `/v1/members/${employeeId}/apps`, { mode: 'all', apps: [] }).expect(200)
    expect(await catalogSlugs(token)).toEqual(['alpha', 'beta'])
  })

  it('never narrows the catalog for staff', async () => {
    expect(await catalogSlugs(ownerToken)).toEqual(['alpha', 'beta'])
  })

  it('locks out a deactivated account at once, and restores it on reactivation', async () => {
    await register()
    const token = (await login(employee).expect(200)).body.accessToken as string
    await asOwner('put', `/v1/members/${employeeId}/apps`, { mode: 'all', apps: [] }).expect(200)
    await http().get('/v1/apps').set('Authorization', `Bearer ${token}`).expect(200)

    await asOwner('patch', `/v1/members/${employeeId}/status`, { status: 'disabled' }).expect(200)

    // The access token is still unexpired; the guard refuses it anyway.
    await http().get('/v1/apps').set('Authorization', `Bearer ${token}`).expect(403)
    await login(employee).expect(403)

    await asOwner('patch', `/v1/members/${employeeId}/status`, { status: 'active' }).expect(200)
    await login(employee).expect(200)
  })

  it('does not reveal a deactivated account to someone without the password', async () => {
    await register()
    await asOwner('patch', `/v1/members/${employeeId}/status`, { status: 'disabled' }).expect(200)
    await login({ ...employee, password: 'definitely-the-wrong-one' }).expect(401)
  })

  it('keeps registration and admin routes apart: a viewer cannot deactivate anyone', async () => {
    await register()
    const token = (await login(employee).expect(200)).body.accessToken as string
    await http()
      .patch(`/v1/members/${employeeId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'disabled' })
      .expect(403)
  })
})
