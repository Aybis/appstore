import './src/config/load-env'
import { migrationUrl } from './src/config/migration-url'
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Migrations run as the schema owner, never as app_runtime (which has no
  // CREATE privilege) and never through the Supabase pooler — see migration-url.ts.
  dbCredentials: { url: migrationUrl() },
} satisfies Config
