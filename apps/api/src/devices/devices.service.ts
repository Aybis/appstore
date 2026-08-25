import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { sql } from 'drizzle-orm'

import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'

export type InstallOutcome = 'installed' | 'updated' | 'failed' | 'removed'

export interface DeviceInput {
  deviceKey: string
  platform: 'android' | 'ios'
  model?: string
  osVersion?: string
  clientVersion?: string
}

export interface InstallReport {
  deviceKey: string
  appSlug: string
  version: string
  outcome: InstallOutcome
}

/**
 * What devices tell the server about themselves.
 *
 * This is the half that was missing from the dashboard. `audit_events` records
 * that a download ticket was ISSUED; whether the install then succeeded happens
 * on the device, after the bytes have left, and nothing was carrying that fact
 * back. Every install number on the dashboard was seeded because of this gap.
 *
 * DELIBERATELY THIN. It records what happened and nothing else — no location,
 * no advertising id, no hardware serial. A device key the app generates for
 * itself is enough to answer "how many devices" and "which version are they
 * on", and anything more would be personal data this product has no reason to
 * hold and would then have to justify holding.
 */
@Injectable()
export class DevicesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Registers a device, or refreshes what is known about one.
   *
   * Upsert on (org, device_key) rather than insert: an app reports on every
   * launch, and inserting each time would make "devices" a count of app
   * starts. `last_seen_at` moving is the useful part of a repeat call.
   */
  async register(orgId: string, userId: string, input: DeviceInput): Promise<{ id: string }> {
    return withTenant(this.db, orgId, async (tx) => {
      const rows = await tx.execute<{ id: string }>(sql`
        INSERT INTO devices (org_id, user_id, device_key, platform, model,
                             os_version, client_version, last_seen_at)
        VALUES (${orgId}::uuid, ${userId}::uuid, ${input.deviceKey},
                ${input.platform}::app_platform, ${input.model ?? ''},
                ${input.osVersion ?? ''}, ${input.clientVersion ?? ''}, now())
        ON CONFLICT (org_id, device_key) DO UPDATE SET
          -- The user can change: a shared handset, or somebody signing in on a
          -- colleague's spare. Whoever is signed in now is whose device it is.
          user_id = excluded.user_id,
          model = excluded.model,
          os_version = excluded.os_version,
          client_version = excluded.client_version,
          last_seen_at = now()
        RETURNING id
      `)
      return { id: [...rows][0]!.id }
    })
  }

  /**
   * Records how an install actually went.
   *
   * Failures are recorded as loudly as successes. A store that only counts
   * what worked cannot tell the difference between an app nobody wants and an
   * app nobody can install, and those need opposite responses.
   */
  async recordInstall(orgId: string, userId: string, report: InstallReport): Promise<void> {
    await withTenant(this.db, orgId, async (tx) => {
      const devices = await tx.execute<{ id: string }>(sql`
        SELECT id FROM devices WHERE device_key = ${report.deviceKey}
      `)
      let deviceId = [...devices][0]?.id

      // A device reporting an install before it registered is a legitimate
      // race on a cold start, not an error to push back to the user.
      if (!deviceId) {
        const registered = await this.register(orgId, userId, {
          deviceKey: report.deviceKey,
          platform: 'android',
        })
        deviceId = registered.id
      }

      const apps = await tx.execute<{ id: string }>(sql`
        SELECT id FROM apps WHERE slug = ${report.appSlug}
      `)
      const app = [...apps][0]
      if (!app) throw new NotFoundException(`No app with slug "${report.appSlug}"`)

      // Best-effort: the release may have been superseded between the download
      // and the install finishing, and losing the event over that would be
      // worse than losing the link to the exact row.
      const releases = await tx.execute<{ id: string }>(sql`
        SELECT id FROM releases
        WHERE app_id = ${app.id}::uuid AND version = ${report.version}
        ORDER BY updated_at DESC LIMIT 1
      `)

      await tx.execute(sql`
        INSERT INTO install_events (org_id, device_id, app_id, release_id, version, outcome)
        VALUES (${orgId}::uuid, ${deviceId}::uuid, ${app.id}::uuid,
                ${[...releases][0]?.id ?? null}, ${report.version},
                ${report.outcome}::install_outcome)
      `)
    })
  }
}
