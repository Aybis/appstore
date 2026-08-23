import { sql } from 'drizzle-orm'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenant } from '../src/db/tenant'
import { createTestApp, type TestApp } from './support/app'

const signup = {
  orgSlug: 'session-co',
  orgName: 'Session Co',
  email: 'owner@session.test',
  password: 'a-sufficiently-long-password',
  displayName: 'Owner',
}

const orgIdFromToken = (token: string): string =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).orgId as string

/**
 * Security review S-1.
 *
 * The measured behaviour before this existed: delete a member's memberships row
 * and their access token was correctly refused with 403, but the same refresh
 * token still minted fresh pairs for the full 30-day TTL. Sign-out invalidated
 * nothing and a stolen token could never be cut off.
 */
describe('refresh sessions', () => {
  let ctx: TestApp
  let tokens: { accessToken: string; refreshToken: string }
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
    tokens = response.body
    orgId = orgIdFromToken(tokens.accessToken)
  })

  const server = () => ctx.app.getHttpServer()
  const refresh = (token: string) =>
    request(server()).post('/v1/auth/refresh').send({ refreshToken: token })

  it('rotates the refresh token, retiring the one presented', async () => {
    const first = await refresh(tokens.refreshToken).expect(200)
    expect(first.body.refreshToken).not.toBe(tokens.refreshToken)

    // The replacement works...
    await refresh(first.body.refreshToken).expect(200)
  })

  /**
   * The reason the rotation chain is kept.
   *
   * A token presented after it has been rotated means somebody holds a copy.
   * We cannot tell which holder is the thief, so the whole line is revoked and
   * both are made to sign in again — losing a session is the cheap outcome.
   */
  it('revokes the whole chain when a rotated token is replayed', async () => {
    const second = await refresh(tokens.refreshToken).expect(200)
    const third = await refresh(second.body.refreshToken).expect(200)

    // Replay the original, long since rotated.
    await refresh(tokens.refreshToken).expect(401)

    // The newest token in that line is now dead too — otherwise the attacker's
    // freshly minted session would survive the detection.
    await refresh(third.body.refreshToken).expect(401)
  })

  it('signs out for real — the refresh token stops working', async () => {
    await request(server())
      .post('/v1/auth/logout')
      .send({ refreshToken: tokens.refreshToken })
      .expect(204)

    await refresh(tokens.refreshToken).expect(401)
  })

  it('treats logout as idempotent and says nothing about unknown tokens', async () => {
    await request(server())
      .post('/v1/auth/logout')
      .send({ refreshToken: tokens.refreshToken })
      .expect(204)
    await request(server())
      .post('/v1/auth/logout')
      .send({ refreshToken: tokens.refreshToken })
      .expect(204)
    await request(server())
      .post('/v1/auth/logout')
      .send({ refreshToken: 'not-a-token-we-ever-issued' })
      .expect(204)
  })

  /**
   * The finding that motivated the whole table, restated as a test.
   *
   * Before sessions existed this refresh returned 200 with a brand new pair.
   */
  it('cuts off an offboarded member instead of renewing them for 30 days', async () => {
    // ONLY the membership is deleted — no session is revoked by hand. Measured
    // against the running API before this, that left refresh returning 200,
    // because revocation depended on a removal path remembering to do it.
    await withTenant(ctx.db, orgId, async (tx) => {
      await tx.execute(sql`DELETE FROM memberships WHERE org_id = ${orgId}::uuid`)
    })

    await refresh(tokens.refreshToken).expect(401)
  })

  it('records why an offboarded session was revoked', async () => {
    await withTenant(ctx.db, orgId, async (tx) => {
      await tx.execute(sql`DELETE FROM memberships WHERE org_id = ${orgId}::uuid`)
    })
    await refresh(tokens.refreshToken).expect(401)

    const rows = await withTenant(ctx.db, orgId, (tx) =>
      tx.execute<{ revoked_reason: string }>(
        sql`SELECT revoked_reason FROM sessions WHERE revoked_at IS NOT NULL`,
      ),
    )
    expect([...rows].map((row) => row.revoked_reason)).toContain('membership_removed')
  })

  it('refuses a token that verifies but has no session', async () => {
    // Signature-valid — it was issued by us — but its row is gone.
    await withTenant(ctx.db, orgId, async (tx) => {
      await tx.execute(sql`DELETE FROM sessions WHERE org_id = ${orgId}::uuid`)
    })

    await refresh(tokens.refreshToken).expect(401)
  })

  it('never stores the token itself', async () => {
    const rows = await withTenant(ctx.db, orgId, (tx) =>
      tx.execute<{ token_hash: string }>(sql`SELECT token_hash FROM sessions`),
    )
    const stored = [...rows].map((row) => row.token_hash)

    expect(stored.length).toBeGreaterThan(0)
    for (const hash of stored) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
      expect(hash).not.toBe(tokens.refreshToken)
      expect(tokens.refreshToken).not.toContain(hash)
    }
  })
})
