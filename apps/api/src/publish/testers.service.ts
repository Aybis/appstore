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


/** One release sitting on a stage, as the testing page needs to see it. */
export interface StageRelease {
  version: string
  status: string
  updatedAt: string
}

/** An app, everyone testing it, and what is currently on each stage. */
export interface TestingApp {
  slug: string
  name: string
  platform: string
  testers: Tester[]
  /** Newest release per track. Absent tracks simply have nothing on them. */
  stages: Partial<Record<ReleaseTrack, StageRelease>>
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


  /**
   * Every app, its testers, and what is waiting on each stage.
   *
   * Exists because enrolment was only ever reachable one app at a time, from
   * inside that app's page. That answers "who tests this?" and never "what is
   * this person testing?" or "which builds are sitting on Staging with nobody
   * to try them?" — which are the questions somebody actually running a test
   * cycle has.
   *
   * Three queries stitched in memory rather than one join: the join would
   * multiply apps by testers by releases and then need unpicking anyway, and
   * these tables are small enough per org that the extra round trips cost less
   * than the fan-out would.
   */
  async overview(orgId: string): Promise<TestingApp[]> {
    return withTenant(this.db, orgId, async (tx) => {
      const apps = [
        ...(await tx.execute<{ id: string; slug: string; name: string; platform: string }>(sql`
          SELECT id, slug, name, platform::text AS platform FROM apps ORDER BY name
        `)),
      ]

      const testers = [
        ...(await tx.execute<{
          app_id: string
          user_id: string
          email: string
          display_name: string
          track: string
          created_at: string
        }>(sql`
          SELECT t.app_id, t.user_id, u.email, u.display_name,
                 t.track::text AS track, t.created_at
          FROM app_testers t
          JOIN users u ON u.id = t.user_id
          ORDER BY u.display_name
        `)),
      ]

      /*
       * DISTINCT ON gives the newest release per (app, track) in one pass.
       * Ordering by updated_at rather than version is deliberate — versions are
       * free text ("9.2 (941607204)"), so sorting by them lexically would put
       * 1.10 behind 1.9.
       */
      const staged = [
        ...(await tx.execute<{
          app_id: string
          track: string
          version: string
          status: string
          updated_at: string
        }>(sql`
          SELECT DISTINCT ON (app_id, track)
                 app_id, track::text AS track, version, status::text AS status, updated_at
          FROM releases
          ORDER BY app_id, track, updated_at DESC
        `)),
      ]

      const testersByApp = new Map<string, Tester[]>()
      for (const row of testers) {
        const entry: Tester = {
          userId: row.user_id,
          email: row.email,
          displayName: row.display_name,
          track: row.track as ReleaseTrack,
          createdAt: new Date(row.created_at).toISOString(),
        }
        testersByApp.set(row.app_id, [...(testersByApp.get(row.app_id) ?? []), entry])
      }

      const stagesByApp = new Map<string, Partial<Record<ReleaseTrack, StageRelease>>>()
      for (const row of staged) {
        const current = stagesByApp.get(row.app_id) ?? {}
        current[row.track as ReleaseTrack] = {
          version: row.version,
          status: row.status,
          updatedAt: new Date(row.updated_at).toISOString(),
        }
        stagesByApp.set(row.app_id, current)
      }

      return apps.map((app) => ({
        slug: app.slug,
        name: app.name,
        platform: app.platform,
        testers: testersByApp.get(app.id) ?? [],
        stages: stagesByApp.get(app.id) ?? {},
      }))
    })
  }

  /**
   * Enrols one person across several apps in a single request.
   *
   * Delegates to enrol() per app rather than writing a bulk INSERT, so the
   * membership check, the upsert semantics and the audit event stay in exactly
   * one place. Failures are collected instead of aborting: enrolling somebody
   * in six apps should not silently succeed for four and lose the reason the
   * other two did not.
   */
  async enrolMany(
    orgId: string,
    actorId: string,
    slugs: string[],
    email: string,
    track: ReleaseTrack,
  ): Promise<{ enrolled: Tester[]; failed: { slug: string; reason: string }[] }> {
    const enrolled: Tester[] = []
    const failed: { slug: string; reason: string }[] = []

    for (const slug of slugs) {
      try {
        enrolled.push(await this.enrol(orgId, actorId, slug, email, track))
      } catch (error) {
        failed.push({
          slug,
          reason: error instanceof Error ? error.message : 'Could not enrol',
        })
      }
    }

    return { enrolled, failed }
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
