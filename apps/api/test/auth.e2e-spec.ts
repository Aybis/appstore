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

  it('returns the same 401 for an unknown email as for a wrong password', async () => {
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    const unknown = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email: 'nobody@acme.test', password: signup.password })
      .expect(401)
    expect(unknown.body.message).toBe('Invalid credentials')
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
})
