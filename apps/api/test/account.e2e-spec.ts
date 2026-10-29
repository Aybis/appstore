import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app'

const signup = {
  orgSlug: 'account-co',
  orgName: 'Account Co',
  email: 'owner@account.test',
  password: 'a-sufficiently-long-password-1',
  displayName: 'Owner',
}

/** The smallest valid PNG: the 8-byte signature is what the store checks. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('rest of a picture'),
])

describe('your own account (/v1/me)', () => {
  let ctx: TestApp
  let storeDir: string
  let tokens: { accessToken: string; refreshToken: string }

  beforeAll(async () => {
    storeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maya-account-'))
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
    tokens = response.body
  })

  const http = () => request(ctx.app.getHttpServer())
  const auth = () => ({ Authorization: `Bearer ${tokens.accessToken}` })

  it('returns the signed-in profile, and nothing without a session', async () => {
    const me = await http().get('/v1/me').set(auth()).expect(200)
    expect(me.body).toMatchObject({ email: signup.email, displayName: 'Owner', avatarUrl: '', role: 'owner' })
    expect(me.body).not.toHaveProperty('passwordHash')

    await http().get('/v1/me').expect(401)
  })

  it('renames, and refuses an empty name', async () => {
    const renamed = await http().patch('/v1/me').set(auth()).send({ displayName: '  Ana Owner ' }).expect(200)
    expect(renamed.body.displayName).toBe('Ana Owner')

    await http().patch('/v1/me').set(auth()).send({ displayName: '   ' }).expect(400)
  })

  it('stores an avatar once, serves it publicly, and removes it', async () => {
    const set = await http().post('/v1/me/avatar').set(auth()).attach('avatar', PNG, 'me.png').expect(201)
    expect(set.body.avatarUrl).toMatch(/^\/v1\/avatars\/[0-9a-f]{64}\.png$/)

    // Public: an <img> cannot send a token.
    const image = await http().get(set.body.avatarUrl).expect(200)
    expect(image.headers['content-type']).toBe('image/png')
    expect(await fs.readdir(path.join(storeDir, 'avatars'))).toHaveLength(1)

    const removed = await http().delete('/v1/me/avatar').set(auth()).expect(200)
    expect(removed.body.avatarUrl).toBe('')
  })

  it('refuses something that is not an image', async () => {
    await http().post('/v1/me/avatar').set(auth()).attach('avatar', Buffer.from('not a picture'), 'me.png').expect(400)
  })

  it('changes the password only with the current one, and signs every session out', async () => {
    await http()
      .post('/v1/me/password')
      .set(auth())
      .send({ currentPassword: 'wrong-password-1', newPassword: 'a-brand-new-password-2' })
      .expect(401)

    await http()
      .post('/v1/me/password')
      .set(auth())
      .send({ currentPassword: signup.password, newPassword: 'a-brand-new-password-2' })
      .expect(204)

    // The refresh token from before the change is dead...
    await http().post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401)
    // ...the old password no longer works, the new one does.
    const login = (password: string) =>
      http().post('/v1/auth/login').send({ orgSlug: signup.orgSlug, email: signup.email, password })
    await login(signup.password).expect(401)
    await login('a-brand-new-password-2').expect(200)
  })

  it('refuses a weak or unchanged new password', async () => {
    const change = (newPassword: string) =>
      http().post('/v1/me/password').set(auth()).send({ currentPassword: signup.password, newPassword })
    await change('short1').expect(400)
    await change(signup.password).expect(400)
  })
})
