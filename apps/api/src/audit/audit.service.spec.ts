import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { auditEvents } from '../db/audit.schema'
import { organizations } from '../db/schema'
import { withTenant } from '../db/tenant'
import { AuditService } from './audit.service'

/**
 * PostgreSQL 42501 — insufficient_privilege.
 *
 * Asserted by SQLSTATE rather than by message text for two reasons. drizzle
 * wraps every driver error in a DrizzleQueryError whose own message is only
 * "Failed query: ..." and hangs the PostgresError off `cause`, so a top-level
 * message match never sees the real error (the same trap that made duplicate
 * releases surface as 500s until publish.service.ts started walking the chain).
 * And the message itself is localised by the server's lc_messages, while the
 * code is not.
 */
const REJECTED_BY_PRIVILEGE = '42501'

const sqlStateOf = (error: unknown): string | undefined => {
  for (let current = error; current != null; current = (current as { cause?: unknown }).cause) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

const expectDeniedByPrivilege = async (work: Promise<unknown>): Promise<void> => {
  await expect(work).rejects.toThrow()
  const error = await work.catch((cause: unknown) => cause)
  expect(sqlStateOf(error)).toBe(REJECTED_BY_PRIVILEGE)
}

describe('AuditService', () => {
  const ctx = useTestDb()
  let service: AuditService
  let orgId: string

  beforeEach(async () => {
    await truncateAll(ctx)
    service = new AuditService(ctx.db)
    const [org] = await ctx.ownerDb
      .insert(organizations)
      .values({ slug: 'acme-corp', name: 'Acme' })
      .returning()
    orgId = org!.id
  })

  it('records an event with its metadata', async () => {
    await service.record(orgId, {
      actorId: null,
      action: 'release.published',
      subjectType: 'release',
      subjectId: 'abc',
      metadata: { version: '1.0.0' },
    })

    const events = await service.list(orgId, 10)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      action: 'release.published',
      subjectType: 'release',
      subjectId: 'abc',
      metadata: { version: '1.0.0' },
    })
  })

  it('defaults metadata to an empty object rather than null', async () => {
    await service.record(orgId, {
      actorId: null,
      action: 'app.created',
      subjectType: 'app',
      subjectId: 'hr-portal',
    })

    const [event] = await service.list(orgId, 10)
    expect(event!.metadata).toEqual({})
  })

  it('returns events newest first', async () => {
    await service.record(orgId, { actorId: null, action: 'first', subjectType: 'x', subjectId: '1' })
    await service.record(orgId, { actorId: null, action: 'second', subjectType: 'x', subjectId: '2' })

    const events = await service.list(orgId, 10)
    expect(events.map((event) => event.action)).toEqual(['second', 'first'])
  })

  // The two tests below are the point of the table. They assert a GRANT, not a
  // service method: the mutation is attempted directly against the table
  // through withTenant, bypassing AuditService entirely, exactly as a buggy
  // future endpoint or a stray script would.
  it('refuses an update to a recorded event', async () => {
    await service.record(orgId, {
      actorId: null,
      action: 'release.published',
      subjectType: 'release',
      subjectId: 'abc',
    })

    await expectDeniedByPrivilege(
      withTenant(ctx.db, orgId, (tx) => tx.update(auditEvents).set({ action: 'tampered' })),
    )

    const [event] = await service.list(orgId, 10)
    expect(event!.action).toBe('release.published')
  })

  it('refuses a delete of a recorded event', async () => {
    await service.record(orgId, {
      actorId: null,
      action: 'release.published',
      subjectType: 'release',
      subjectId: 'abc',
    })

    await expectDeniedByPrivilege(withTenant(ctx.db, orgId, (tx) => tx.delete(auditEvents)))

    expect(await service.list(orgId, 10)).toHaveLength(1)
  })

  it('does not return another organization events', async () => {
    const [other] = await ctx.ownerDb
      .insert(organizations)
      .values({ slug: 'globex-inc', name: 'Globex' })
      .returning()
    await service.record(orgId, { actorId: null, action: 'mine', subjectType: 'x', subjectId: '1' })
    await service.record(other!.id, { actorId: null, action: 'theirs', subjectType: 'x', subjectId: '2' })

    const events = await service.list(orgId, 10)
    expect(events.map((event) => event.action)).toEqual(['mine'])
  })
})
