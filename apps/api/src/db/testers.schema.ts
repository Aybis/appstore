import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations, users } from './schema'
import { apps } from './apps.schema'

/**
 * Where a release sits on its way to everyone.
 *
 * `internal` — uploaded, visible to staff only, announced to nobody. This is
 *   where a build lands so QA can smoke-test it without the whole org being
 *   told a new version exists.
 * `beta` — visible to the app's enrolled testers, plus staff.
 * `production` — visible to every member of the org.
 */
export const releaseTrack = pgEnum('release_track', ['internal', 'beta', 'production'])

/**
 * Enrolment of one user as a tester of one app.
 *
 * Staff (publisher/admin/owner) are deliberately NOT rows here: their role
 * already grants pre-production visibility, and enrolling every publisher in
 * every app would make this table describe nothing.
 */
export const appTesters = pgTable(
  'app_testers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The earliest track this tester may see. `beta` is the ordinary case. */
    track: releaseTrack('track').notNull().default('beta'),
    /** Null survives deletion of the inviter — the enrolment outlives them. */
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('app_testers_app_user_key').on(table.appId, table.userId),
    index('app_testers_org_user_idx').on(table.orgId, table.userId),
  ],
)
