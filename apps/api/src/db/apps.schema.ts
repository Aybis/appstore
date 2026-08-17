import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations, users } from './schema'

export const appPlatform = pgEnum('app_platform', ['android', 'ios', 'both'])

export const apps = pgTable(
  'apps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('uncategorized'),
    platform: appPlatform('platform').notNull(),
    /** Short one-liner for cards; describes the product, not a build. */
    tagline: text('tagline').notNull().default(''),
    publisher: text('publisher').notNull().default(''),
    featured: boolean('featured').notNull().default(false),
    /** Denormalised aggregate — ratings themselves are a later phase (FR-5.x). */
    rating: real('rating').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    screenshotUrls: text('screenshot_urls').array().notNull().default([]),
    /**
     * Oldest build still allowed to run. A client reporting below this is told
     * the update is mandatory. Empty means never force.
     */
    minimumVersion: text('minimum_version').notNull().default(''),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('apps_org_slug_key').on(table.orgId, table.slug),
    index('apps_org_featured_idx').on(table.orgId, table.featured),
  ],
)
