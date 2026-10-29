import { AnyPgColumn, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations, users } from './schema'

/**
 * One refresh session — issued at sign-in, rotated on every refresh.
 *
 * The token is never stored, only its SHA-256. A dump of this table must not
 * be a set of working credentials, for the same reason passwords are hashed.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the refresh token. Never the token. */
    tokenHash: text('token_hash').notNull(),
    /**
     * The session this one replaced.
     *
     * Keeping the chain is what makes replay detectable: presenting a token
     * that has already been rotated means somebody holds a copy, so the whole
     * line is revoked rather than just the one row.
     */
    rotatedFrom: uuid('rotated_from').references((): AnyPgColumn => sessions.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** logout | rotated | reuse_detected | membership_removed | password_changed */
    revokedReason: text('revoked_reason'),
    userAgent: text('user_agent').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_key').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId, table.revokedAt),
    index('sessions_org_idx').on(table.orgId),
  ],
)
