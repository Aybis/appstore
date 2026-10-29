import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import type { ChangePasswordInput, Profile, UpdateProfileInput } from '@appstore/shared'
import { eq } from 'drizzle-orm'

import { DATABASE, type Database } from '../../database/database.provider'
import { users } from '../../database/schema'
import { AuditService } from '../audit/audit.service'
import { PasswordService } from '../auth/password.service'
import { SessionService } from '../auth/session.service'

export interface Caller {
  userId: string
  orgId: string
  role: string
}

/**
 * The signed-in person's own account: name, picture and password.
 *
 * `users` holds no org_id and no RLS policy — a person exists once and joins
 * organizations through `memberships` — so it is read and written directly,
 * always by the caller's own id from the verified token, never an id from the
 * request.
 */
@Injectable()
export class AccountService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async profile(caller: Caller): Promise<Profile> {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarKey: users.avatarKey,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, caller.userId))
      .limit(1)
    if (!row) throw new NotFoundException('Account not found')

    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      avatarUrl: row.avatarKey ? `/v1/avatars/${row.avatarKey}` : '',
      role: caller.role,
      createdAt: row.createdAt.toISOString(),
    }
  }

  async update(caller: Caller, input: UpdateProfileInput): Promise<Profile> {
    await this.db.update(users).set({ displayName: input.displayName }).where(eq(users.id, caller.userId))
    await this.record(caller, 'account.updated', { displayName: input.displayName })
    return this.profile(caller)
  }

  /** `key` is an avatars/ name from IconStore, or '' to remove the picture. */
  async setAvatar(caller: Caller, key: string): Promise<Profile> {
    await this.db.update(users).set({ avatarKey: key }).where(eq(users.id, caller.userId))
    await this.record(caller, key ? 'account.avatar_set' : 'account.avatar_removed')
    return this.profile(caller)
  }

  /**
   * Checks the current password, stores the new one, and ends every session
   * the person has in this organization — this device included, so the apps
   * send them back to sign in with the new password. A password is changed
   * because it may be known to someone else; leaving their sessions alive
   * would defeat the point.
   */
  async changePassword(caller: Caller, input: ChangePasswordInput): Promise<void> {
    const [row] = await this.db
      .select({ hash: users.passwordHash })
      .from(users)
      .where(eq(users.id, caller.userId))
      .limit(1)
    if (!row || !(await this.passwords.verify(row.hash, input.currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect')
    }

    await this.db
      .update(users)
      .set({ passwordHash: await this.passwords.hash(input.newPassword) })
      .where(eq(users.id, caller.userId))
    const revoked = await this.sessions.revokeAllForUser(caller.orgId, caller.userId, 'password_changed')
    await this.record(caller, 'account.password_changed', { sessionsEnded: revoked })
  }

  private record(caller: Caller, action: string, metadata: Record<string, unknown> = {}): Promise<void> {
    return this.audit.record(caller.orgId, {
      actorId: caller.userId,
      action,
      subjectType: 'user',
      subjectId: caller.userId,
      metadata,
    })
  }
}
