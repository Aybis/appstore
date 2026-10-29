import './src/config/load-env'
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Migrations run as the schema owner, never as app_runtime (which has no
  // CREATE privilege, so drizzle-kit would report success having done nothing).
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? '' },
} satisfies Config
