import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'

import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'

export interface DashboardTotals {
  members: number
  devices: number
  /** Distinct people who signed in during the window, not session rows. */
  activeUsers: number
  logins: number
  apps: number
  publishedApps: number
  installs: number
  failedInstalls: number
  releases: number
  testers: number
}

export interface AppInstallRow {
  slug: string
  name: string
  installs: number
  failures: number
  devices: number
}

export interface VersionRow {
  slug: string
  name: string
  version: string
  devices: number
}

export interface RatingRow {
  slug: string
  name: string
  average: number
  count: number
  good: number
  bad: number
}

export interface PublisherRow {
  publisher: string
  releases: number
  apps: number
}

export interface Dashboard {
  windowDays: number
  totals: DashboardTotals
  installsByApp: AppInstallRow[]
  versionsInUse: VersionRow[]
  ratings: RatingRow[]
  publishers: PublisherRow[]
  /** True when nothing has reported yet — the console says so rather than drawing zeros as if they were measurements. */
  empty: boolean
}

/**
 * Numbers for the console's dashboard, every one of them a real query.
 *
 * There are no constants in this file. If a figure here is wrong it is because
 * the data is wrong, which is the only kind of wrong worth having — a hardcoded
 * placeholder looks identical to a measurement and stops being questioned the
 * day it ships.
 *
 * LOGINS COME FROM `audit_events`, NOT `sessions`. A session row is replaced on
 * every refresh by rotation, so counting sessions counts client wake-ups. The
 * `auth.login` event is the only record of somebody actually signing in.
 *
 * INSTALLS COME FROM `install_events`, NOT the audit log. The audit log knows a
 * download ticket was issued; whether the install then succeeded happens on the
 * device, after the bytes have left, and the gap between the two is precisely
 * the number anybody wants.
 */
@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async load(orgId: string, windowDays = 30): Promise<Dashboard> {
    return withTenant(this.db, orgId, async (tx) => {
      const since = sql`now() - make_interval(days => ${windowDays})`

      const [totals] = [
        ...(await tx.execute<Record<string, string>>(sql`
          SELECT
            (SELECT count(*) FROM memberships)                            AS members,
            (SELECT count(*) FROM devices)                                AS devices,
            (SELECT count(DISTINCT actor_id) FROM audit_events
               WHERE action = 'auth.login' AND created_at >= ${since})    AS active_users,
            (SELECT count(*) FROM audit_events
               WHERE action = 'auth.login' AND created_at >= ${since})    AS logins,
            (SELECT count(*) FROM apps)                                   AS apps,
            (SELECT count(DISTINCT app_id) FROM releases
               WHERE status = 'published')                                AS published_apps,
            (SELECT count(*) FROM install_events
               WHERE outcome IN ('installed','updated') AND created_at >= ${since}) AS installs,
            (SELECT count(*) FROM install_events
               WHERE outcome = 'failed' AND created_at >= ${since})       AS failed_installs,
            (SELECT count(*) FROM releases WHERE created_at >= ${since})  AS releases,
            (SELECT count(DISTINCT user_id) FROM app_testers)             AS testers
        `)),
      ]

      const installsByApp = [
        ...(await tx.execute<{
          slug: string
          name: string
          installs: string
          failures: string
          devices: string
        }>(sql`
          SELECT a.slug, a.name,
                 count(*) FILTER (WHERE e.outcome IN ('installed','updated'))::text AS installs,
                 count(*) FILTER (WHERE e.outcome = 'failed')::text                 AS failures,
                 count(DISTINCT e.device_id)::text                                  AS devices
          FROM install_events e
          JOIN apps a ON a.id = e.app_id
          WHERE e.created_at >= ${since}
          GROUP BY a.id
          ORDER BY count(*) FILTER (WHERE e.outcome IN ('installed','updated')) DESC
          LIMIT 10
        `)),
      ]

      /*
       * What each device is CURRENTLY on, not how many times a version was
       * ever installed. DISTINCT ON takes the newest event per (device, app) —
       * a phone that installed 1.0 and then updated to 1.1 counts once, for
       * 1.1, which is the question "which versions are out there" actually
       * asks.
       */
      const versionsInUse = [
        ...(await tx.execute<{ slug: string; name: string; version: string; devices: string }>(sql`
          WITH current AS (
            SELECT DISTINCT ON (e.device_id, e.app_id)
                   e.device_id, e.app_id, e.version, e.outcome
            FROM install_events e
            ORDER BY e.device_id, e.app_id, e.created_at DESC
          )
          SELECT a.slug, a.name, c.version, count(*)::text AS devices
          FROM current c
          JOIN apps a ON a.id = c.app_id
          WHERE c.outcome IN ('installed','updated')
          GROUP BY a.slug, a.name, c.version
          ORDER BY count(*) DESC
          LIMIT 12
        `)),
      ]

      const ratings = [
        ...(await tx.execute<{
          slug: string
          name: string
          average: string
          count: string
          good: string
          bad: string
        }>(sql`
          SELECT a.slug, a.name,
                 round(avg(r.score)::numeric, 2)::text            AS average,
                 count(*)::text                                   AS count,
                 count(*) FILTER (WHERE r.score >= 4)::text       AS good,
                 count(*) FILTER (WHERE r.score <= 2)::text       AS bad
          FROM app_ratings r
          JOIN apps a ON a.id = r.app_id
          GROUP BY a.id
          ORDER BY avg(r.score) DESC
        `)),
      ]

      const publishers = [
        ...(await tx.execute<{ publisher: string; releases: string; apps: string }>(sql`
          SELECT COALESCE(NULLIF(a.publisher, ''), 'Unattributed') AS publisher,
                 count(r.id)::text                                 AS releases,
                 count(DISTINCT a.id)::text                        AS apps
          FROM apps a
          LEFT JOIN releases r ON r.app_id = a.id AND r.created_at >= ${since}
          GROUP BY 1
          HAVING count(r.id) > 0
          ORDER BY count(r.id) DESC
        `)),
      ]

      const n = (value: string | undefined): number => Number(value ?? 0)

      const shaped: DashboardTotals = {
        members: n(totals?.members),
        devices: n(totals?.devices),
        activeUsers: n(totals?.active_users),
        logins: n(totals?.logins),
        apps: n(totals?.apps),
        publishedApps: n(totals?.published_apps),
        installs: n(totals?.installs),
        failedInstalls: n(totals?.failed_installs),
        releases: n(totals?.releases),
        testers: n(totals?.testers),
      }

      return {
        windowDays,
        totals: shaped,
        installsByApp: installsByApp.map((row) => ({
          slug: row.slug,
          name: row.name,
          installs: n(row.installs),
          failures: n(row.failures),
          devices: n(row.devices),
        })),
        versionsInUse: versionsInUse.map((row) => ({
          slug: row.slug,
          name: row.name,
          version: row.version,
          devices: n(row.devices),
        })),
        ratings: ratings.map((row) => ({
          slug: row.slug,
          name: row.name,
          average: Number(row.average ?? 0),
          count: n(row.count),
          good: n(row.good),
          bad: n(row.bad),
        })),
        publishers: publishers.map((row) => ({
          publisher: row.publisher,
          releases: n(row.releases),
          apps: n(row.apps),
        })),
        // Devices are the signal: no device has ever reported, so nothing on
        // this page is a measurement yet and the console should say so.
        empty: shaped.devices === 0,
      }
    })
  }
}
