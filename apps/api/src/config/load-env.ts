import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/*
 * Loads the repo-root .env, the one env file every app in this monorepo
 * shares. Same depth from src/config and dist/config, so it works under both
 * `nest start` and `node dist/main.js`.
 *
 * Variables that are already set win over the file, so Docker's env_file and
 * shell overrides (`PORT=4000 pnpm dev:api`) still apply. A missing file is
 * normal — the Docker image has none — and is not an error.
 */
const file = resolve(__dirname, '../../../../.env')
if (existsSync(file)) process.loadEnvFile(file)
