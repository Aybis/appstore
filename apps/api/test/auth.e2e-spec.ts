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

  it('rejects a duplicate email on signup with an honest 409', async () => {
    // Round 1 tried hiding this behind a decoy 201 + token pair, reasoning
    // that a differing response would be an email-enumeration oracle.
    // Round 2 reverted that: the reviewer showed a two-request probe against
    // the (honestly disclosed) slug-collision behavior recovers the exact
    // same signal for free no matter what THIS response says — a fresh slug
    // probed twice, once with the target email and once with any other
    // email, tells you from the SECOND request's 201-vs-409 alone whether
    // the first one actually created an org. Hiding the direct response
    // bought no privacy, and the decoy cost something real: a structurally
    // valid `role: 'owner'` JWT obtainable by an unauthenticated caller who
    // knew nothing but one registered email. See task-6-report.md, round 2.
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)

    const duplicate = await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, orgSlug: 'brand-new-org', orgName: 'Brand New Org' })
      .expect(409)

    // No decoy token anywhere in the response.
    expect(duplicate.body.accessToken).toBeUndefined()
    expect(duplicate.body.refreshToken).toBeUndefined()

    // And, as ever, no org/user/membership was created for the rejected
    // request: the real account holder still can't log into "their"
    // would-be new org with their real password.
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: 'brand-new-org', email: signup.email, password: signup.password })
      .expect(401)
  })

  it('gives request 1 alone the same signal the round-1 decoy needed two requests to extract', async () => {
    // Direct encoding of the reviewer's proof, as a permanent regression
    // guard against reintroducing a decoy: under round 1, a duplicate-email
    // signup always returned 201, so learning whether it actually created
    // an org required a SECOND request against the same slug with a fresh
    // email — 201 meant the slug was still free (request 1 rolled back,
    // target was registered), 409 meant request 1 had claimed it (target
    // was not registered). With the honest 409 from round 2, request 1's
    // own status code already IS that signal, for both arms, so a second
    // request adds nothing beyond it.
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)

    // Registered-target arm.
    const registeredProbeSlug = 'probe-registered'
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, orgSlug: registeredProbeSlug, email: signup.email })
      .expect(409) // conclusive by itself: this email is registered
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, orgSlug: registeredProbeSlug, email: 'attacker@example.test' })
      .expect(201) // confirms request 1 never claimed the slug -- consistent, not new information

    // Unregistered-target arm.
    const freshProbeSlug = 'probe-unregistered'
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, orgSlug: freshProbeSlug, email: 'nobody-at-all@acme.test' })
      .expect(201) // conclusive by itself, the other way: this email was not registered
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, orgSlug: freshProbeSlug, email: 'attacker2@example.test' })
      .expect(409) // confirms request 1 did claim the slug -- again, consistent, not new
  })

  it('reports an organization-slug collision plainly, same as a duplicate email', async () => {
    // Slugs are a public namespace (a would-be customer needs to know the
    // name is taken) and were always disclosed honestly. As of round 2, a
    // duplicate email is reported the same honest way, for the structural
    // reason explained above — not because slugs and emails are equally
    // safe to leak in general, but because signup's own success/failure
    // side effect (the organizations row) already leaks the email case
    // regardless, so a differing response bought nothing.
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)

    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, email: 'someone-else@acme.test' })
      .expect(409)
  })
})
