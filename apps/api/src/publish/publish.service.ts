import path from 'node:path'
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { CreateAppInput, CreateReleaseInput } from '@appstore/shared'
import type { ReleaseTrack } from '../catalog/catalog.service'
import { AuditService } from '../audit/audit.service'
import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'
import { ArtifactStore } from '../storage/artifact-store'

const UNIQUE_VIOLATION = '23505'

export interface PublishedApp extends Record<string, unknown> {
  id: string
  slug: string
}

export interface PublishedRelease {
  id: string
  version: string
  platform: 'android' | 'ios'
  status: string
  track: string
  sha256: string
  sizeBytes: number
  deduplicated: boolean
}

/**
 * drizzle wraps driver errors in DrizzleQueryError and puts the PostgresError
 * on `cause`, so checking only the top-level code silently never matches and
 * a duplicate surfaces as a 500 instead of a 409.
 */
const isUniqueViolation = (error: unknown): boolean => {
  for (let current = error; current != null; current = (current as { cause?: unknown }).cause) {
    if (
      typeof current === 'object' &&
      'code' in current &&
      (current as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return true
    }
  }
  return false
}

const CONTENT_TYPES: Record<string, string> = {
  '.apk': 'application/vnd.android.package-archive',
  '.ipa': 'application/octet-stream',
}

/**
 * Publisher-side writes: create an app, upload a build, publish it.
 *
 * Replaces the ingest script as the way binaries enter the catalog — the script
 * reads a local folder and talks to the database directly, which only works on
 * the machine holding the files.
 */
@Injectable()
export class PublishService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly store: ArtifactStore,
    private readonly audit: AuditService,
  ) {}

  async createApp(
    orgId: string,
    userId: string,
    input: CreateAppInput,
  ): Promise<PublishedApp> {
    const created = await withTenant(this.db, orgId, async (tx) => {
      const rows = await tx.execute<PublishedApp>(sql`
        INSERT INTO apps (org_id, slug, name, description, category, platform,
                          tagline, publisher, featured, minimum_version, created_by)
        VALUES (${orgId}::uuid, ${input.slug}, ${input.name}, ${input.description},
                ${input.category}, ${input.platform}::app_platform, ${input.tagline},
                ${input.publisher}, ${input.featured}, ${input.minimumVersion},
                ${userId}::uuid)
        ON CONFLICT (org_id, slug) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          platform = excluded.platform,
          tagline = excluded.tagline,
          publisher = excluded.publisher,
          featured = excluded.featured,
          minimum_version = excluded.minimum_version,
          updated_at = now()
        RETURNING id, slug, (xmax = 0) AS inserted
      `)
      return [...rows][0]!
    })

    // xmax is 0 only on a row this statement inserted; ON CONFLICT DO UPDATE
    // leaves the updating transaction's id there. It is the one way to tell
    // the two outcomes of an upsert apart, and the audit trail is materially
    // worse without it — "created HR Portal" and "rewrote HR Portal's
    // metadata" are different events to whoever reads this later.
    const { inserted, ...app } = created as PublishedApp & { inserted: boolean }
    await this.audit.record(orgId, {
      actorId: userId,
      action: inserted ? 'app.created' : 'app.updated',
      subjectType: 'app',
      subjectId: input.slug,
      metadata: { name: input.name, platform: input.platform },
    })

    return app as PublishedApp
  }

  /**
   * Stores the uploaded binary and records a release plus its artifact.
   *
   * The artifact is written to the content-addressed store BEFORE the rows are
   * inserted, so a failed insert leaves an orphaned object rather than a row
   * pointing at nothing — the former is recoverable by a sweep, the latter
   * breaks every download of that release.
   */
  async createRelease(
    orgId: string,
    userId: string,
    slug: string,
    input: CreateReleaseInput,
    upload: { tempPath: string; originalName: string },
  ): Promise<PublishedRelease> {
    const extension = path.extname(upload.originalName).toLowerCase()
    const stored = await this.store.put(orgId, upload.tempPath, extension)

    const release = await withTenant(this.db, orgId, async (tx) => {
      const apps = await tx.execute<{ id: string }>(sql`
        SELECT id FROM apps WHERE slug = ${slug}
      `)
      const app = [...apps][0]
      if (!app) throw new NotFoundException(`No app with slug "${slug}"`)

      let releaseId: string
      try {
        const releases = await tx.execute<{ id: string }>(sql`
          INSERT INTO releases (org_id, app_id, platform, version, min_os,
                                release_notes, status, published_at, created_by, track)
          VALUES (${orgId}::uuid, ${app.id}::uuid, ${input.platform}::app_platform,
                  ${input.version}, ${input.minOs}, ${input.releaseNotes},
                  ${input.publish ? 'published' : 'draft'}::release_status,
                  ${input.publish ? sql`now()` : null}, ${userId}::uuid,
                  ${input.track}::release_track)
          RETURNING id
        `)
        releaseId = [...releases][0]!.id
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Re-publishing a version would change what an already-installed
          // build means. A new build needs a new version.
          throw new ConflictException(
            `${slug} ${input.version} already exists for ${input.platform}`,
          )
        }
        throw error
      }

      await tx.execute(sql`
        INSERT INTO artifacts (org_id, release_id, package_id, storage_key, sha256,
                               size_bytes, content_type, original_filename)
        VALUES (${orgId}::uuid, ${releaseId}::uuid, ${input.packageId},
                ${stored.storageKey}, ${stored.sha256}, ${stored.sizeBytes},
                ${CONTENT_TYPES[extension] ?? 'application/octet-stream'},
                ${upload.originalName})
      `)

      return {
        id: releaseId,
        version: input.version,
        platform: input.platform,
        status: input.publish ? 'published' : 'draft',
        track: input.track,
        sha256: stored.sha256,
        sizeBytes: stored.sizeBytes,
        deduplicated: stored.deduplicated,
      }
    })

    // Recorded after the transaction commits, not inside it. `record` opens its
    // own transaction, so auditing from within this one would leave a permanent
    // claim that a release exists even when the enclosing work rolls back — and
    // the log has no delete to walk that back with.
    await this.audit.record(orgId, {
      actorId: userId,
      action: release.status === 'published' ? 'release.published' : 'release.created',
      subjectType: 'release',
      subjectId: release.id,
      metadata: {
        app: slug,
        version: release.version,
        platform: release.platform,
        track: release.track,
        sha256: release.sha256,
        sizeBytes: release.sizeBytes,
        packageId: input.packageId,
      },
    })

    return release
  }

  /**
   * Moves a release along the promotion path. The build does NOT change — that
   * is the point: the binary QA smoke-tested is the binary that reaches
   * production, and re-uploading it would invalidate the testing.
   *
   * Promotion is one-directional. Pulling a bad build back is `unpublish`,
   * which withdraws it outright rather than pretending the people who already
   * installed it never received it.
   */
  async promoteRelease(
    orgId: string,
    userId: string,
    releaseId: string,
    track: ReleaseTrack,
  ): Promise<{ track: string; version: string }> {
    const promoted = await withTenant(this.db, orgId, async (tx) => {
      const rows = await tx.execute<{ track: string; version: string; previous: string }>(sql`
        UPDATE releases
        SET track = ${track}::release_track, updated_at = now()
        WHERE id = ${releaseId}::uuid
          -- Only forward. Without this a typo silently demotes a live build and
          -- it disappears from every ordinary member's catalog.
          AND array_position(ARRAY['internal','beta','production']::text[], ${track}::text)
              > array_position(ARRAY['internal','beta','production']::text[], track::text)
        RETURNING track, version, ${track}::text AS previous
      `)
      return [...rows][0]
    })

    if (!promoted) {
      throw new ConflictException(
        `Release is already at "${track}" or beyond — promotion only moves forward`,
      )
    }

    await this.audit.record(orgId, {
      actorId: userId,
      action: 'release.promoted',
      subjectType: 'release',
      subjectId: releaseId,
      metadata: { track, version: promoted.version },
    })

    return { track: promoted.track, version: promoted.version }
  }

  /** draft -> published. Immutability is enforced by trigger, not here. */
  async publishRelease(
    orgId: string,
    userId: string,
    releaseId: string,
  ): Promise<{ status: string }> {
    const published = await withTenant(this.db, orgId, async (tx) => {
      const rows = await tx.execute<{ status: string }>(sql`
        UPDATE releases
        SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now()
        WHERE id = ${releaseId}::uuid AND status <> 'published'
        RETURNING status
      `)
      const row = [...rows][0]
      if (!row) {
        throw new NotFoundException('No draft or unpublished release with that id')
      }
      return row
    })

    await this.audit.record(orgId, {
      actorId: userId,
      action: 'release.published',
      subjectType: 'release',
      subjectId: releaseId,
      metadata: {},
    })

    return published
  }
}
