import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app'

const signup = {
  orgSlug: 'throttle-co',
  orgName: 'Throttle Co',
  email: 'owner@throttle.test',
  password: 'a-sufficiently-long-password',
  displayName: 'Owner',
}

/**
 * Security review S-3. The measured behaviour before this existed was eight
 * consecutive failed logins returning 401 eight times and never a 429.
 *
 * These run against the real guard and the real in-memory store, so the
 * counters are shared across the suite — each test therefore uses its own
 * email, which is also what makes the "one account cannot exhaust another's
 * budget" assertion meaningful rather than accidental.
 */
describe('auth throttling', () => {
  let ctx: TestApp

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  beforeEach(async () => {
    await ctx.reset()
    await request(ctx.app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
  })

  const server = () => ctx.app.getHttpServer()

  const attempt = (email: string, password = 'definitely-not-the-password') =>
    request(server())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email, password })

  it('refuses further attempts once the burst limit is spent', async () => {
    const email = 'burst@throttle.test'
    const codes: number[] = []

    for (let i = 0; i < 8; i += 1) {
      codes.push((await attempt(email)).status)
    }

    // The first few are honest rejections; the rest are refused outright.
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(codes.slice(5)).toEqual([429, 429, 429])
  })

  /**
   * The property that makes the account half of the key safe.
   *
   * Keying only on the account would let an attacker lock a real user out by
   * hammering their address — a denial of service delivered through the
   * defence. Both accounts here share an IP, so this also proves the IP budget
   * is not so tight that one user's mistakes refuse another's login.
   */
  it('does not let one account exhaust another account budget', async () => {
    const victim = 'victim@throttle.test'
    const other = 'other@throttle.test'

    for (let i = 0; i < 6; i += 1) await attempt(victim)
    expect((await attempt(victim)).status).toBe(429)

    // A different account is still served.
    expect((await attempt(other)).status).toBe(401)
  })

  it('says nothing about which limit was hit', async () => {
    const email = 'quiet@throttle.test'
    for (let i = 0; i < 6; i += 1) await attempt(email)

    const refused = await attempt(email).expect(429)
    const body = JSON.stringify(refused.body)

    expect(body).not.toMatch(/burst|sustained|remaining|limit/i)
    expect(refused.body.message).toMatch(/too many attempts/i)
  })

  /**
   * The flaw the first version of this guard had.
   *
   * It keyed on `ip|account` combined, so varying the email produced a fresh
   * key and a fresh budget — one address could create unlimited organizations.
   * Every signup below uses a DIFFERENT org and email precisely so the account
   * budget cannot be what refuses them; only the independent IP budget can.
   */
  it('limits bulk signups from one address even when every account differs', async () => {
    const codes: number[] = []
    for (let i = 0; i < 24; i += 1) {
      const response = await request(server())
        .post('/v1/auth/signup')
        .send({ ...signup, orgSlug: `probe-${i}`, email: `probe-${i}@throttle.test` })
      codes.push(response.status)
    }

    expect(codes).toContain(429)
    // ...and the IP budget is loose enough that a handful of real signups from
    // one office still go through before it bites.
    expect(codes.filter((code) => code === 201).length).toBeGreaterThanOrEqual(5)
  })
})
