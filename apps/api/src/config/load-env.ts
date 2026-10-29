import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/*
 * Loads the repo-root env file every app in this monorepo shares. Same depth
 * from src/config and dist/config, so it works under both `nest start` and
 * `node dist/main.js`.
 *
 *   .env               development: local Postgres, the dev bucket
 *   .env.production    production values, for the few jobs run from a laptop
 *                      (migrate, storage:tidy):  ENV_FILE=.env.production
 *
 * Variables that are already set win over the file, so Docker's env_file and
 * shell overrides (`PORT=4000 pnpm dev:api`) still apply. A missing .env is
 * normal — the Docker image has none — but a missing ENV_FILE is a typo, and
 * silently falling back to the dev file would run a "production" job on dev.
 */
const root = resolve(__dirname, '../../../..')
const chosen = process.env.ENV_FILE || undefined
const file = resolve(root, chosen ?? '.env')

if (existsSync(file)) process.loadEnvFile(file)
else if (chosen) throw new Error(`ENV_FILE=${chosen} not found at ${file}`)
