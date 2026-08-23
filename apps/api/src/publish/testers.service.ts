import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import type { ReleaseTrack } from '../catalog/catalog.service'
import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'

export interface Tester {
  userId: string
  email: string
  displayName: string
  track: ReleaseTrack
  createdAt: string
}

/**
 * Who may see an app's pre-production builds.
 *
 * Enrolment is per app, and only for people who already belong to the
 * organization — this grants early access to an existing member, it is not a
 * second way to join. An outsider needs an org invitation first.
 */
@Injectable()
export class TestersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, slug: string): Promise<Tester[]> {
    const rows = await withTenant(this.db, orgId, async (tx) => {
      const result = await tx.execute<{
        user_id: string
        email: string
        display_name: string
        track: ReleaseTrack
        created_at: string
      }>(sql`
        SELECT t.user_id, u.email, u.display_name, t.track::text AS track, t.created_at
        FROM app_testers t
        JOIN apps a ON a.id = t.app_id
        JOIN users u ON u.id = t.user_id
        WHERE a.slug = ${slug}
        ORDER BY u.email
      `)
      return [...result]
    })

    return rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      track: row.track,
      createdAt: new Date(row.created_at).toISOString(),
    }))
  }

  /**
   * Enrols an existing member, or moves an already-enrolled one to a different
   * track. Idempotent by (app, user) so inviting twice cannot produce two rows
   * whose visibility depends on which one a query happens to read first.
   */
  async enrol(
    orgId: string,
    actorId: string,
    slug: string,
    email: string,
    track: ReleaseTrack,
  ): Promise<Tester> {
    const enrolled = await withTenant(this.db, orgId, async (tx) => {
      const apps = await tx.execute<{ id: string }>(sql`
        SELECT id FROM apps WHERE slug = ${slug}
      `)
      const app = [...apps][0]
      if (!app) throw new NotFoundException(`No app with slug "${slug}"`)

      // Membership, not merely existence: `users` is global, so matching on
      // email alone would happily enrol somebody from another organization.
      const members = await tx.execute<{ id: string; email: string; display_name: string }>(sql`
        SELECT u.id, u.email, u.display_name
        FROM users u
        JOIN memberships m ON m.user_id = u.id
        WHERE lower(u.email) = lower(${email})
      `)
      const member = [...members][0]
      if (!member) {
        throw new NotFoundException(
          `"${email}" is not a member of this organization — invite them first`,
        )
      }

      const rows = await tx.execute<{ created_at: string; track: string }>(sql`
        INSERT INTO app_testers (org_id, app_id, user_id, track, invited_by)
        VALUES (${orgId}::uuid, ${app.id}::uuid, ${member.id}::uuid,
                ${track}::release_track, ${actorId}::uuid)
        ON CONFLICT (app_id, user_id) DO UPDATE SET track = excluded.track
        RETURNING created_at, track::text AS track
      `)
      const row = [...rows][0]!
      return { member, row }
    })

    await this.audit.record(orgId, {
      actorId,
      action: 'tester.enrolled',
      subjectType: 'app',
      subjectId: slug,
      metadata: { email: enrolled.member.email, track },
    })

    return {
      userId: enrolled.member.id,
      email: enrolled.member.email,
      displayName: enrolled.member.display_name,
      track: enrolled.row.track as ReleaseTrack,
      createdAt: new Date(enrolled.row.created_at).toISOString(),
    }
  }

  async remove(orgId: string, actorId: string, slug: string, email: string): Promise<void> {
    const removed = await withTenant(this.db, orgId, async (tx) => {
      const rows = await tx.execute<{ user_id: string }>(sql`
        DELETE FROM app_testers t
        USING apps a, users u
        WHERE t.app_id = a.id
          AND t.user_id = u.id
          AND a.slug = ${slug}
          AND lower(u.email) = lower(${email})
        RETURNING t.user_id
      `)
      return [...rows][0]
    })

    if (!removed) {
      throw new ConflictException(`"${email}" is not a tester of "${slug}"`)
    }

    await this.audit.record(orgId, {
      actorId,
      action: 'tester.removed',
      subjectType: 'app',
      subjectId: slug,
      metadata: { email },
    })
  }
}
