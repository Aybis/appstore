import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'

import { DATABASE, type Database } from '../../database/database.provider'
import { withTenant } from '../../database/tenant'

/** What the landing page may show strangers: totals, never rows. */
export interface PublicStats {
  users: number
  apps: number
  installs: number
  devices: number
  releases: number
}

/** Long enough that a refresh storm is one query, short enough to look live. */
const TTL_MS = 5 * 60 * 1000

/**
 * The numbers on the landing page, for the whole deployment.
 *
 * Every figure is a real count — same rule as DashboardService — and only a
 * count: no names, no slugs, nothing a visitor could use to learn what any one
 * organization has built.
 *
 * RLS IS NOT BYPASSED. The connection is app_runtime, so an unscoped count of
 * `apps` sees nothing. Rather than add a SECURITY DEFINER escape hatch for one
 * marketing strip, each organization is counted through withTenant, the one
 * sanctioned path, and the results are summed here. A deployment has a
 * handful of orgs, and the result is cached, so the loop is cheap.
 *
 * `users` and `organizations` are global tables without policies, so users
 * are counted directly.
 */
@Injectable()
export class StatsService {
  private cached: { at: number; value: PublicStats } | null = null

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async load(): Promise<PublicStats> {
    if (this.cached && Date.now() - this.cached.at < TTL_MS) return this.cached.value

    const value = await this.count()
    this.cached = { at: Date.now(), value }
    return value
  }

  private async count(): Promise<PublicStats> {
    const n = (value: string | undefined): number => Number(value ?? 0)

    const [people] = [
      ...(await this.db.execute<{ users: string }>(sql`SELECT count(*)::text AS users FROM users`)),
    ]
    const orgs = [...(await this.db.execute<{ id: string }>(sql`SELECT id FROM organizations`))]

    const totals: PublicStats = { users: n(people?.users), apps: 0, installs: 0, devices: 0, releases: 0 }

    for (const org of orgs) {
      const [row] = await withTenant(this.db, org.id, async (tx) => [
        ...(await tx.execute<Record<string, string>>(sql`
          SELECT
            (SELECT count(DISTINCT app_id) FROM releases WHERE status = 'published')::text AS apps,
            (SELECT count(*) FROM releases WHERE status = 'published')::text               AS releases,
            (SELECT count(*) FROM install_events
               WHERE outcome IN ('installed','updated'))::text                             AS installs,
            (SELECT count(*) FROM devices)::text                                           AS devices
        `)),
      ])
      totals.apps += n(row?.apps)
      totals.releases += n(row?.releases)
      totals.installs += n(row?.installs)
      totals.devices += n(row?.devices)
    }

    return totals
  }
}
