import { createHash } from 'node:crypto'
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

import { DATABASE, type Database } from '../db/database.provider'
import { memberships } from '../db/schema'
import { sessions } from '../db/sessions.schema'
import { withTenant } from '../db/tenant'

/** Matches the refresh token's own lifetime in TokenService. */
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type RevokedReason =
  | 'logout'
  | 'rotated'
  | 'reuse_detected'
  | 'membership_removed'
  | 'password_changed'

export interface SessionContext {
  orgId: string
  userId: string
  /**
   * `| undefined` explicitly, not just optional: this package compiles with
   * `exactOptionalPropertyTypes`, under which an omitted property and one set
   * to undefined are different types — and the caller reads a header that may
   * genuinely be absent.
   */
  userAgent?: string | undefined
}

/**
 * The server side of a refresh token.
 *
 * Closes security review S-1. Refresh tokens were stateless 30-day JWTs, so
 * signing out invalidated nothing, a stolen token could not be cut off, and an
 * offboarded employee kept a renewable credential for a month.
 *
 * Only the SHA-256 of a token is stored — never the token — for the same
 * reason passwords are hashed. SHA-256 rather than argon2 here on purpose: the
 * input is 200+ bits of our own signed randomness, not a human-chosen secret,
 * so there is no dictionary to slow down, and refresh sits on the hot path of
 * every client waking up.
 */
