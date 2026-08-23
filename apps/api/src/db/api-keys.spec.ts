import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { truncateAll, useTestDb } from '../../test/support/db'
import { organizations } from './schema'

/**
 * Security review S-8, proved against the database rather than the service.
 *
 * The point of the finding is that the cap must not be a convention. A service
 * check protects the paths somebody remembered to route through it; a CHECK
 * constraint protects the table. So these tests write raw SQL as the schema
 * owner — the most privileged path there is, and the one a future refactor,
 * a migration script or a psql session would take.
 *
 * A CI key that can mint admins is a privilege-escalation primitive, and CI
 * tokens leak into build logs, repository forks and shared screens far more
 * readily than passwords do.
 */
describe('api_keys role cap (S-8)', () => {
  const ctx = useTestDb()
  let orgId: string

  const insert = (role: string, prefix: string) =>
    ctx.ownerDb.execute(sql`
      INSERT INTO api_keys (org_id, name, prefix, secret_hash, role, expires_at)
      VALUES (${orgId}::uuid, 'ci', ${prefix}, 'hash', ${role}::membership_role,
              now() + interval '90 days')
    `)

  beforeEach(async () => {
    await truncateAll(ctx)
    const [org] = await ctx.ownerDb
      .insert(organizations)
      .values({ slug: 'acme-corp', name: 'Acme' })
      .returning()
    orgId = org!.id
  })

  it('accepts publisher', async () => {
    await expect(insert('publisher', 'mk_pub')).resolves.toBeDefined()
  })

  it('accepts viewer — a read-only key is legitimate', async () => {
    await expect(insert('viewer', 'mk_view')).resolves.toBeDefined()
  })

  it('REFUSES admin, even as the schema owner', async () => {
    await expect(insert('admin', 'mk_admin')).rejects.toThrow()
  })

  it('REFUSES owner', async () => {
    await expect(insert('owner', 'mk_owner')).rejects.toThrow()
  })

  it('REFUSES escalation by UPDATE, not only by INSERT', async () => {
    // The sneakier path: mint a legitimate key, then raise its role. A service
    // that only validates on create would let this through.
    await insert('publisher', 'mk_upgrade')
    await expect(
      ctx.ownerDb.execute(sql`
        UPDATE api_keys SET role = 'admin'::membership_role WHERE prefix = 'mk_upgrade'
      `),
    ).rejects.toThrow()
  })

  it('requires an expiry that is actually in the future', async () => {
    await expect(
      ctx.ownerDb.execute(sql`
        INSERT INTO api_keys (org_id, name, prefix, secret_hash, role, expires_at)
        VALUES (${orgId}::uuid, 'ci', 'mk_past', 'hash', 'publisher',
                now() - interval '1 day')
      `),
    ).rejects.toThrow()
  })

  it('will not store two keys under one prefix', async () => {
    // Lookup is by prefix, so a duplicate makes "which key is this" ambiguous.
    await insert('publisher', 'mk_same')
    await expect(insert('publisher', 'mk_same')).rejects.toThrow()
  })
})
