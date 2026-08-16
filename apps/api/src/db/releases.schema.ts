import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations, users } from './schema'
import { appPlatform, apps } from './apps.schema'

export const releaseStatus = pgEnum('release_status', ['draft', 'published', 'unpublished'])

/**
 * One publishable version of an app. A release is per-platform: the same
 * product ships different version strings on each store, so "Instagram 442.0.0
 * (iOS)" and "Instagram 374.0.0.43.67 (Android)" are two releases under one app.
 *
 * `org_id` is carried here rather than joined through `apps` so the RLS policy
 * is a plain column comparison — the same shape every other tenant table uses,
 * and what the catalog-driven invariant test in rls-invariants.spec.ts expects.
 */
export const releases = pgTable(
  'releases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    platform: appPlatform('platform').notNull(),
    /** Display version, e.g. "11.1.1". */
    version: text('version').notNull(),
    /** Android versionCode / iOS CFBundleVersion — monotonic build number. */
    buildNumber: text('build_number'),
    /** Lowest OS this build runs on, e.g. "API 23" or "iOS 16.1". */
    minOs: text('min_os').notNull().default(''),
    releaseNotes: text('release_notes').notNull().default(''),
    status: releaseStatus('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('releases_app_platform_version_key').on(
      table.appId,
      table.platform,
      table.version,
    ),
    index('releases_org_app_idx').on(table.orgId, table.appId),
  ],
)

/**
 * The binary behind a release, stored content-addressed by SHA-256.
 *
 * `(org_id, sha256)` is unique rather than sha256 alone: content addressing is
 * per-tenant (ToR §Storage), so two organizations uploading an identical file
 * each keep their own object and neither can probe for the other's existence.
 */
export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    /** Package name (Android) or bundle identifier (iOS). */
    packageId: text('package_id').notNull(),
    /** Path in the object store, derived from the digest — never from the filename. */
    storageKey: text('storage_key').notNull(),
    sha256: text('sha256').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    contentType: text('content_type').notNull(),
    /** Original upload filename, kept for display and download headers only. */
    originalFilename: text('original_filename').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('artifacts_org_sha256_key').on(table.orgId, table.sha256),
    index('artifacts_release_idx').on(table.releaseId),
  ],
)
