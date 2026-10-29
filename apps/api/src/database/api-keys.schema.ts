import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations, users } from './schema'

/**
 * The roles a machine credential may hold, as TypeScript sees them.
 *
 * Narrower than `membership_role`, matching the CHECK constraint. Typed
 * `text` rather than the shared pgEnum for a mechanical reason as well as a
 * semantic one: TypeScript emits `export *` re-exports BEFORE the const
 * declarations in the module it re-exports from, so importing an enum from
 * `./schema` here — where it is called eagerly at table-definition time —
 * reads `undefined`. The other schema files avoid this by only touching
 * `./schema` inside lazy `() =>` callbacks. The column type in Postgres is
 * still `membership_role`; this is how Drizzle refers to it, not what it is.
 */
export type ApiKeyRole = 'viewer' | 'publisher'

/**
 * Credentials for machines — a build server pushing a release.
 *
 * The role is capped at `publisher` by a CHECK CONSTRAINT in migration 0011,
 * not by anything in this file and not by anything in the service layer
 * (security review S-8). Drizzle cannot express that cap, so the enum below
 * still admits `admin` and `owner` at the type level and the database refuses
 * them at write time. That asymmetry is deliberate: a check in TypeScript
 * protects the paths somebody remembered to route through it, and a CI key
 * able to mint admins is a privilege-escalation primitive. CI tokens leak into
 * build logs, repository forks and shared screens far more readily than
 * passwords do.
 *
 * The secret itself is never stored — only its argon2id hash, exactly as
 * passwords are. `prefix` exists so the console can name a key without ever
 * holding the secret that would let it act.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Human label — "GitHub Actions", "Jenkins nightly". */
    name: text('name').notNull(),
    /** Identifies the key without authenticating it. Shown in the UI. */
    prefix: text('prefix').notNull(),
    secretHash: text('secret_hash').notNull(),
    role: text('role').$type<ApiKeyRole>().notNull().default('publisher'),
    /**
     * Null survives deletion of whoever minted it. A pipeline credential must
     * not disappear because the engineer who created it left — revoking it is
     * a decision somebody makes, not a side effect of offboarding.
     */
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    /** Not optional. A credential with no end date is one nobody revisits. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('api_keys_prefix_key').on(table.prefix),
    index('api_keys_org_idx').on(table.orgId, table.revokedAt),
  ],
)
