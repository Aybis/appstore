import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { AuditService } from '../audit/audit.service'
import { SessionService } from '../auth/session.service'
import { memberships, organizations, users } from '../db/schema'
import { MembersService } from './members.service'

/**
 * These tests exist for the two rules that turn a mistake into an incident.
 *
 * Removing the last owner leaves an organization nobody can administer, and no
 * path exists to appoint a new one — every grant requires an admin or owner to
 * already be there. And a membership deleted without revoking sessions leaves
 * an offboarded person holding a 30-day renewable credential, which is exactly
 * the gap the sessions table was built to close.
 */
describe('MembersService', () => {
  const ctx = useTestDb()
  let members: MembersService
  let sessions: SessionService
  let orgId: string
  let ownerId: string
  let adminId: string
  let staffId: string

  const account = async (email: string): Promise<string> => {
    const [row] = await ctx.ownerDb
      .insert(users)
      .values({ email, passwordHash: 'x', displayName: email.split('@')[0]! })
      .returning({ id: users.id })
    return row!.id
  }

  beforeEach(async () => {
    await truncateAll(ctx)
    sessions = new SessionService(ctx.db)
    members = new MembersService(ctx.db, new AuditService(ctx.db), sessions)

    const [org] = await ctx.ownerDb
      .insert(organizations)
      .values({ slug: 'acme-corp', name: 'Acme' })
      .returning()
    orgId = org!.id

    ownerId = await account('owner@acme.test')
    adminId = await account('admin@acme.test')
    staffId = await account('staff@acme.test')

    await ctx.ownerDb.insert(memberships).values([
      { orgId, userId: ownerId, role: 'owner' },
      { orgId, userId: adminId, role: 'admin' },
      { orgId, userId: staffId, role: 'viewer' },
    ])
  })

  it('lists members with their roles', async () => {
    const list = await members.list(orgId)
    expect(list).toHaveLength(3)
    expect(list.map((entry) => entry.role).sort()).toEqual(['admin', 'owner', 'viewer'])
    expect(list.every((entry) => Array.isArray(entry.testing))).toBe(true)
  })

  it('changes a role', async () => {
    const updated = await members.setRole(orgId, ownerId, staffId, 'publisher')
    expect(updated.role).toBe('publisher')
  })

  it('REFUSES to demote the last owner', async () => {
    await expect(members.setRole(orgId, ownerId, ownerId, 'admin')).rejects.toThrow(
      /last owner/i,
    )
  })

  it('REFUSES to remove the last owner', async () => {
    await expect(members.remove(orgId, adminId, ownerId)).rejects.toThrow(/last owner/i)
  })

  it('allows demoting an owner while another owner remains', async () => {
    await members.setRole(orgId, ownerId, adminId, 'owner')
    const updated = await members.setRole(orgId, adminId, ownerId, 'admin')
    expect(updated.role).toBe('admin')
  })

  it('does not treat promoting an owner to owner as removing one', async () => {
    // A no-op write must not trip the last-owner guard.
    const updated = await members.setRole(orgId, ownerId, ownerId, 'owner')
    expect(updated.role).toBe('owner')
  })

  it('refuses self-removal', async () => {
    await expect(members.remove(orgId, adminId, adminId)).rejects.toThrow(/yourself/i)
  })

  it('REVOKES every session when a member is removed', async () => {
    await sessions.open('refresh-token-one', { orgId, userId: staffId })
    await sessions.open('refresh-token-two', { orgId, userId: staffId })

    await members.remove(orgId, ownerId, staffId)

    // revokeAllForUser only touches live rows, so a second call returning 0 is
    // proof the first one left none behind.
    const remaining = await sessions.revokeAllForUser(orgId, staffId, 'membership_removed')
    expect(remaining).toBe(0)
  })

  it('records who did what', async () => {
    await members.setRole(orgId, ownerId, staffId, 'publisher')
    const events = await new AuditService(ctx.db).list(orgId, 10)
    expect(events[0]).toMatchObject({
      action: 'member.role_changed',
      actorId: ownerId,
      subjectId: staffId,
    })
  })

  it('rejects adding an address with no account', async () => {
    await expect(
      members.add(orgId, ownerId, 'nobody@acme.test', 'viewer'),
    ).rejects.toThrow(/No account/i)
  })

  it('adds an existing account, and refuses to add them twice', async () => {
    const outsider = await account('new@acme.test')
    const added = await members.add(orgId, ownerId, 'new@acme.test', 'publisher')
    expect(added.userId).toBe(outsider)
    expect(added.role).toBe('publisher')

    await expect(members.add(orgId, ownerId, 'new@acme.test', 'viewer')).rejects.toThrow(
      /Already a member/i,
    )
  })

  it('is case-insensitive about the address', async () => {
    await account('mixed@acme.test')
    const added = await members.add(orgId, ownerId, '  MiXeD@Acme.TEST ', 'viewer')
    expect(added.email).toBe('mixed@acme.test')
  })
})