@Injectable()
export class SessionService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  /** Opens a session for a freshly issued refresh token. */
  async open(token: string, context: SessionContext): Promise<string> {
    return withTenant(this.db, context.orgId, async (tx) => {
      const rows = await tx
        .insert(sessions)
        .values({
          orgId: context.orgId,
          userId: context.userId,
          tokenHash: SessionService.hash(token),
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
          userAgent: context.userAgent ?? '',
        })
        .returning({ id: sessions.id })
      return rows[0]!.id
    })
  }

  /**
   * Consumes a refresh token and opens its successor.
   *
   * The whole operation runs in ONE transaction. Two clients waking together
   * would otherwise both read the row as live and both rotate it, and the
   * loser's brand-new session would be revoked a moment later as a replay —
   * signing a legitimate user out for being fast.
   */
  async rotate(
    presented: string,
    replacement: string,
    context: SessionContext,
  ): Promise<string> {
    const presentedHash = SessionService.hash(presented)

    const outcome = await withTenant(this.db, context.orgId, async (tx) => {
      const found = await tx
        .select({
          id: sessions.id,
          userId: sessions.userId,
          revokedAt: sessions.revokedAt,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(eq(sessions.tokenHash, presentedHash))
        // Serialises concurrent refreshes of the SAME token behind one lock, so
        // the second one sees the first one's result rather than a stale read.
        .for('update')
        .limit(1)

      const session = found[0]

      // No row: a token we never issued, or one whose chain was pruned.
      if (!session) return { kind: 'unknown' } as const

      // REPLAY. Reported rather than thrown, deliberately — see below.
      if (session.revokedAt) return { kind: 'replay', sessionId: session.id } as const

      if (session.expiresAt.getTime() <= Date.now()) return { kind: 'expired' } as const

      /**
       * Membership is re-checked here, not just at the session row.
       *
       * Revoking sessions when a member is removed is the right thing to do,
       * but it depends on every future removal path REMEMBERING to do it — and
       * measured against the running API, deleting a membership on its own left
       * refresh returning 200. Re-reading membership makes offboarding work
       * whether or not anyone remembers, which is the same reasoning that makes
       * RolesGuard re-read it on every request rather than trust the token.
       */
      const member = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(eq(memberships.userId, session.userId), eq(memberships.orgId, context.orgId)),
        )
        .limit(1)

      if (!member[0]) {
        await tx
          .update(sessions)
          .set({ revokedAt: new Date(), revokedReason: 'membership_removed' })
          .where(eq(sessions.id, session.id))
        return { kind: 'no-membership' } as const
      }

      await tx
        .update(sessions)
        .set({ revokedAt: new Date(), revokedReason: 'rotated', lastUsedAt: new Date() })
        .where(eq(sessions.id, session.id))

      const opened = await tx
        .insert(sessions)
        .values({
          orgId: context.orgId,
          userId: session.userId,
          tokenHash: SessionService.hash(replacement),
          rotatedFrom: session.id,
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
          userAgent: context.userAgent ?? '',
        })
        .returning({ id: sessions.id })

      return { kind: 'rotated', sessionId: opened[0]!.id } as const
    })

    if (outcome.kind === 'rotated') return outcome.sessionId

    /**
     * The chain is revoked in its OWN transaction, after the first one has
     * committed.
     *
     * The first version revoked inside the read transaction and then threw —
     * and the throw rolled the revocation back, so the attacker's freshly
     * minted session survived the very detection that was meant to kill it. A
     * security response that undoes itself is worse than none, because the log
     * says it fired. Caught by the test asserting the newest token in the line
     * is dead too.
     */
    if (outcome.kind === 'replay') {
      await withTenant(this.db, context.orgId, (tx) =>
        this.revokeChain(tx, outcome.sessionId, 'reuse_detected'),
      )
    }

    // One message for every failure, so a caller cannot tell an unknown token
    // from a replayed one from an expired one.
    throw new UnauthorizedException('Session is no longer valid')
  }

  /** Sign-out. Revokes the one session the presented token belongs to. */
  async revoke(token: string, orgId: string, reason: RevokedReason = 'logout'): Promise<void> {
    await withTenant(this.db, orgId, async (tx) => {
      await tx
        .update(sessions)
        .set({ revokedAt: new Date(), revokedReason: reason })
        .where(and(eq(sessions.tokenHash, SessionService.hash(token)), isNull(sessions.revokedAt)))
    })
  }

  /**
   * Revokes every live session a user holds in an org.
   *
   * This is what makes offboarding real: removing a membership must also cut
   * the credential, or the person keeps refreshing until the token expires.
   */
  async revokeAllForUser(
    orgId: string,
    userId: string,
    reason: RevokedReason,
  ): Promise<number> {
    return withTenant(this.db, orgId, async (tx) => {
      const revoked = await tx
        .update(sessions)
        .set({ revokedAt: new Date(), revokedReason: reason })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id })
      return revoked.length
    })
  }

  /**
   * Walks a rotation chain in both directions and revokes all of it.
   *
   * Recursive rather than a loop over `rotated_from`: the replayed token can
   * sit anywhere in the line, and revoking only its ancestors would leave the
   * attacker's newer session — the one they just created — alive.
   */
  private async revokeChain(
    tx: Parameters<Parameters<typeof withTenant>[2]>[0],
    sessionId: string,
    reason: RevokedReason,
  ): Promise<void> {
    await tx.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT id, rotated_from FROM sessions WHERE id = ${sessionId}::uuid
        UNION
        -- ONE recursive term walking BOTH directions. Postgres permits exactly
        -- one self-reference, so the two directions are an OR inside a single
        -- join rather than two UNION branches — which is what the first
        -- version tried, and what Postgres refused with "recursive reference
        -- ... must not appear within its non-recursive term".
        --
        -- Backwards (s.id = c.rotated_from) reaches the ancestors this session
        -- came from; forwards (s.rotated_from = c.id) reaches the successor an
        -- attacker just minted. Revoking only one direction would leave the
        -- other half of the line alive.
        SELECT s.id, s.rotated_from
        FROM sessions s
        JOIN chain c ON s.id = c.rotated_from OR s.rotated_from = c.id
      )
      UPDATE sessions
      SET revoked_at = COALESCE(revoked_at, now()), revoked_reason = ${reason}
      WHERE id IN (SELECT id FROM chain)
    `)
  }
}
