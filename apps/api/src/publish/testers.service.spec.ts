import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { AuditService } from '../audit/audit.service'
import { apps } from '../db/apps.schema'
import { releases } from '../db/releases.schema'
import { memberships, organizations, users } from '../db/schema'
import { TestersService } from './testers.service'

/**
 * The cross-app view exists to answer questions the per-app routes cannot, so
 * these tests are mostly about those: what is a person testing, and which
 * builds are waiting with nobody enrolled to try them.
 */
describe('TestersService', () => {
  const ctx = useTestDb()
  let service: TestersService
  let orgId: string
  let actorId: string
  let memberId: string

  const account = async (email: string): Promise<string> => {
    const [row] = await ctx.ownerDb
      .insert(users)
      .values({ email, passwordHash: 'x', displayName: email.split('@')[0]! })
      .returning({ id: users.id })
    return row!.id
  }

  const app = async (slug: string, name: string): Promise<string> => {
    const [row] = await ctx.ownerDb
      .insert(apps)
      .values({ orgId, slug, name, platform: 'android' })
      .returning({ id: apps.id })
    return row!.id
  }

  beforeEach(async () => {
    await truncateAll(ctx)
    service = new TestersService(ctx.db, new AuditService(ctx.db))

    const [org] = await ctx.ownerDb
      .insert(organizations)
      .values({ slug: 'acme-corp', name: 'Acme' })
      .returning()
    orgId = org!.id

    actorId = await account('lead@acme.test')
    memberId = await account('qa@acme.test')
    await ctx.ownerDb.insert(memberships).values([
      { orgId, userId: actorId, role: 'publisher' },
      { orgId, userId: memberId, role: 'viewer' },
    ])
  })

  it('lists every app, including ones nobody tests', async () => {
    await app('alpha', 'Alpha')
    await app('beta-app', 'Beta App')

    const overview = await service.overview(orgId)
    expect(overview).toHaveLength(2)
    expect(overview.every((entry) => entry.testers.length === 0)).toBe(true)
  })

  it('reports what is on each stage', async () => {
    const appId = await app('alpha', 'Alpha')
    await ctx.ownerDb.insert(releases).values([
      { orgId, appId, platform: 'android', version: '1.0.0', track: 'production', status: 'published' },
      { orgId, appId, platform: 'android', version: '1.1.0', track: 'beta', status: 'draft' },
    ])

    const [entry] = await service.overview(orgId)
    expect(entry!.stages.production?.version).toBe('1.0.0')
    expect(entry!.stages.beta?.version).toBe('1.1.0')
    expect(entry!.stages.internal).toBeUndefined()
  })

  it('shows the NEWEST release on a stage, not an arbitrary one', async () => {
    const appId = await app('alpha', 'Alpha')
    const older = new Date('2026-01-01T00:00:00Z')
    const newer = new Date('2026-06-01T00:00:00Z')
    await ctx.ownerDb.insert(releases).values([
      { orgId, appId, platform: 'android', version: '1.9.0', track: 'beta', status: 'draft', updatedAt: older },
      { orgId, appId, platform: 'android', version: '1.10.0', track: 'beta', status: 'draft', updatedAt: newer },
    ])

    const [entry] = await service.overview(orgId)
    // Sorted by updated_at, not by version string — "1.10.0" < "1.9.0" lexically.
    expect(entry!.stages.beta?.version).toBe('1.10.0')
  })

  it('attributes testers to the right app', async () => {
    await app('alpha', 'Alpha')
    await app('bravo', 'Bravo')
    await service.enrol(orgId, actorId, 'alpha', 'qa@acme.test', 'beta')

    const overview = await service.overview(orgId)
    const alpha = overview.find((entry) => entry.slug === 'alpha')
    const bravo = overview.find((entry) => entry.slug === 'bravo')
    expect(alpha!.testers.map((t) => t.email)).toEqual(['qa@acme.test'])
    expect(bravo!.testers).toEqual([])
  })

  it('enrols one person across several apps at once', async () => {
    await app('alpha', 'Alpha')
    await app('bravo', 'Bravo')

    const outcome = await service.enrolMany(
      orgId,
      actorId,
      ['alpha', 'bravo'],
      'qa@acme.test',
      'beta',
    )
    expect(outcome.enrolled).toHaveLength(2)
    expect(outcome.failed).toEqual([])
  })

  it('keeps the successes when one app in the batch fails', async () => {
    await app('alpha', 'Alpha')

    const outcome = await service.enrolMany(
      orgId,
      actorId,
      ['alpha', 'ghost'],
      'qa@acme.test',
      'beta',
    )
    // The whole point of collecting failures: four of six succeeding must not
    // look like nothing happened, nor like everything did.
    expect(outcome.enrolled).toHaveLength(1)
    expect(outcome.failed).toHaveLength(1)
    expect(outcome.failed[0]!.slug).toBe('ghost')
  })

  it('refuses to enrol somebody who is not a member', async () => {
    await app('alpha', 'Alpha')
    await account('outsider@elsewhere.test')

    const outcome = await service.enrolMany(
      orgId,
      actorId,
      ['alpha'],
      'outsider@elsewhere.test',
      'beta',
    )
    expect(outcome.enrolled).toEqual([])
    expect(outcome.failed[0]!.reason).toMatch(/not a member/i)
  })

  it('re-enrolling changes the stage rather than duplicating', async () => {
    await app('alpha', 'Alpha')
    await service.enrol(orgId, actorId, 'alpha', 'qa@acme.test', 'beta')
    await service.enrol(orgId, actorId, 'alpha', 'qa@acme.test', 'internal')

    const [entry] = await service.overview(orgId)
    expect(entry!.testers).toHaveLength(1)
    expect(entry!.testers[0]!.track).toBe('internal')
  })
})
