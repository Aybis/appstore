import path from 'node:path'
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { CreateAppInput, CreateReleaseInput } from '@appstore/shared'
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
  ) {}

  async createApp(
    orgId: string,
    userId: string,
    input: CreateAppInput,
  ): Promise<PublishedApp> {
    return withTenant(this.db, orgId, async (tx) => {
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
        RETURNING id, slug
      `)
      return [...rows][0]!
    })
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

    return withTenant(this.db, orgId, async (tx) => {
      const apps = await tx.execute<{ id: string }>(sql`
        SELECT id FROM apps WHERE slug = ${slug}
      `)
      const app = [...apps][0]
      if (!app) throw new NotFoundException(`No app with slug "${slug}"`)

      let releaseId: string
      try {
        const releases = await tx.execute<{ id: string }>(sql`
          INSERT INTO releases (org_id, app_id, platform, version, min_os,
                                release_notes, status, published_at, created_by)
          VALUES (${orgId}::uuid, ${app.id}::uuid, ${input.platform}::app_platform,
                  ${input.version}, ${input.minOs}, ${input.releaseNotes},
                  ${input.publish ? 'published' : 'draft'}::release_status,
                  ${input.publish ? sql`now()` : null}, ${userId}::uuid)
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
        ON CONFLICT (org_id, sha256) DO NOTHING
      `)

      return {
        id: releaseId,
        version: input.version,
        platform: input.platform,
        status: input.publish ? 'published' : 'draft',
        sha256: stored.sha256,
        sizeBytes: stored.sizeBytes,
        deduplicated: stored.deduplicated,
      }
    })
  }

  /** draft -> published. Immutability is enforced by trigger, not here. */
  async publishRelease(orgId: string, releaseId: string): Promise<{ status: string }> {
    return withTenant(this.db, orgId, async (tx) => {
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
  }
}
