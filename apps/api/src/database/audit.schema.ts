import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations, users } from './schema'

/**
 * The append-only record of privileged actions.
 *
 * Append-only is enforced by GRANT, not by this file and not by AuditService:
 * migration 0007 revokes UPDATE and DELETE on this table from `app_runtime`,
 * so the only writes the application can physically perform are inserts. An
 * audit log an application bug can rewrite is not an audit log.
 *
 * `subjectId` is text rather than uuid on purpose. Not every auditable subject
 * is a row — an org slug, a storage key or an email are all legitimate
 * subjects, and a uuid column would force the interesting ones into metadata.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Null for system-originated events, and for actions whose actor was later deleted. */
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    /** Dotted past-tense verb, e.g. `release.published`. */
    action: text('action').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_events_org_created_idx').on(table.orgId, table.createdAt)],
)
