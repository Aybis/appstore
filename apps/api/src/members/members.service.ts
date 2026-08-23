import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq, ne, sql } from 'drizzle-orm'

import { AuditService } from '../audit/audit.service'
import { SessionService } from '../auth/session.service'
import { DATABASE, type Database } from '../db/database.provider'
import { memberships, users } from '../db/schema'
import { appTesters } from '../db/testers.schema'
import { apps } from '../db/apps.schema'
import { withTenant } from '../db/tenant'

export type MemberRole = 'owner' | 'admin' | 'publisher' | 'viewer'

export interface Member {
  userId: string
  email: string
  displayName: string
  role: MemberRole
  joinedAt: Date
  /** Apps this person is enrolled to test. Empty for most members. */
  testing: string[]
}

/**
 * Membership administration.
 *
 * "Tester" is deliberately NOT a role here. Testing is enrolment in one app
 * (`app_testers`), because a role would make it global — and being asked to
 * test the expense app is not a reason to see unreleased HR builds. So this
 * service reports each member's role AND the apps they test, and the console
 * shows both without pretending they are the same axis.
 */
@Injectable()
export class MembersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  async list(orgId: string): Promise<Member[]> {
    return withTenant(this.db, orgId, async (tx) => {
      const rows = await tx
        .select({
          userId: users.id,
          email: users.email,
          displayName: users.displayName,
          role: memberships.role,
          joinedAt: memberships.createdAt,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .orderBy(asc(memberships.createdAt))

      // One query for every enrolment rather than one per member: this list is
      // small, but N+1 here would grow with the company.
      const enrolments = await tx
        .select({ userId: appTesters.userId, slug: apps.slug })
        .from(appTesters)
        .innerJoin(apps, eq(apps.id, appTesters.appId))

      const byUser = new Map<string, string[]>()
      for (const row of enrolments) {
        byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.slug])
      }

      return rows.map((row) => ({
        ...row,
        role: row.role as MemberRole,
        testing: byUser.get(row.userId) ?? [],
      }))
    })
  }

  /**
   * Changes a member's role.
   *
   * Refuses to remove the last owner. An organization with no owner cannot
   * appoint one — every path that grants a role requires an admin or owner to
   * already exist — so this is not a tidy invariant, it is the difference
   * between a mistake and an unrecoverable account.
   */
  async setRole(
    orgId: string,
    actorId: string,
    userId: string,
    role: MemberRole,
  ): Promise<Member> {
    await this.assertNotLastOwner(orgId, userId, `change the last owner's role`, role)

    const updated = await withTenant(this.db, orgId, async (tx) => {
      const rows = await tx
        .update(memberships)
        .set({ role })
        .where(eq(memberships.userId, userId))
        .returning({ id: memberships.id })
      return rows[0] ?? null
    })

    if (!updated) throw new NotFoundException('No such member in this organization')

    await this.audit.record(orgId, {
      actorId,
      action: 'member.role_changed',
      subjectType: 'user',
      subjectId: userId,
      metadata: { role },
    })

    /*
     * Sessions are NOT revoked here, and that is safe: RolesGuard re-reads the
     * membership row on every request, so a demotion takes effect on the next
     * call rather than at token expiry. Signing somebody out because their
     * permissions changed would be theatre.
     */
    const members = await this.list(orgId)
    const member = members.find((entry) => entry.userId === userId)
    if (!member) throw new NotFoundException('No such member in this organization')
    return member
  }

  /**
   * Removes somebody from the organization.
   *
   * Revoking their sessions is not optional cleanup. A refresh token is a
   * 30-day credential, so a membership deleted without one leaves an
   * offboarded person able to keep renewing access for a month — which is the
   * exact gap the sessions table was built to close.
   */
  async remove(orgId: string, actorId: string, userId: string): Promise<void> {
    if (userId === actorId) {
      throw new BadRequestException('You cannot remove yourself from the organization')
    }
    await this.assertNotLastOwner(orgId, userId, 'remove the last owner')

    const removed = await withTenant(this.db, orgId, async (tx) => {
      const rows = await tx
        .delete(memberships)
        .where(eq(memberships.userId, userId))
        .returning({ id: memberships.id })
      return rows[0] ?? null
    })

    if (!removed) throw new NotFoundException('No such member in this organization')

    const revoked = await this.sessions.revokeAllForUser(orgId, userId, 'membership_removed')

    await this.audit.record(orgId, {
      actorId,
      action: 'member.removed',
      subjectType: 'user',
      subjectId: userId,
      metadata: { sessionsRevoked: revoked },
    })
  }

  /** Adds an existing user account to this organization. */
  async add(
    orgId: string,
    actorId: string,
    email: string,
    role: MemberRole,
  ): Promise<Member> {
    const address = email.trim().toLowerCase()

    // `users` carries no RLS — accounts are global, memberships are tenanted.
    const [account] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, address))
      .limit(1)

    if (!account) {
      throw new NotFoundException(
        'No account with that address. They must sign up before being added.',
      )
    }

    const existing = await withTenant(this.db, orgId, (tx) =>
      tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.userId, account.id))
        .limit(1),
    )

    if (existing[0]) throw new ConflictException('Already a member of this organization')

    await withTenant(this.db, orgId, (tx) =>
      tx.insert(memberships).values({ orgId, userId: account.id, role }),
    )

    await this.audit.record(orgId, {
      actorId,
      action: 'member.added',
      subjectType: 'user',
      subjectId: account.id,
      metadata: { role, email: address },
    })

    const members = await this.list(orgId)
    const member = members.find((entry) => entry.userId === account.id)
    if (!member) throw new NotFoundException('Member vanished immediately after being added')
    return member
  }

  /**
   * Guards the "there is always at least one owner" invariant.
   *
   * `nextRole` is passed on the role-change path so promoting an owner to
   * owner — a no-op — is not refused as if it removed one.
   */
  private async assertNotLastOwner(
    orgId: string,
    userId: string,
    what: string,
    nextRole?: MemberRole,
  ): Promise<void> {
    if (nextRole === 'owner') return

    const stillOwners = await withTenant(this.db, orgId, (tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(memberships)
        .where(and(eq(memberships.role, 'owner'), ne(memberships.userId, userId))),
    )

    const target = await withTenant(this.db, orgId, (tx) =>
      tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1),
    )

    const isOwner = target[0]?.role === 'owner'
    if (isOwner && (stillOwners[0]?.count ?? 0) === 0) {
      throw new BadRequestException(
        `Cannot ${what} — an organization with no owner cannot appoint one.`,
      )
    }
  }
}
