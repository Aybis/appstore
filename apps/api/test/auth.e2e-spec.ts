import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app'

describe('auth', () => {
  let ctx: TestApp
  let app: INestApplication

  const signup = {
    orgSlug: 'acme-corp',
    orgName: 'Acme Corp',
    email: 'lee@acme.test',
    password: 'correct horse battery staple',
    displayName: 'Lee',
  }

  beforeEach(async () => {
    ctx = await createTestApp()
    app = ctx.app
    await ctx.reset()
  })

  it('signs up an organization and returns tokens', async () => {
    const response = await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    expect(response.body.accessToken).toBeTypeOf('string')
    expect(response.body.refreshToken).toBeTypeOf('string')
  })

  it('has retired the duplicate /orgs signup path (round 1, I3 — one route, one provider instance)', async () => {
    await request(app.getHttpServer()).post('/v1/orgs').send(signup).expect(404)
  })

  it('rejects a signup with a weak password before touching the database', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, password: 'short' })
      .expect(400)
  })

  it('logs in with the correct credentials', async () => {
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email: signup.email, password: signup.password })
      .expect(200)
    expect(response.body.accessToken).toBeTypeOf('string')
  })

  it('returns 401 for a wrong password', async () => {
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email: signup.email, password: 'wrong password entirely' })
      .expect(401)
  })

  it('refuses to log a user into an organization they do not belong to', async () => {
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, orgSlug: 'globex-inc', orgName: 'Globex', email: 'sam@globex.test' })
      .expect(201)

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: 'globex-inc', email: signup.email, password: signup.password })
      .expect(401)
  })

  it('returns byte-identical failure responses for every kind of invalid login', async () => {
    // Round 1, I1: comparing only one failure body against a fixed literal
    // string doesn't prove uniformity — it passes even if a different
    // failure path uses a different message, as long as THAT one happens to
    // still say "Invalid credentials". The reviewer proved this by splitting
    // LoginService's single throw into two distinct messages (one for "no
    // such user", one for "wrong password") and showing the old test suite
    // still went green. This test instead captures every failure body in
    // the set and asserts they are all equal to each other, so any path
    // that diverges — in either message or shape — fails the comparison.
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, orgSlug: 'globex-inc', orgName: 'Globex', email: 'sam@globex.test' })
      .expect(201)

    const wrongPassword = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email: signup.email, password: 'wrong password entirely' })
      .expect(401)

    const unknownEmail = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email: 'nobody@acme.test', password: signup.password })
      .expect(401)

    const nonMember = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: 'globex-inc', email: signup.email, password: signup.password })
      .expect(401)

    const unknownOrg = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: 'no-such-org', email: signup.email, password: signup.password })
      .expect(401)

    expect(wrongPassword.body).toEqual({ message: 'Invalid credentials', error: 'Unauthorized', statusCode: 401 })
    expect(unknownEmail.body).toEqual(wrongPassword.body)
    expect(nonMember.body).toEqual(wrongPassword.body)
    expect(unknownOrg.body).toEqual(wrongPassword.body)
  })

  it('does not leak whether an email is already registered on signup', async () => {
    // Round 1, I2: a fresh org slug + an already-registered email is an
    // account-enumeration oracle if the response differs from a real
    // success (the attacker controls the slug, so nothing else needs to
    // collide). Assert the response is shaped exactly like a real signup...
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)

    const duplicate = await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, orgSlug: 'brand-new-org', orgName: 'Brand New Org' })
      .expect(201)

    expect(duplicate.body.accessToken).toBeTypeOf('string')
    expect(duplicate.body.refreshToken).toBeTypeOf('string')
    expect(duplicate.body.expiresIn).toBeTypeOf('number')

    // ...and confirm the decoy response didn't actually grant access to
    // anything: no org, user, or membership was created for this request,
    // so the real account holder can't log into "their" new org with their
    // real password.
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: 'brand-new-org', email: signup.email, password: signup.password })
      .expect(401)
  })

  it('still reports an organization-slug collision plainly', async () => {
    // Slugs are a public namespace (a would-be customer needs to know the
    // name is taken), so — unlike a duplicate email — this one is fine to
    // disclose honestly.
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)

    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, email: 'someone-else@acme.test' })
      .expect(409)
  })
})
