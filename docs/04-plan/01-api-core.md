# Plan 01 — Multi-Tenant API Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the multi-tenant foundation — an API where an organization signs up, its members authenticate, and a publisher uploads and publishes an immutable release that only that organization's members can download, with every privileged action audited and tenant isolation enforced by the database itself.

**Architecture:** A NestJS monolith over Postgres. Tenant isolation is defense-in-depth: the service layer scopes every query by `org_id`, *and* Postgres Row Level Security independently rejects cross-tenant reads even if the service layer has a bug. Every request that touches tenant data runs inside `withTenant()`, a transaction helper that drops to the non-privileged `app_runtime` role and sets `app.current_org_id` for the life of the transaction. Binaries never pass through the API process — uploads stream to S3-compatible storage while hashing, and downloads are short-lived presigned URLs.

**Tech Stack:** NestJS 11 · Postgres 16 + Drizzle ORM · postgres.js driver · Zod + nestjs-zod · argon2 · `@aws-sdk/client-s3` + `lib-storage` · busboy · pino · Vitest + `unplugin-swc` + Supertest + Testcontainers

## Global Constraints

Read [`00-overview.md`](00-overview.md#global-constraints). Every task inherits that section. The three that bite hardest in this plan:

- The runtime role must not have `BYPASSRLS`; `withTenant()` is the only sanctioned path to tenant data.
- Content-addressed storage keys are **per-org** — never dedupe binaries across organizations.
- Published releases have no mutation path.

---

### Task 1: Monorepo skeleton and shared schema package

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.nvmrc`, `.env.example`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`, `packages/shared/src/identifiers.ts`
- Test: `packages/shared/src/identifiers.spec.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `orgSlugSchema: z.ZodString`, `appSlugSchema: z.ZodString`, `semverSchema: z.ZodString` exported from `@appstore/shared`. Later tasks import validation schemas from this package only.

- [ ] **Step 1: Initialize the workspace root**

```bash
pnpm init
node -e "require('fs').writeFileSync('.nvmrc','24\n')"
```

`.nvmrc` says **24**, not 22: the build machine runs Node 24.14.1, and pinning a
version that is not installed makes `nvm use` fail on a clean checkout. The
`engines` floor below stays at `>=22` — that is the compatibility contract, which
is a different thing from the version this machine develops on.

Replace the generated `package.json` with:

```json
{
  "name": "appstore",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Declare the workspace and base TypeScript config**

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- [ ] **Step 3: Scaffold the shared package**

```bash
mkdir -p packages/shared/src
```

`packages/shared/package.json`:

```json
{
  "name": "@appstore/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { globals: true, environment: 'node', include: ['src/**/*.spec.ts'] },
})
```

- [ ] **Step 4: Write the failing test**

`packages/shared/src/identifiers.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { appSlugSchema, orgSlugSchema, semverSchema } from './identifiers.js'

describe('orgSlugSchema', () => {
  it('accepts lowercase alphanumeric slugs with internal hyphens', () => {
    expect(orgSlugSchema.parse('acme-corp')).toBe('acme-corp')
  })

  it('rejects uppercase', () => {
    expect(() => orgSlugSchema.parse('Acme')).toThrow()
  })

  it('rejects leading and trailing hyphens', () => {
    expect(() => orgSlugSchema.parse('-acme')).toThrow()
    expect(() => orgSlugSchema.parse('acme-')).toThrow()
  })

  it('rejects reserved slugs that would collide with API routes', () => {
    expect(() => orgSlugSchema.parse('api')).toThrow()
    expect(() => orgSlugSchema.parse('admin')).toThrow()
  })

  it('rejects slugs shorter than 3 or longer than 63 characters', () => {
    expect(() => orgSlugSchema.parse('ab')).toThrow()
    expect(() => orgSlugSchema.parse('a'.repeat(64))).toThrow()
  })
})

describe('semverSchema', () => {
  it('accepts a plain major.minor.patch', () => {
    expect(semverSchema.parse('1.2.3')).toBe('1.2.3')
  })

  it('accepts a prerelease suffix', () => {
    expect(semverSchema.parse('1.2.3-rc.1')).toBe('1.2.3-rc.1')
  })

  it('rejects a two-part version', () => {
    expect(() => semverSchema.parse('1.2')).toThrow()
  })
})

describe('appSlugSchema', () => {
  it('does not reserve route names, because app slugs are org-scoped', () => {
    expect(appSlugSchema.parse('api')).toBe('api')
  })
})
```

- [ ] **Step 5: Run the test and confirm it fails**

```bash
pnpm --filter @appstore/shared test
```

Expected: FAIL — `Failed to resolve import "./identifiers.js"`.

- [ ] **Step 6: Implement the schemas**

`packages/shared/src/identifiers.ts`:

```ts
import { z } from 'zod'

/** Slugs that would collide with top-level API routes or reserved subdomains. */
const RESERVED_ORG_SLUGS = new Set([
  'api', 'admin', 'www', 'app', 'auth', 'billing', 'static', 'assets', 'health',
])

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

const baseSlug = z
  .string()
  .min(3, 'must be at least 3 characters')
  .max(63, 'must be at most 63 characters')
  .regex(SLUG_PATTERN, 'must be lowercase alphanumeric with internal hyphens only')

/** Org slugs are globally unique and appear in URLs, so reserved names are excluded. */
export const orgSlugSchema = baseSlug.refine(
  (value) => !RESERVED_ORG_SLUGS.has(value),
  { message: 'this slug is reserved' },
)

/** App slugs are unique only within an org, so they need no reserved list. */
export const appSlugSchema = baseSlug

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/

export const semverSchema = z.string().regex(SEMVER_PATTERN, 'must be a valid semantic version')
```

`packages/shared/src/index.ts`:

```ts
export * from './identifiers.js'
```

- [ ] **Step 7: Run the test and confirm it passes**

```bash
pnpm --filter @appstore/shared test
```

Expected: PASS — 9 tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(shared): add org, app, and semver identifier schemas"
```

---

### Task 2: NestJS API bootstrap with typed configuration

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/.swcrc`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Create: `apps/api/src/config/env.ts`, `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.module.ts`
- Test: `apps/api/src/config/env.spec.ts`, `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: `@appstore/shared` (workspace dependency, not yet used at runtime)
- Produces: `loadEnv(source: NodeJS.ProcessEnv): Env` where `Env = { NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY }`. `AppModule` is the root Nest module every later task registers into.

- [ ] **Step 1: Scaffold the API package**

```bash
mkdir -p apps/api/src apps/api/test
```

`apps/api/package.json`:

```json
{
  "name": "@appstore/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start:dev": "nest start --watch",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@appstore/shared": "workspace:*",
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "nestjs-zod": "^4.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@swc/core": "^1.7.0",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "typescript": "^5.6.0",
    "unplugin-swc": "^1.5.1",
    "vitest": "^2.1.0"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": "."
  },
  "include": ["src/**/*", "test/**/*"]
}
```

`apps/api/nest-cli.json`:

```json
{ "$schema": "https://json.schemastore.org/nest-cli", "collection": "@nestjs/schematics", "sourceRoot": "src" }
```

- [ ] **Step 2: Configure Vitest for NestJS decorators**

NestJS dependency injection relies on `emitDecoratorMetadata`, which esbuild — Vitest's default transformer — does not support. `unplugin-swc` is required; without it every `@Injectable()` provider fails to resolve its constructor parameters at runtime.

`apps/api/.swcrc`:

```json
{
  "$schema": "https://swc.rs/schema.json",
  "jsc": {
    "target": "es2022",
    "parser": { "syntax": "typescript", "decorators": true },
    "transform": { "legacyDecorator": true, "decoratorMetadata": true },
    "baseUrl": "./"
  },
  "module": { "type": "commonjs" }
}
```

`apps/api/vitest.config.ts`:

```ts
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  plugins: [swc.vite({ module: { type: 'commonjs' } })],
})
```

`singleFork` matters: later tasks share one Postgres container across suites, and parallel forks would race on migrations.

- [ ] **Step 3: Write the failing config test**

`apps/api/src/config/env.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/appstore',
  JWT_SECRET: 'a'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'artifacts',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
}

describe('loadEnv', () => {
  it('parses a valid environment and coerces PORT to a number', () => {
    const env = loadEnv(validEnv)
    expect(env.PORT).toBe(3000)
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL)
  })

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/)
  })

  it('rejects a missing DATABASE_URL rather than defaulting', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = validEnv
    expect(() => loadEnv(withoutDb)).toThrow(/DATABASE_URL/)
  })

  it('names every invalid variable in the error message', () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: 'x', S3_BUCKET: '' })).toThrow(/S3_BUCKET/)
  })
})
```

- [ ] **Step 4: Run the test and confirm it fails**

```bash
pnpm --filter @appstore/api test src/config/env.spec.ts
```

Expected: FAIL — cannot resolve `./env`.

- [ ] **Step 5: Implement typed configuration**

`apps/api/src/config/env.ts`:

```ts
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

/**
 * Fails fast at boot with every invalid variable named at once, rather than
 * surfacing a misconfiguration as a runtime error hours later.
 */
export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration — ${detail}`)
  }
  return result.data
}

export const ENV = Symbol('ENV')
```

- [ ] **Step 6: Run the test and confirm it passes**

```bash
pnpm --filter @appstore/api test src/config/env.spec.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 7: Write the failing health endpoint test**

`apps/api/test/health.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module'

describe('GET /health', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 200 with a status body', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200)
    expect(response.body).toMatchObject({ status: 'ok' })
  })
})
```

- [ ] **Step 8: Run the test and confirm it fails**

```bash
pnpm --filter @appstore/api test test/health.e2e-spec.ts
```

Expected: FAIL — cannot resolve `../src/app.module`.

- [ ] **Step 9: Implement the health module and bootstrap**

`apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' }
  }
}
```

`apps/api/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

`apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { HealthModule } from './health/health.module'

@Module({ imports: [HealthModule] })
export class AppModule {}
```

`apps/api/src/main.ts`:

```ts
import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { loadEnv } from './config/env'

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env)
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('v1', { exclude: ['health'] })
  await app.listen(env.PORT)
  new Logger('bootstrap').log(`API listening on port ${env.PORT}`)
}

void bootstrap()
```

- [ ] **Step 10: Run the test and confirm it passes**

```bash
pnpm --filter @appstore/api test
```

Expected: PASS — 5 tests across both files.

- [ ] **Step 11: Document the environment contract**

`.env.example` at the repository root:

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://appstore:appstore@localhost:5432/appstore
JWT_SECRET=replace-with-at-least-32-random-characters
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=artifacts
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

Confirm `.env` is already ignored:

```bash
grep -q '^\.env$' .gitignore || echo '.env' >> .gitignore
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(api): bootstrap NestJS with typed env config and health endpoint"
```

---

### Task 3: Postgres schema, Drizzle, and the Testcontainers harness

**Files:**
- Create: `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`, `apps/api/drizzle.config.ts`
- Create: `apps/api/test/support/postgres.global.ts`, `apps/api/test/support/db.ts`
- Modify: `apps/api/vitest.config.ts` (register `globalSetup`)
- Test: `apps/api/src/db/schema.spec.ts`

**Interfaces:**
- Consumes: `loadEnv` from Task 2
- Produces: Drizzle tables `organizations`, `users`, `memberships` and the enum `membershipRole` (`'owner' | 'admin' | 'publisher' | 'viewer'`); `createDb(url: string): Database` where `Database = NodePgDatabase<typeof schema>`; test helper `useTestDb(): { db: Database; url: string }`

- [ ] **Step 1: Install database dependencies**

```bash
pnpm --filter @appstore/api add drizzle-orm postgres
pnpm --filter @appstore/api add -D drizzle-kit @testcontainers/postgresql testcontainers
```

- [ ] **Step 2: Define the core schema**

`apps/api/src/db/schema.ts`:

```ts
import { pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const membershipRole = pgEnum('membership_role', ['owner', 'admin', 'publisher', 'viewer'])

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('organizations_slug_key').on(table.slug)],
)

/**
 * Users are global, not per-org: one person may belong to several customer
 * organizations with a different role in each. The org relationship lives
 * entirely in `memberships`.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_key').on(table.email)],
)

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('memberships_org_user_key').on(table.orgId, table.userId)],
)
```

- [ ] **Step 3: Create the Drizzle client and config**

`apps/api/src/db/client.ts`:

```ts
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

export function createDb(url: string): { db: Database; close: () => Promise<void> } {
  // max: 1 during tests keeps SET LOCAL ROLE deterministic; production tunes this
  // via the pool size, but every tenant-scoped statement runs inside its own
  // transaction so connection reuse is safe.
  const sql = postgres(url, { max: 10, prepare: false })
  return { db: drizzle(sql, { schema }), close: async () => { await sql.end() } }
}

export { schema }
```

`apps/api/drizzle.config.ts`:

```ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
} satisfies Config
```

- [ ] **Step 4: Generate the initial migration**

```bash
pnpm --filter @appstore/api exec drizzle-kit generate --name init_core
```

Expected: a file appears at `apps/api/drizzle/0000_init_core.sql` containing `CREATE TABLE organizations`, `users`, `memberships` and `CREATE TYPE membership_role`. Read it and confirm before continuing.

- [ ] **Step 5: Write the Testcontainers global setup**

`apps/api/test/support/postgres.global.ts`:

```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { GlobalSetupContext } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    postgresUrl: string
  }
}

let container: StartedPostgreSqlContainer

export async function setup({ provide }: GlobalSetupContext): Promise<void> {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('appstore')
    .withUsername('appstore')
    .withPassword('appstore')
    .start()
  provide('postgresUrl', container.getConnectionUri())
}

export async function teardown(): Promise<void> {
  await container?.stop()
}
```

- [ ] **Step 6: Write the per-suite database helper**

`apps/api/test/support/db.ts`:

```ts
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, inject } from 'vitest'
import { createDb, type Database } from '../../src/db/client'

export interface TestDb {
  get db(): Database
  get url(): string
}

/**
 * Migrates once per suite against the shared container and truncates between
 * tests, so suites stay independent without paying container startup per file.
 */
export function useTestDb(): TestDb {
  let db: Database
  let close: () => Promise<void>
  let url: string

  beforeAll(async () => {
    url = inject('postgresUrl')
    const created = createDb(url)
    db = created.db
    close = created.close
    await migrate(db, { migrationsFolder: `${__dirname}/../../drizzle` })
  })

  afterAll(async () => {
    await close?.()
  })

  return {
    get db() { return db },
    get url() { return url },
  }
}

/** Removes all tenant data. Order does not matter — CASCADE handles dependents. */
export async function truncateAll(db: Database): Promise<void> {
  await db.execute(sql`TRUNCATE organizations, users RESTART IDENTITY CASCADE`)
}
```

- [ ] **Step 7: Register the global setup**

In `apps/api/vitest.config.ts`, add `globalSetup` inside the `test` block:

```ts
    globalSetup: ['./test/support/postgres.global.ts'],
```

- [ ] **Step 8: Write the failing schema test**

`apps/api/src/db/schema.spec.ts`:

```ts
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { memberships, organizations, users } from './schema'

describe('core schema', () => {
  const ctx = useTestDb()

  beforeEach(async () => {
    await truncateAll(ctx.db)
  })

  it('stores an organization with a generated id', async () => {
    const [org] = await ctx.db
      .insert(organizations)
      .values({ slug: 'acme-corp', name: 'Acme Corp' })
      .returning()
    expect(org?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('rejects a duplicate organization slug', async () => {
    await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' })
    await expect(
      ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme Two' }),
    ).rejects.toThrow(/organizations_slug_key/)
  })

  it('links a user to an organization through a membership', async () => {
    const [org] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    const [user] = await ctx.db
      .insert(users)
      .values({ email: 'lee@acme.test', passwordHash: 'x', displayName: 'Lee' })
      .returning()

    await ctx.db.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: 'owner' })

    const found = await ctx.db.select().from(memberships).where(eq(memberships.userId, user!.id))
    expect(found).toHaveLength(1)
    expect(found[0]?.role).toBe('owner')
  })

  it('allows one user to hold different roles in two organizations', async () => {
    const [first] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    const [second] = await ctx.db.insert(organizations).values({ slug: 'globex-inc', name: 'Globex' }).returning()
    const [user] = await ctx.db
      .insert(users)
      .values({ email: 'lee@acme.test', passwordHash: 'x', displayName: 'Lee' })
      .returning()

    await ctx.db.insert(memberships).values([
      { orgId: first!.id, userId: user!.id, role: 'owner' },
      { orgId: second!.id, userId: user!.id, role: 'viewer' },
    ])

    const found = await ctx.db.select().from(memberships).where(eq(memberships.userId, user!.id))
    expect(found).toHaveLength(2)
  })

  it('rejects a second membership for the same user in the same organization', async () => {
    const [org] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    const [user] = await ctx.db
      .insert(users)
      .values({ email: 'lee@acme.test', passwordHash: 'x', displayName: 'Lee' })
      .returning()

    await ctx.db.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: 'owner' })
    await expect(
      ctx.db.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: 'viewer' }),
    ).rejects.toThrow(/memberships_org_user_key/)
  })
})
```

- [ ] **Step 9: Run the test**

```bash
pnpm --filter @appstore/api test src/db/schema.spec.ts
```

Expected: PASS — 5 tests. First run pulls the `postgres:16-alpine` image, so allow a minute. If Docker is not running, the error is `Could not find a working container runtime strategy` — start Docker and retry.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(api): add core schema, Drizzle client, and Testcontainers harness"
```

---

### Task 4: Row Level Security and the tenant transaction boundary

This is the task the whole multi-tenant claim rests on. Everything else assumes it holds.

**Files:**
- Create: `apps/api/drizzle/0001_rls.sql`, `apps/api/src/db/tenant.ts`
- Create: `apps/api/src/db/apps.schema.ts`
- Modify: `apps/api/src/db/schema.ts` (re-export the apps table)
- Test: `apps/api/src/db/tenant.spec.ts`

**Interfaces:**
- Consumes: `Database` from Task 3
- Produces: `withTenant<T>(db: Database, orgId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T>` and the type `TenantTx`. **Every later task reaches tenant data only through this function.**

- [ ] **Step 1: Add a tenant-scoped table to test isolation against**

`apps/api/src/db/apps.schema.ts`:

```ts
import { pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
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
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('apps_org_slug_key').on(table.orgId, table.slug)],
)
```

Append to `apps/api/src/db/schema.ts`:

```ts
export * from './apps.schema'
```

Generate the migration:

```bash
pnpm --filter @appstore/api exec drizzle-kit generate --name add_apps
```

- [ ] **Step 2: Write the RLS migration by hand**

Drizzle Kit does not generate RLS policies, so this migration is authored directly. Create `apps/api/drizzle/0002_rls.sql` (adjust the number if generation produced a different sequence):

```sql
-- The app_runtime role is NOT created here. It is a cluster-level object owned by
-- infra/local/bootstrap.sql (local) and infra/supabase/bootstrap.sql (hosted), both
-- of which run once, before any migration. Two reasons it does not belong in a
-- migration: creating roles needs privileges migrations should not have to assume,
-- and the two targets need different variants (LOGIN with a password locally,
-- NOLOGIN on Supabase where the app authenticates as `postgres` and drops into it).
--
-- This migration fails loudly if the bootstrap has not been run, rather than
-- silently producing tables with no grants.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    RAISE EXCEPTION 'role app_runtime is missing - run infra/local/setup.sh (or infra/supabase/bootstrap.sql) before migrating';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

-- FORCE is what makes this real: without it the table owner silently bypasses
-- every policy below, and the tests would pass while production leaked.
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps FORCE ROW LEVEL SECURITY;

-- The NULLIF is load-bearing, and the reason is not obvious.
--
-- current_setting('app.current_org_id', true) returns NULL only while the GUC
-- has NEVER been set on this backend. Once set_config has run once, unwinding
-- the LOCAL setting at COMMIT leaves the GUC as '' (EMPTY STRING), not NULL.
-- On a pooled connection that is the ordinary state of every reused backend.
--
-- Without NULLIF, ''::uuid raises 22P02 invalid_text_representation, so an
-- unscoped query ERRORS instead of returning zero rows -- a policy that throws
-- is not a policy that denies. Verified empirically against PostgreSQL 15.18.
CREATE POLICY apps_tenant_isolation ON apps
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY memberships_tenant_isolation ON memberships
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
```

`organizations` and `users` stay outside RLS: signup and login must read them *before* any org context exists. They are reached only through explicitly unscoped repository methods, which Task 5 and Task 6 keep narrow.

- [ ] **Step 3: Write the failing isolation test**

`apps/api/src/db/tenant.spec.ts`:

```ts
import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { apps } from './apps.schema'
import { organizations } from './schema'
import { withTenant } from './tenant'

describe('withTenant', () => {
  const ctx = useTestDb()
  let acmeId: string
  let globexId: string

  beforeEach(async () => {
    await truncateAll(ctx.db)
    const [acme] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    const [globex] = await ctx.db.insert(organizations).values({ slug: 'globex-inc', name: 'Globex' }).returning()
    acmeId = acme!.id
    globexId = globex!.id

    await withTenant(ctx.db, acmeId, (tx) =>
      tx.insert(apps).values({ orgId: acmeId, slug: 'payroll', name: 'Payroll', platform: 'android' }),
    )
    await withTenant(ctx.db, globexId, (tx) =>
      tx.insert(apps).values({ orgId: globexId, slug: 'logistics', name: 'Logistics', platform: 'ios' }),
    )
  })

  it('returns only the rows belonging to the scoped organization', async () => {
    const rows = await withTenant(ctx.db, acmeId, (tx) => tx.select().from(apps))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.slug).toBe('payroll')
  })

  it('hides another organization rows even from an unfiltered select', async () => {
    const rows = await withTenant(ctx.db, globexId, (tx) => tx.select().from(apps))
    expect(rows.map((row) => row.slug)).toEqual(['logistics'])
  })

  it('refuses to insert a row belonging to a different organization', async () => {
    await expect(
      withTenant(ctx.db, acmeId, (tx) =>
        tx.insert(apps).values({ orgId: globexId, slug: 'smuggled', name: 'Smuggled', platform: 'android' }),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('cannot update a row owned by another organization', async () => {
    const updated = await withTenant(ctx.db, acmeId, (tx) =>
      tx.update(apps).set({ name: 'Hijacked' }).returning(),
    )
    expect(updated).toHaveLength(1)
    expect(updated[0]?.slug).toBe('payroll')
  })

  it('sees no rows at all when no tenant context is set', async () => {
    const rows = await ctx.db.transaction(async (tx) => {
      // Drop privilege WITHOUT setting a tenant, proving the policy defaults to deny.
      await tx.execute(sql`SET LOCAL ROLE app_runtime`)
      return tx.select().from(apps)
    })
    expect(rows).toHaveLength(0)
  })

  /**
   * REGRESSION GUARD — do not delete, and do not "simplify" the NULLIF out of
   * the policy that makes it pass.
   *
   * After withTenant commits, the LOCAL GUC unwinds to '' (empty string), NOT
   * NULL. A policy predicate of `current_setting(...)::uuid` therefore raises
   * 22P02 on the next unscoped query instead of denying it. Because connections
   * are pooled, a reused backend is the ordinary case, not an edge case.
   *
   * This test runs an unscoped query AFTER a scoped one on the same pool, which
   * is precisely the sequence that fails without NULLIF.
   */
  it('still denies rather than errors after a previous transaction set the context', async () => {
    await withTenant(ctx.db, acmeId, (tx) => tx.select().from(apps))

    const leaked = await ctx.db.execute(
      sql`SELECT coalesce(current_setting('app.current_org_id', true), 'NULL') AS value`,
    )
    expect(leaked[0]?.value).toBe('')

    const rows = await ctx.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE app_runtime`)
      return tx.select().from(apps)
    })
    expect(rows).toHaveLength(0)
  })

  it('rolls back the whole transaction when the callback throws', async () => {
    await expect(
      withTenant(ctx.db, acmeId, async (tx) => {
        await tx.insert(apps).values({ orgId: acmeId, slug: 'temp', name: 'Temp', platform: 'android' })
        throw new Error('deliberate failure')
      }),
    ).rejects.toThrow('deliberate failure')

    const rows = await withTenant(ctx.db, acmeId, (tx) => tx.select().from(apps))
    expect(rows).toHaveLength(1)
  })
})
```

- [ ] **Step 4: Run the test and confirm it fails**

```bash
pnpm --filter @appstore/api test src/db/tenant.spec.ts
```

Expected: FAIL — cannot resolve `./tenant`.

- [ ] **Step 5: Implement the tenant boundary**

`apps/api/src/db/tenant.ts`:

```ts
import { sql } from 'drizzle-orm'
import type { PostgresJsDatabase, PostgresJsTransaction } from 'drizzle-orm/postgres-js'
import type { Database } from './client'
import type * as schema from './schema'

export type TenantTx = PostgresJsTransaction<typeof schema, Record<string, never>>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The single sanctioned path to tenant data.
 *
 * Opens a transaction, drops to the non-privileged `app_runtime` role, and binds
 * `app.current_org_id` for the transaction's lifetime. Both settings are LOCAL,
 * so they unwind on commit or rollback and cannot leak to the next borrower of
 * this pooled connection.
 *
 * `set_config` is used rather than `SET LOCAL` because only the former accepts a
 * bind parameter — interpolating the org id into a SET statement would be an
 * injection site.
 */
export async function withTenant<T>(
  db: Database,
  orgId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(orgId)) {
    throw new Error(`withTenant requires a UUID org id, received: ${orgId}`)
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_runtime`)
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`)
    return fn(tx as TenantTx)
  })
}

export type { PostgresJsDatabase }
```

- [ ] **Step 6: Run the test and confirm it passes**

```bash
pnpm --filter @appstore/api test src/db/tenant.spec.ts
```

Expected: PASS — 6 tests. The third test proving a cross-org insert is rejected is the load-bearing one; if it passes for the wrong reason (a foreign key error rather than an RLS error) the assertion regex will catch it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): enforce tenant isolation with RLS and a transaction boundary"
```

---

### Task 5: Password hashing and organization signup

**Files:**
- Create: `apps/api/src/auth/password.service.ts`, `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/orgs/signup.service.ts`, `apps/api/src/orgs/orgs.controller.ts`, `apps/api/src/orgs/orgs.module.ts`
- Create: `packages/shared/src/contracts/auth.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/app.module.ts`
- Test: `apps/api/src/auth/password.service.spec.ts`, `apps/api/src/orgs/signup.service.spec.ts`

**Interfaces:**
- Consumes: `withTenant` (Task 4), `organizations`/`users`/`memberships` (Task 3)
- Produces: `PasswordService.hash(plain: string): Promise<string>`, `PasswordService.verify(hash: string, plain: string): Promise<boolean>`; `SignupService.signUp(input: SignupInput): Promise<SignupResult>` where `SignupInput = { orgSlug: string; orgName: string; email: string; password: string; displayName: string }` and `SignupResult = { orgId: string; userId: string }`; `signupSchema` exported from `@appstore/shared`

- [ ] **Step 1: Install argon2**

```bash
pnpm --filter @appstore/api add argon2
```

- [ ] **Step 2: Write the failing password test**

`apps/api/src/auth/password.service.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PasswordService } from './password.service'

describe('PasswordService', () => {
  const service = new PasswordService()

  it('produces an argon2id hash', async () => {
    const hash = await service.hash('correct horse battery staple')
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  it('produces a different hash for the same password each time', async () => {
    const [first, second] = await Promise.all([service.hash('same'), service.hash('same')])
    expect(first).not.toBe(second)
  })

  it('verifies a correct password', async () => {
    const hash = await service.hash('correct horse battery staple')
    await expect(service.verify(hash, 'correct horse battery staple')).resolves.toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('correct horse battery staple')
    await expect(service.verify(hash, 'wrong')).resolves.toBe(false)
  })

  it('returns false rather than throwing on a malformed hash', async () => {
    await expect(service.verify('not-a-hash', 'anything')).resolves.toBe(false)
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test src/auth/password.service.spec.ts
```

Expected: FAIL — cannot resolve `./password.service`.

- [ ] **Step 4: Implement PasswordService**

`apps/api/src/auth/password.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import argon2 from 'argon2'

@Injectable()
export class PasswordService {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id })
  }

  /**
   * Returns false on malformed input instead of throwing: a corrupted stored
   * hash must read as "authentication failed", never as a 500 that tells an
   * attacker they found something interesting.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain)
    } catch {
      return false
    }
  }
}
```

- [ ] **Step 5: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test src/auth/password.service.spec.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 6: Define the shared signup contract**

`packages/shared/src/contracts/auth.ts`:

```ts
import { z } from 'zod'
import { orgSlugSchema } from '../identifiers.js'

export const signupSchema = z.object({
  orgSlug: orgSlugSchema,
  orgName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(12, 'password must be at least 12 characters').max(256),
  displayName: z.string().min(1).max(120),
})

export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  orgSlug: orgSlugSchema,
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>
```

Append to `packages/shared/src/index.ts`:

```ts
export * from './contracts/auth.js'
```

- [ ] **Step 7: Write the failing signup test**

`apps/api/src/orgs/signup.service.spec.ts`:

```ts
import { ConflictException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { PasswordService } from '../auth/password.service'
import { memberships, organizations, users } from '../db/schema'
import { SignupService } from './signup.service'

describe('SignupService', () => {
  const ctx = useTestDb()
  let service: SignupService

  const input = {
    orgSlug: 'acme-corp',
    orgName: 'Acme Corp',
    email: 'lee@acme.test',
    password: 'correct horse battery staple',
    displayName: 'Lee',
  }

  beforeEach(async () => {
    await truncateAll(ctx.db)
    service = new SignupService(ctx.db, new PasswordService())
  })

  it('creates the organization, the user, and an owner membership', async () => {
    const result = await service.signUp(input)

    const [org] = await ctx.db.select().from(organizations).where(eq(organizations.id, result.orgId))
    const [user] = await ctx.db.select().from(users).where(eq(users.id, result.userId))
    const found = await ctx.db.select().from(memberships).where(eq(memberships.orgId, result.orgId))

    expect(org?.slug).toBe('acme-corp')
    expect(user?.email).toBe('lee@acme.test')
    expect(found[0]?.role).toBe('owner')
  })

  it('never stores the password in plaintext', async () => {
    const result = await service.signUp(input)
    const [user] = await ctx.db.select().from(users).where(eq(users.id, result.userId))
    expect(user?.passwordHash).not.toContain('correct horse')
    expect(user?.passwordHash.startsWith('$argon2id$')).toBe(true)
  })

  it('normalizes the email to lowercase', async () => {
    const result = await service.signUp({ ...input, email: 'Lee@ACME.test' })
    const [user] = await ctx.db.select().from(users).where(eq(users.id, result.userId))
    expect(user?.email).toBe('lee@acme.test')
  })

  it('rejects a duplicate organization slug', async () => {
    await service.signUp(input)
    await expect(service.signUp({ ...input, email: 'other@acme.test' })).rejects.toBeInstanceOf(ConflictException)
  })

  it('leaves no orphaned organization when the user insert fails', async () => {
    await service.signUp(input)
    await expect(service.signUp({ ...input, orgSlug: 'globex-inc' })).rejects.toBeInstanceOf(ConflictException)

    const orgs = await ctx.db.select().from(organizations)
    expect(orgs.map((org) => org.slug)).toEqual(['acme-corp'])
  })
})
```

The last test is the one worth writing carefully: signup touches three tables, and a partial failure that leaves a nameless empty org behind is exactly the bug that shows up in production a month later.

- [ ] **Step 8: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test src/orgs/signup.service.spec.ts
```

Expected: FAIL — cannot resolve `./signup.service`.

- [ ] **Step 9: Implement SignupService**

`apps/api/src/orgs/signup.service.ts`:

```ts
import { ConflictException, Inject, Injectable } from '@nestjs/common'
import type { SignupInput } from '@appstore/shared'
import { sql } from 'drizzle-orm'
import { PasswordService } from '../auth/password.service'
import { DATABASE, type Database } from '../db/database.provider'
import { memberships, organizations, users } from '../db/schema'

export interface SignupResult {
  orgId: string
  userId: string
}

const UNIQUE_VIOLATION = '23505'

@Injectable()
export class SignupService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * Runs outside withTenant deliberately: the org does not exist yet, so there
   * is no tenant context to adopt. The whole thing is one transaction — a
   * half-created org with no owner is unrecoverable through the API.
   */
  async signUp(input: SignupInput): Promise<SignupResult> {
    const email = input.email.trim().toLowerCase()
    const passwordHash = await this.passwords.hash(input.password)

    try {
      return await this.db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({ slug: input.orgSlug, name: input.orgName })
          .returning()

        const [user] = await tx
          .insert(users)
          .values({ email, passwordHash, displayName: input.displayName })
          .returning()

        await tx.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: 'owner' })

        return { orgId: org!.id, userId: user!.id }
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('That organization slug or email is already registered')
      }
      throw error
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION
}
```

The membership insert runs on the owner role inside this transaction rather than through `withTenant`, because the org's first member must exist before any tenant context can name it. This is the only sanctioned bypass in the codebase, and it is why `memberships` policies use `FORCE` — a second bypass would not go unnoticed.

- [ ] **Step 10: Provide the database through Nest DI**

`apps/api/src/db/database.provider.ts`:

```ts
import { Global, Module, type Provider } from '@nestjs/common'
import { createDb, type Database } from './client'
import { loadEnv } from '../config/env'

export const DATABASE = Symbol('DATABASE')
export type { Database }

const databaseProvider: Provider = {
  provide: DATABASE,
  useFactory: (): Database => createDb(loadEnv(process.env).DATABASE_URL).db,
}

@Global()
@Module({ providers: [databaseProvider], exports: [DATABASE] })
export class DatabaseModule {}
```

- [ ] **Step 11: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test src/orgs/signup.service.spec.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(api): add argon2 password hashing and transactional org signup"
```

---

### Task 6: JWT authentication with org-scoped claims

**Files:**
- Create: `apps/api/src/auth/token.service.ts`, `apps/api/src/auth/login.service.ts`, `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/jwt.guard.ts`
- Modify: `apps/api/src/auth/auth.module.ts`, `apps/api/src/app.module.ts`
- Test: `apps/api/src/auth/token.service.spec.ts`, `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `PasswordService`, `SignupService`, `memberships`
- Produces: `TokenService.issue(claims: AccessClaims): Promise<TokenPair>` where `AccessClaims = { sub: string; orgId: string; role: MembershipRole }` and `TokenPair = { accessToken: string; refreshToken: string; expiresIn: number }`; `TokenService.verifyAccess(token: string): Promise<AccessClaims>`; `JwtGuard` populating `request.auth: AccessClaims`

- [ ] **Step 1: Install JWT dependencies**

```bash
pnpm --filter @appstore/api add @nestjs/jwt
```

- [ ] **Step 2: Write the failing token test**

`apps/api/src/auth/token.service.spec.ts`:

```ts
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { TokenService } from './token.service'

const SECRET = 'a'.repeat(32)

function makeService(): TokenService {
  return new TokenService(new JwtService({ secret: SECRET }))
}

const claims = {
  sub: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  role: 'publisher' as const,
}

describe('TokenService', () => {
  it('issues an access token carrying the org id and role', async () => {
    const service = makeService()
    const pair = await service.issue(claims)
    const decoded = await service.verifyAccess(pair.accessToken)
    expect(decoded).toMatchObject(claims)
  })

  it('issues a refresh token distinct from the access token', async () => {
    const service = makeService()
    const pair = await service.issue(claims)
    expect(pair.refreshToken).not.toBe(pair.accessToken)
  })

  it('refuses an access token that is actually a refresh token', async () => {
    const service = makeService()
    const pair = await service.issue(claims)
    await expect(service.verifyAccess(pair.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('refuses a token signed with a different secret', async () => {
    const other = new TokenService(new JwtService({ secret: 'b'.repeat(32) }))
    const pair = await other.issue(claims)
    await expect(makeService().verifyAccess(pair.accessToken)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('refuses a structurally invalid token', async () => {
    await expect(makeService().verifyAccess('garbage')).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
```

The third test matters more than it looks: token-type confusion — accepting a long-lived refresh token wherever a short-lived access token belongs — is a routine finding in auth reviews.

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test src/auth/token.service.spec.ts
```

Expected: FAIL — cannot resolve `./token.service`.

- [ ] **Step 4: Implement TokenService**

`apps/api/src/auth/token.service.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

export type MembershipRole = 'owner' | 'admin' | 'publisher' | 'viewer'

export interface AccessClaims {
  sub: string
  orgId: string
  role: MembershipRole
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

const ACCESS_TTL_SECONDS = 15 * 60
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  async issue(claims: AccessClaims): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...claims, typ: 'access' }, { expiresIn: ACCESS_TTL_SECONDS }),
      this.jwt.signAsync({ ...claims, typ: 'refresh' }, { expiresIn: REFRESH_TTL_SECONDS }),
    ])
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS }
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    return this.verify(token, 'access')
  }

  async verifyRefresh(token: string): Promise<AccessClaims> {
    return this.verify(token, 'refresh')
  }

  /**
   * The `typ` check prevents token-type confusion: a 30-day refresh token must
   * never be accepted where a 15-minute access token is expected.
   */
  private async verify(token: string, expected: 'access' | 'refresh'): Promise<AccessClaims> {
    let payload: { sub: string; orgId: string; role: MembershipRole; typ?: string }
    try {
      payload = await this.jwt.verifyAsync(token)
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
    if (payload.typ !== expected) {
      throw new UnauthorizedException('Invalid or expired token')
    }
    return { sub: payload.sub, orgId: payload.orgId, role: payload.role }
  }
}
```

- [ ] **Step 5: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test src/auth/token.service.spec.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 6: Write the failing login end-to-end test**

`apps/api/test/auth.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app'

describe('auth', () => {
  let ctx: TestApp
  let app: INestApplication

  const signup = {
    orgSlug: 'acme-corp',
    orgName: 'Acme Corp',
    email: 'lee@acme.test',
    password: 'correct horse battery staple',
    displayName: 'Lee',
  }

  beforeEach(async () => {
    ctx = await createTestApp()
    app = ctx.app
    await ctx.reset()
  })

  it('signs up an organization and returns tokens', async () => {
    const response = await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    expect(response.body.accessToken).toBeTypeOf('string')
    expect(response.body.refreshToken).toBeTypeOf('string')
  })

  it('rejects a signup with a weak password before touching the database', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, password: 'short' })
      .expect(400)
  })

  it('logs in with the correct credentials', async () => {
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email: signup.email, password: signup.password })
      .expect(200)
    expect(response.body.accessToken).toBeTypeOf('string')
  })

  it('returns 401 for a wrong password', async () => {
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email: signup.email, password: 'wrong password entirely' })
      .expect(401)
  })

  it('returns the same 401 for an unknown email as for a wrong password', async () => {
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    const unknown = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: signup.orgSlug, email: 'nobody@acme.test', password: signup.password })
      .expect(401)
    expect(unknown.body.message).toBe('Invalid credentials')
  })

  it('refuses to log a user into an organization they do not belong to', async () => {
    await request(app.getHttpServer()).post('/v1/auth/signup').send(signup).expect(201)
    await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ ...signup, orgSlug: 'globex-inc', orgName: 'Globex', email: 'sam@globex.test' })
      .expect(201)

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ orgSlug: 'globex-inc', email: signup.email, password: signup.password })
      .expect(401)
  })
})
```

- [ ] **Step 7: Write the shared test-app helper**

`apps/api/test/support/app.ts`:

```ts
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { afterAll, inject } from 'vitest'
import { AppModule } from '../../src/app.module'
import { createDb, type Database } from '../../src/db/client'
import { DATABASE } from '../../src/db/database.provider'
import { truncateAll } from './db'

export interface TestApp {
  app: INestApplication
  db: Database
  reset: () => Promise<void>
}

let cached: TestApp | undefined

export async function createTestApp(): Promise<TestApp> {
  if (cached) return cached

  const url = inject('postgresUrl')
  process.env.DATABASE_URL = url
  process.env.JWT_SECRET = 'a'.repeat(32)
  process.env.S3_ENDPOINT ??= 'http://localhost:9000'
  process.env.S3_BUCKET ??= 'artifacts'
  process.env.S3_ACCESS_KEY_ID ??= 'minioadmin'
  process.env.S3_SECRET_ACCESS_KEY ??= 'minioadmin'

  const { db } = createDb(url)
  await migrate(db, { migrationsFolder: `${__dirname}/../../drizzle` })

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE)
    .useValue(db)
    .compile()

  const app = moduleRef.createNestApplication()
  // MUST mirror main.ts. Every end-to-end test in this plan requests `/v1/...`,
  // and Nest applies no prefix unless asked — without this line the whole suite
  // 404s from Task 6 onward, in a way that looks like a routing bug in the
  // controllers rather than a missing line in the harness.
  app.setGlobalPrefix('v1', { exclude: ['health'] })
  await app.init()

  cached = { app, db, reset: () => truncateAll(db) }
  afterAll(async () => {
    await app.close()
    cached = undefined
  })
  return cached
}
```

- [ ] **Step 8: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test test/auth.e2e-spec.ts
```

Expected: FAIL — 404 on `/v1/auth/signup`, since no auth controller is registered yet.

- [ ] **Step 9: Implement login and the controller**

`apps/api/src/auth/login.service.ts`:

```ts
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { LoginInput } from '@appstore/shared'
import { and, eq } from 'drizzle-orm'
import { DATABASE, type Database } from '../db/database.provider'
import { memberships, organizations, users } from '../db/schema'
import { PasswordService } from './password.service'
import { TokenService, type TokenPair } from './token.service'

@Injectable()
export class LoginService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Every failure path returns the same message and does the same amount of
   * work, so response content and timing do not reveal whether an org exists,
   * whether an email is registered, or which of the two was wrong.
   */
  async login(input: LoginInput): Promise<TokenPair> {
    const email = input.email.trim().toLowerCase()

    const rows = await this.db
      .select({
        userId: users.id,
        passwordHash: users.passwordHash,
        orgId: organizations.id,
        role: memberships.role,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(and(eq(users.email, email), eq(organizations.slug, input.orgSlug)))
      .limit(1)

    const row = rows[0]
    const hash = row?.passwordHash ?? DUMMY_HASH
    const ok = await this.passwords.verify(hash, input.password)

    if (!row || !ok) {
      throw new UnauthorizedException('Invalid credentials')
    }

    return this.tokens.issue({ sub: row.userId, orgId: row.orgId, role: row.role })
  }
}

/** Verified against when no user matches, to keep failure timing uniform. */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG'
```

`apps/api/src/auth/auth.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@appstore/shared'
import { ZodValidationPipe } from 'nestjs-zod'
import { SignupService } from '../orgs/signup.service'
import { LoginService } from './login.service'
import { TokenService, type TokenPair } from './token.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly signup: SignupService,
    private readonly loginService: LoginService,
    private readonly tokens: TokenService,
  ) {}

  @Post('signup')
  async signUp(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<TokenPair> {
    const { orgId, userId } = await this.signup.signUp(body)
    return this.tokens.issue({ sub: userId, orgId, role: 'owner' })
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<TokenPair> {
    return this.loginService.login(body)
  }
}
```

`apps/api/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { loadEnv } from '../config/env'
import { SignupService } from '../orgs/signup.service'
import { AuthController } from './auth.controller'
import { LoginService } from './login.service'
import { PasswordService } from './password.service'
import { TokenService } from './token.service'

@Module({
  imports: [JwtModule.register({ secret: loadEnv(process.env).JWT_SECRET })],
  controllers: [AuthController],
  providers: [PasswordService, TokenService, LoginService, SignupService],
  exports: [TokenService, PasswordService],
})
export class AuthModule {}
```

Register `DatabaseModule` and `AuthModule` in `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { DatabaseModule } from './db/database.provider'
import { HealthModule } from './health/health.module'

@Module({ imports: [DatabaseModule, AuthModule, HealthModule] })
export class AppModule {}
```

- [ ] **Step 10: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test
```

Expected: PASS — all suites green, 6 new auth end-to-end tests.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(api): add org-scoped JWT login with uniform auth failures"
```

---

### Task 7: RBAC guard

**Files:**
- Create: `apps/api/src/auth/jwt.guard.ts`, `apps/api/src/auth/roles.decorator.ts`, `apps/api/src/auth/roles.guard.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Test: `apps/api/src/auth/roles.guard.spec.ts`

**Interfaces:**
- Consumes: `TokenService.verifyAccess`, `AccessClaims`, `MembershipRole`
- Produces: `@Roles(...roles: MembershipRole[])` decorator; `JwtGuard` setting `request.auth: AccessClaims`; `RolesGuard` enforcing the decorator. Later controllers apply `@UseGuards(JwtGuard, RolesGuard)`.

- [ ] **Step 1: Write the failing guard test**

`apps/api/src/auth/roles.guard.spec.ts`:

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { describe, expect, it } from 'vitest'
import type { AccessClaims, MembershipRole } from './token.service'
import { RolesGuard } from './roles.guard'

function contextWith(role: MembershipRole | undefined, required: MembershipRole[] | undefined) {
  const auth: AccessClaims | undefined = role
    ? { sub: 'u', orgId: 'o', role }
    : undefined
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext
  return { guard: new RolesGuard(reflector), context }
}

describe('RolesGuard', () => {
  it('allows any authenticated role when no roles are required', () => {
    const { guard, context } = contextWith('viewer', undefined)
    expect(guard.canActivate(context)).toBe(true)
  })

  it('allows a role that is explicitly listed', () => {
    const { guard, context } = contextWith('publisher', ['publisher', 'admin'])
    expect(guard.canActivate(context)).toBe(true)
  })

  it('denies a role that is not listed', () => {
    const { guard, context } = contextWith('viewer', ['publisher', 'admin'])
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })

  it('treats owner as satisfying any requirement', () => {
    const { guard, context } = contextWith('owner', ['publisher'])
    expect(guard.canActivate(context)).toBe(true)
  })

  it('denies when the request carries no authenticated claims', () => {
    const { guard, context } = contextWith(undefined, ['viewer'])
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test src/auth/roles.guard.spec.ts
```

Expected: FAIL — cannot resolve `./roles.guard`.

- [ ] **Step 3: Implement the decorator and guards**

`apps/api/src/auth/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common'
import type { MembershipRole } from './token.service'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles)
```

`apps/api/src/auth/roles.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './roles.decorator'
import type { AccessClaims, MembershipRole } from './token.service'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const auth = context.switchToHttp().getRequest<{ auth?: AccessClaims }>().auth
    if (!auth) {
      throw new ForbiddenException('Insufficient permissions')
    }
    if (!required || required.length === 0) {
      return true
    }
    // Owner is the org's root authority and is never locked out of its own data.
    if (auth.role === 'owner' || required.includes(auth.role)) {
      return true
    }
    throw new ForbiddenException('Insufficient permissions')
  }
}
```

`apps/api/src/auth/jwt.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { AccessClaims } from './token.service'
import { TokenService } from './token.service'

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; auth?: AccessClaims }>()
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token')
    }
    request.auth = await this.tokens.verifyAccess(header.slice('Bearer '.length))
    return true
  }
}
```

Add `JwtGuard` and `RolesGuard` to the `providers` and `exports` arrays of `apps/api/src/auth/auth.module.ts`.

- [ ] **Step 4: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test src/auth/roles.guard.spec.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): add JWT and role guards with owner escalation"
```

---

### Task 8: Apps domain, org-scoped

**Files:**
- Create: `apps/api/src/apps/apps.service.ts`, `apps/api/src/apps/apps.controller.ts`, `apps/api/src/apps/apps.module.ts`
- Create: `packages/shared/src/contracts/apps.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/app.module.ts`
- Test: `apps/api/test/apps.e2e-spec.ts`

**Interfaces:**
- Consumes: `withTenant`, `apps` table, `JwtGuard`, `RolesGuard`, `@Roles`
- Produces: `AppsService.create(orgId, actorId, input): Promise<AppRecord>`, `AppsService.list(orgId): Promise<AppRecord[]>`, `AppsService.findBySlug(orgId, slug): Promise<AppRecord>` where `AppRecord = { id, slug, name, description, category, platform, createdAt }`; `createAppSchema` in `@appstore/shared`

- [ ] **Step 1: Define the shared contract**

`packages/shared/src/contracts/apps.ts`:

```ts
import { z } from 'zod'
import { appSlugSchema } from '../identifiers.js'

export const appPlatformSchema = z.enum(['android', 'ios', 'both'])

export const createAppSchema = z.object({
  slug: appSlugSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(4000).default(''),
  category: z.string().min(1).max(60).default('uncategorized'),
  platform: appPlatformSchema,
})

export type CreateAppInput = z.infer<typeof createAppSchema>
export type AppPlatform = z.infer<typeof appPlatformSchema>
```

Append to `packages/shared/src/index.ts`:

```ts
export * from './contracts/apps.js'
```

- [ ] **Step 2: Write the failing end-to-end test**

`apps/api/test/apps.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app'

async function signUp(app: INestApplication, orgSlug: string, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/signup')
    .send({ orgSlug, orgName: orgSlug, email, password: 'correct horse battery staple', displayName: 'Owner' })
    .expect(201)
  return response.body.accessToken
}

describe('apps', () => {
  let ctx: TestApp
  let app: INestApplication
  let acmeToken: string
  let globexToken: string

  beforeEach(async () => {
    ctx = await createTestApp()
    app = ctx.app
    await ctx.reset()
    acmeToken = await signUp(app, 'acme-corp', 'lee@acme.test')
    globexToken = await signUp(app, 'globex-inc', 'sam@globex.test')
  })

  it('creates an app in the caller organization', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/apps')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ slug: 'payroll', name: 'Payroll', platform: 'android' })
      .expect(201)
    expect(response.body).toMatchObject({ slug: 'payroll', name: 'Payroll', platform: 'android' })
  })

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .post('/v1/apps')
      .send({ slug: 'payroll', name: 'Payroll', platform: 'android' })
      .expect(401)
  })

  it('lists only apps belonging to the caller organization', async () => {
    await request(app.getHttpServer())
      .post('/v1/apps')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ slug: 'payroll', name: 'Payroll', platform: 'android' })
      .expect(201)
    await request(app.getHttpServer())
      .post('/v1/apps')
      .set('Authorization', `Bearer ${globexToken}`)
      .send({ slug: 'logistics', name: 'Logistics', platform: 'ios' })
      .expect(201)

    const acme = await request(app.getHttpServer())
      .get('/v1/apps')
      .set('Authorization', `Bearer ${acmeToken}`)
      .expect(200)
    expect(acme.body.map((row: { slug: string }) => row.slug)).toEqual(['payroll'])
  })

  it('returns 404 when fetching another organization app by slug', async () => {
    await request(app.getHttpServer())
      .post('/v1/apps')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ slug: 'payroll', name: 'Payroll', platform: 'android' })
      .expect(201)

    await request(app.getHttpServer())
      .get('/v1/apps/payroll')
      .set('Authorization', `Bearer ${globexToken}`)
      .expect(404)
  })

  it('allows two organizations to use the same app slug', async () => {
    await request(app.getHttpServer())
      .post('/v1/apps')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ slug: 'payroll', name: 'Payroll', platform: 'android' })
      .expect(201)
    await request(app.getHttpServer())
      .post('/v1/apps')
      .set('Authorization', `Bearer ${globexToken}`)
      .send({ slug: 'payroll', name: 'Their Payroll', platform: 'android' })
      .expect(201)
  })

  it('rejects a duplicate slug within one organization', async () => {
    await request(app.getHttpServer())
      .post('/v1/apps')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ slug: 'payroll', name: 'Payroll', platform: 'android' })
      .expect(201)
    await request(app.getHttpServer())
      .post('/v1/apps')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ slug: 'payroll', name: 'Duplicate', platform: 'android' })
      .expect(409)
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test test/apps.e2e-spec.ts
```

Expected: FAIL — 404 on `/v1/apps`.

- [ ] **Step 4: Implement the service**

`apps/api/src/apps/apps.service.ts`:

```ts
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CreateAppInput } from '@appstore/shared'
import { eq } from 'drizzle-orm'
import { apps } from '../db/apps.schema'
import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'

export interface AppRecord {
  id: string
  slug: string
  name: string
  description: string
  category: string
  platform: 'android' | 'ios' | 'both'
  createdAt: Date
}

const UNIQUE_VIOLATION = '23505'

@Injectable()
export class AppsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(orgId: string, actorId: string, input: CreateAppInput): Promise<AppRecord> {
    try {
      return await withTenant(this.db, orgId, async (tx) => {
        const [row] = await tx
          .insert(apps)
          .values({ orgId, createdBy: actorId, ...input })
          .returning()
        return toRecord(row!)
      })
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION) {
        throw new ConflictException(`An app with slug "${input.slug}" already exists in this organization`)
      }
      throw error
    }
  }

  async list(orgId: string): Promise<AppRecord[]> {
    const rows = await withTenant(this.db, orgId, (tx) => tx.select().from(apps))
    return rows.map(toRecord)
  }

  /**
   * Throws NotFound rather than Forbidden for another org's slug: confirming
   * that an app exists elsewhere would leak a competitor's catalog.
   */
  async findBySlug(orgId: string, slug: string): Promise<AppRecord> {
    const rows = await withTenant(this.db, orgId, (tx) =>
      tx.select().from(apps).where(eq(apps.slug, slug)).limit(1),
    )
    if (!rows[0]) {
      throw new NotFoundException(`No app with slug "${slug}"`)
    }
    return toRecord(rows[0])
  }
}

function toRecord(row: typeof apps.$inferSelect): AppRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    platform: row.platform,
    createdAt: row.createdAt,
  }
}
```

- [ ] **Step 5: Implement the controller and module**

`apps/api/src/apps/apps.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { createAppSchema, type CreateAppInput } from '@appstore/shared'
import { ZodValidationPipe } from 'nestjs-zod'
import { JwtGuard } from '../auth/jwt.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import type { AccessClaims } from '../auth/token.service'
import { AppsService, type AppRecord } from './apps.service'

@Controller('apps')
@UseGuards(JwtGuard, RolesGuard)
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Post()
  @Roles('publisher', 'admin')
  async create(
    @Req() request: { auth: AccessClaims },
    @Body(new ZodValidationPipe(createAppSchema)) body: CreateAppInput,
  ): Promise<AppRecord> {
    return this.appsService.create(request.auth.orgId, request.auth.sub, body)
  }

  @Get()
  @Roles('viewer', 'publisher', 'admin')
  async list(@Req() request: { auth: AccessClaims }): Promise<AppRecord[]> {
    return this.appsService.list(request.auth.orgId)
  }

  @Get(':slug')
  @Roles('viewer', 'publisher', 'admin')
  async findOne(
    @Req() request: { auth: AccessClaims },
    @Param('slug') slug: string,
  ): Promise<AppRecord> {
    return this.appsService.findBySlug(request.auth.orgId, slug)
  }
}
```

`apps/api/src/apps/apps.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AppsController } from './apps.controller'
import { AppsService } from './apps.service'

@Module({ imports: [AuthModule], controllers: [AppsController], providers: [AppsService] })
export class AppsModule {}
```

Add `AppsModule` to the `imports` array in `apps/api/src/app.module.ts`.

- [ ] **Step 6: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test test/apps.e2e-spec.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): add org-scoped apps domain with slug uniqueness per org"
```

---

### Task 9: Releases and the immutable lifecycle

**Files:**
- Create: `apps/api/src/db/releases.schema.ts`, `apps/api/src/releases/release-lifecycle.ts`, `apps/api/src/releases/releases.service.ts`
- Modify: `apps/api/src/db/schema.ts`
- Test: `apps/api/src/releases/release-lifecycle.spec.ts`, `apps/api/src/releases/releases.service.spec.ts`

**Interfaces:**
- Consumes: `withTenant`, `apps` table
- Produces: `releases` table; `ReleaseStatus = 'draft' | 'published' | 'archived'`; `assertTransition(from: ReleaseStatus, to: ReleaseStatus): void`; `ReleasesService.create/publish/archive/listForApp`

- [ ] **Step 1: Define the releases table**

`apps/api/src/db/releases.schema.ts`:

```ts
import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { apps } from './apps.schema'
import { organizations, users } from './schema'

export const releaseStatus = pgEnum('release_status', ['draft', 'published', 'archived'])

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
    version: text('version').notNull(),
    buildNumber: integer('build_number').notNull(),
    channel: text('channel').notNull().default('stable'),
    changelog: text('changelog').notNull().default(''),
    status: releaseStatus('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('releases_app_build_key').on(table.appId, table.buildNumber)],
)
```

Append `export * from './releases.schema'` to `apps/api/src/db/schema.ts`, then generate and hand-extend the migration:

```bash
pnpm --filter @appstore/api exec drizzle-kit generate --name add_releases
```

Append to the generated SQL file:

```sql
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases FORCE ROW LEVEL SECURITY;

CREATE POLICY releases_tenant_isolation ON releases
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Immutability enforced at the database, not only in the service layer. A
-- published release is a distribution fact other systems have already acted on.
CREATE OR REPLACE FUNCTION reject_published_release_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'published' AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION 'release % is published and immutable', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.status = 'published' AND (
       NEW.version <> OLD.version
    OR NEW.build_number <> OLD.build_number
    OR NEW.changelog <> OLD.changelog
    OR NEW.app_id <> OLD.app_id
  ) THEN
    RAISE EXCEPTION 'release % is published and immutable', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER releases_immutable_when_published
  BEFORE UPDATE ON releases
  FOR EACH ROW EXECUTE FUNCTION reject_published_release_mutation();
```

- [ ] **Step 2: Write the failing lifecycle test**

`apps/api/src/releases/release-lifecycle.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { assertTransition, type ReleaseStatus } from './release-lifecycle'

describe('assertTransition', () => {
  it('allows draft to published', () => {
    expect(() => assertTransition('draft', 'published')).not.toThrow()
  })

  it('allows draft to archived', () => {
    expect(() => assertTransition('draft', 'archived')).not.toThrow()
  })

  it('allows published to archived', () => {
    expect(() => assertTransition('published', 'archived')).not.toThrow()
  })

  it('refuses published back to draft', () => {
    expect(() => assertTransition('published', 'draft')).toThrow(/published.*draft/i)
  })

  it('refuses archived to anything', () => {
    const targets: ReleaseStatus[] = ['draft', 'published', 'archived']
    for (const target of targets) {
      expect(() => assertTransition('archived', target)).toThrow()
    }
  })

  it('refuses a transition to the same state', () => {
    expect(() => assertTransition('draft', 'draft')).toThrow()
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test src/releases/release-lifecycle.spec.ts
```

Expected: FAIL — cannot resolve `./release-lifecycle`.

- [ ] **Step 4: Implement the state machine**

`apps/api/src/releases/release-lifecycle.ts`:

```ts
import { ConflictException } from '@nestjs/common'

export type ReleaseStatus = 'draft' | 'published' | 'archived'

/**
 * The lifecycle is deliberately one-way. Publishing is an observable event —
 * devices may already have installed the artifact — so "unpublish" is modelled
 * as archive, never as a return to draft.
 */
const ALLOWED: Record<ReleaseStatus, readonly ReleaseStatus[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: [],
}

export function assertTransition(from: ReleaseStatus, to: ReleaseStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new ConflictException(`Cannot move a release from ${from} to ${to}`)
  }
}
```

- [ ] **Step 5: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test src/releases/release-lifecycle.spec.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Write the failing database-level immutability test**

`apps/api/src/releases/releases.service.spec.ts`:

```ts
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { apps } from '../db/apps.schema'
import { releases } from '../db/releases.schema'
import { organizations } from '../db/schema'
import { withTenant } from '../db/tenant'

describe('release immutability', () => {
  const ctx = useTestDb()
  let orgId: string
  let appId: string

  beforeEach(async () => {
    await truncateAll(ctx.db)
    const [org] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    orgId = org!.id
    appId = await withTenant(ctx.db, orgId, async (tx) => {
      const [row] = await tx
        .insert(apps)
        .values({ orgId, slug: 'payroll', name: 'Payroll', platform: 'android' })
        .returning()
      return row!.id
    })
  })

  async function insertRelease(status: 'draft' | 'published'): Promise<string> {
    return withTenant(ctx.db, orgId, async (tx) => {
      const [row] = await tx
        .insert(releases)
        .values({ orgId, appId, version: '1.0.0', buildNumber: 1, status })
        .returning()
      return row!.id
    })
  }

  it('permits editing a draft release', async () => {
    const id = await insertRelease('draft')
    await withTenant(ctx.db, orgId, (tx) =>
      tx.update(releases).set({ changelog: 'first cut' }).where(eq(releases.id, id)),
    )
    const [row] = await withTenant(ctx.db, orgId, (tx) =>
      tx.select().from(releases).where(eq(releases.id, id)),
    )
    expect(row?.changelog).toBe('first cut')
  })

  it('rejects editing the changelog of a published release', async () => {
    const id = await insertRelease('published')
    await expect(
      withTenant(ctx.db, orgId, (tx) =>
        tx.update(releases).set({ changelog: 'rewritten history' }).where(eq(releases.id, id)),
      ),
    ).rejects.toThrow(/immutable/i)
  })

  it('rejects changing the version of a published release', async () => {
    const id = await insertRelease('published')
    await expect(
      withTenant(ctx.db, orgId, (tx) =>
        tx.update(releases).set({ version: '9.9.9' }).where(eq(releases.id, id)),
      ),
    ).rejects.toThrow(/immutable/i)
  })

  it('permits archiving a published release', async () => {
    const id = await insertRelease('published')
    await withTenant(ctx.db, orgId, (tx) =>
      tx.update(releases).set({ status: 'archived' }).where(eq(releases.id, id)),
    )
    const [row] = await withTenant(ctx.db, orgId, (tx) =>
      tx.select().from(releases).where(eq(releases.id, id)),
    )
    expect(row?.status).toBe('archived')
  })

  it('rejects a duplicate build number for one app', async () => {
    await insertRelease('draft')
    await expect(insertRelease('draft')).rejects.toThrow(/releases_app_build_key/)
  })
})
```

- [ ] **Step 7: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test src/releases/releases.service.spec.ts
```

Expected: PASS — 5 tests. These pass against the trigger written in Step 1, proving immutability holds even if a future service-layer change forgets to check.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(api): add releases with database-enforced immutability"
```

---

### Task 10: BlobStore port and S3 adapter

**Files:**
- Create: `apps/api/src/storage/blob-store.ts`, `apps/api/src/storage/s3-blob-store.ts`, `apps/api/src/storage/storage.module.ts`
- Create: `apps/api/test/support/minio.global.ts`
- Modify: `apps/api/vitest.config.ts`
- Test: `apps/api/src/storage/s3-blob-store.spec.ts`

**Interfaces:**
- Consumes: `loadEnv`
- Produces: `BlobStore` interface — `put(key: string, body: Readable, contentType: string): Promise<void>`, `presignGet(key: string, ttlSeconds: number): Promise<string>`, `head(key: string): Promise<{ size: number } | null>`, `delete(key: string): Promise<void>`; `artifactKey(orgId: string, sha256: string): string`

- [ ] **Step 1: Install the S3 client**

```bash
pnpm --filter @appstore/api add @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Add a MinIO container to global setup**

`apps/api/test/support/minio.global.ts`:

```ts
import { GenericContainer, type StartedTestContainer } from 'testcontainers'
import type { GlobalSetupContext } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    s3Endpoint: string
  }
}

let container: StartedTestContainer

export async function setup({ provide }: GlobalSetupContext): Promise<void> {
  container = await new GenericContainer('minio/minio:latest')
    .withCommand(['server', '/data'])
    .withEnvironment({ MINIO_ROOT_USER: 'minioadmin', MINIO_ROOT_PASSWORD: 'minioadmin' })
    .withExposedPorts(9000)
    .start()
  provide('s3Endpoint', `http://${container.getHost()}:${container.getMappedPort(9000)}`)
}

export async function teardown(): Promise<void> {
  await container?.stop()
}
```

Add it to `globalSetup` in `apps/api/vitest.config.ts`:

```ts
    globalSetup: ['./test/support/postgres.global.ts', './test/support/minio.global.ts'],
```

- [ ] **Step 3: Write the failing storage test**

`apps/api/src/storage/s3-blob-store.spec.ts`:

```ts
import { Readable } from 'node:stream'
import { beforeAll, describe, expect, inject, it } from 'vitest'
import { artifactKey } from './blob-store'
import { S3BlobStore } from './s3-blob-store'

describe('S3BlobStore', () => {
  let store: S3BlobStore

  beforeAll(async () => {
    store = new S3BlobStore({
      endpoint: inject('s3Endpoint'),
      bucket: 'artifacts',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    })
    await store.ensureBucket()
  })

  it('stores an object and reports its size', async () => {
    await store.put('test/hello.txt', Readable.from(['hello world']), 'text/plain')
    const head = await store.head('test/hello.txt')
    expect(head?.size).toBe(11)
  })

  it('returns null for an object that does not exist', async () => {
    await expect(store.head('test/absent.txt')).resolves.toBeNull()
  })

  it('issues a presigned URL that retrieves the object', async () => {
    await store.put('test/signed.txt', Readable.from(['signed content']), 'text/plain')
    const url = await store.presignGet('test/signed.txt', 60)
    const response = await fetch(url)
    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('signed content')
  })

  it('deletes an object', async () => {
    await store.put('test/doomed.txt', Readable.from(['x']), 'text/plain')
    await store.delete('test/doomed.txt')
    await expect(store.head('test/doomed.txt')).resolves.toBeNull()
  })
})

describe('artifactKey', () => {
  it('scopes the key to the organization so no content is shared across tenants', () => {
    const sha = 'a'.repeat(64)
    expect(artifactKey('org-1', sha)).toBe(`orgs/org-1/artifacts/${sha}`)
    expect(artifactKey('org-2', sha)).not.toBe(artifactKey('org-1', sha))
  })
})
```

The last assertion encodes the cross-tenant dedupe constraint from the global constraints as an executable rule rather than a comment.

- [ ] **Step 4: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test src/storage/s3-blob-store.spec.ts
```

Expected: FAIL — cannot resolve `./blob-store`.

- [ ] **Step 5: Define the port**

`apps/api/src/storage/blob-store.ts`:

```ts
import type { Readable } from 'node:stream'

export interface BlobStore {
  put(key: string, body: Readable, contentType: string): Promise<void>
  presignGet(key: string, ttlSeconds: number): Promise<string>
  head(key: string): Promise<{ size: number } | null>
  delete(key: string): Promise<void>
}

export const BLOB_STORE = Symbol('BLOB_STORE')

/**
 * Content-addressed but namespaced per organization. Sharing one key across
 * tenants would let an org infer, from an unexpectedly fast upload or from
 * storage accounting, that another tenant already holds the identical binary.
 */
export function artifactKey(orgId: string, sha256: string): string {
  return `orgs/${orgId}/artifacts/${sha256}`
}
```

- [ ] **Step 6: Implement the S3 adapter**

`apps/api/src/storage/s3-blob-store.ts`:

```ts
import type { Readable } from 'node:stream'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable } from '@nestjs/common'
import type { BlobStore } from './blob-store'

export interface S3BlobStoreOptions {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region?: string
}

@Injectable()
export class S3BlobStore implements BlobStore {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(options: S3BlobStoreOptions) {
    this.bucket = options.bucket
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region ?? 'us-east-1',
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
      // MinIO and most self-hosted gateways do not support virtual-host addressing.
      forcePathStyle: true,
    })
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
    } catch (error) {
      if (!isAlreadyOwned(error)) throw error
    }
  }

  /** Multipart upload so a 2 GiB artifact never lands in the API process heap. */
  async put(key: string, body: Readable, contentType: string): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: body, ContentType: contentType },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
    })
    await upload.done()
  }

  async presignGet(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    })
  }

  async head(key: string): Promise<{ size: number } | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return { size: result.ContentLength ?? 0 }
    } catch (error) {
      if (isNotFound(error)) return null
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error &&
    (error.name === 'NotFound' || error.name === 'NoSuchKey')
}

function isAlreadyOwned(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error &&
    (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists')
}
```

- [ ] **Step 7: Wire the storage module**

`apps/api/src/storage/storage.module.ts`:

```ts
import { Global, Module, type Provider } from '@nestjs/common'
import { loadEnv } from '../config/env'
import { BLOB_STORE } from './blob-store'
import { S3BlobStore } from './s3-blob-store'

const blobStoreProvider: Provider = {
  provide: BLOB_STORE,
  useFactory: (): S3BlobStore => {
    const env = loadEnv(process.env)
    return new S3BlobStore({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    })
  },
}

@Global()
@Module({ providers: [blobStoreProvider], exports: [BLOB_STORE] })
export class StorageModule {}
```

- [ ] **Step 8: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test src/storage/s3-blob-store.spec.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(api): add BlobStore port with per-org content-addressed S3 adapter"
```

---

### Task 11: Streaming artifact upload with hash-on-write

**Files:**
- Create: `apps/api/src/db/artifacts.schema.ts`, `apps/api/src/artifacts/upload.service.ts`, `apps/api/src/artifacts/artifacts.controller.ts`, `apps/api/src/artifacts/artifacts.module.ts`
- Modify: `apps/api/src/db/schema.ts`, `apps/api/src/app.module.ts`
- Test: `apps/api/src/artifacts/upload.service.spec.ts`

**Interfaces:**
- Consumes: `BlobStore`, `artifactKey`, `withTenant`, `releases`
- Produces: `artifacts` table; `UploadService.receive(params: { orgId: string; releaseId: string; platform: 'android' | 'ios'; stream: Readable; contentType: string; declaredSize?: number }): Promise<ArtifactRecord>` where `ArtifactRecord = { id, sha256, sizeBytes, storageKey, platform }`

- [ ] **Step 1: Define the artifacts table**

`apps/api/src/db/artifacts.schema.ts`:

```ts
import { bigint, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { releases } from './releases.schema'
import { organizations } from './schema'

export const artifactPlatform = pgEnum('artifact_platform', ['android', 'ios'])

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
    platform: artifactPlatform('platform').notNull(),
    storageKey: text('storage_key').notNull(),
    sha256: text('sha256').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    contentType: text('content_type').notNull(),
    bundleId: text('bundle_id'),
    minOs: text('min_os'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('artifacts_release_platform_key').on(table.releaseId, table.platform)],
)
```

Append the export to `apps/api/src/db/schema.ts`, generate the migration, and append the RLS block:

```bash
pnpm --filter @appstore/api exec drizzle-kit generate --name add_artifacts
```

```sql
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts FORCE ROW LEVEL SECURITY;

CREATE POLICY artifacts_tenant_isolation ON artifacts
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
```

- [ ] **Step 2: Write the failing upload test**

`apps/api/src/artifacts/upload.service.spec.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import { PayloadTooLargeException } from '@nestjs/common'
import { beforeEach, describe, expect, inject, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { apps } from '../db/apps.schema'
import { releases } from '../db/releases.schema'
import { organizations } from '../db/schema'
import { withTenant } from '../db/tenant'
import { S3BlobStore } from '../storage/s3-blob-store'
import { UploadService } from './upload.service'

describe('UploadService', () => {
  const ctx = useTestDb()
  let service: UploadService
  let store: S3BlobStore
  let orgId: string
  let releaseId: string

  beforeEach(async () => {
    await truncateAll(ctx.db)
    store = new S3BlobStore({
      endpoint: inject('s3Endpoint'),
      bucket: 'artifacts',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    })
    await store.ensureBucket()
    service = new UploadService(ctx.db, store)

    const [org] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    orgId = org!.id
    releaseId = await withTenant(ctx.db, orgId, async (tx) => {
      const [app] = await tx
        .insert(apps)
        .values({ orgId, slug: 'payroll', name: 'Payroll', platform: 'android' })
        .returning()
      const [release] = await tx
        .insert(releases)
        .values({ orgId, appId: app!.id, version: '1.0.0', buildNumber: 1 })
        .returning()
      return release!.id
    })
  })

  it('computes the SHA-256 of the uploaded bytes', async () => {
    const payload = randomBytes(1024)
    const expected = createHash('sha256').update(payload).digest('hex')

    const artifact = await service.receive({
      orgId,
      releaseId,
      platform: 'android',
      stream: Readable.from([payload]),
      contentType: 'application/vnd.android.package-archive',
    })

    expect(artifact.sha256).toBe(expected)
    expect(artifact.sizeBytes).toBe(1024)
  })

  it('stores the object under an org-scoped content-addressed key', async () => {
    const artifact = await service.receive({
      orgId,
      releaseId,
      platform: 'android',
      stream: Readable.from([randomBytes(64)]),
      contentType: 'application/vnd.android.package-archive',
    })

    expect(artifact.storageKey).toBe(`orgs/${orgId}/artifacts/${artifact.sha256}`)
    await expect(store.head(artifact.storageKey)).resolves.toMatchObject({ size: 64 })
  })

  it('rejects an upload that exceeds the 2 GiB cap without buffering it', async () => {
    const oversized = Readable.from(
      (function* () {
        // Yields more than the cap in 1 MiB chunks; the service must abort early.
        for (let index = 0; index < 2049; index += 1) yield randomBytes(1024 * 1024)
      })(),
    )

    await expect(
      service.receive({
        orgId,
        releaseId,
        platform: 'android',
        stream: oversized,
        contentType: 'application/vnd.android.package-archive',
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException)
  }, 300_000)

  it('rejects a content type that is not an APK or IPA', async () => {
    await expect(
      service.receive({
        orgId,
        releaseId,
        platform: 'android',
        stream: Readable.from([randomBytes(16)]),
        contentType: 'text/html',
      }),
    ).rejects.toThrow(/content type/i)
  })

  it('rejects a second artifact for the same release and platform', async () => {
    const upload = () =>
      service.receive({
        orgId,
        releaseId,
        platform: 'android',
        stream: Readable.from([randomBytes(16)]),
        contentType: 'application/vnd.android.package-archive',
      })

    await upload()
    await expect(upload()).rejects.toThrow(/artifacts_release_platform_key/)
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test src/artifacts/upload.service.spec.ts
```

Expected: FAIL — cannot resolve `./upload.service`.

- [ ] **Step 4: Implement hash-on-write upload**

`apps/api/src/artifacts/upload.service.ts`:

```ts
import { createHash } from 'node:crypto'
import { PassThrough, type Readable } from 'node:stream'
import { BadRequestException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common'
import { artifacts } from '../db/artifacts.schema'
import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'
import { artifactKey, BLOB_STORE, type BlobStore } from '../storage/blob-store'

export const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024 * 1024

const ALLOWED_CONTENT_TYPES = new Map<string, 'android' | 'ios'>([
  ['application/vnd.android.package-archive', 'android'],
  ['application/octet-stream', 'android'],
  ['application/x-ios-app', 'ios'],
])

export interface ReceiveParams {
  orgId: string
  releaseId: string
  platform: 'android' | 'ios'
  stream: Readable
  contentType: string
}

export interface ArtifactRecord {
  id: string
  sha256: string
  sizeBytes: number
  storageKey: string
  platform: 'android' | 'ios'
}

@Injectable()
export class UploadService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(BLOB_STORE) private readonly blobs: BlobStore,
  ) {}

  /**
   * Hashes and sizes the payload while it streams to object storage, so a 2 GiB
   * artifact is never resident in memory and is never re-read to be verified.
   *
   * The temporary key is rewritten to the content-addressed key only after the
   * digest is known — the alternative, buffering to learn the hash first, is
   * exactly what the size cap exists to prevent.
   */
  async receive(params: ReceiveParams): Promise<ArtifactRecord> {
    const expectedPlatform = ALLOWED_CONTENT_TYPES.get(params.contentType)
    if (!expectedPlatform) {
      throw new BadRequestException(`Unsupported content type: ${params.contentType}`)
    }

    const hash = createHash('sha256')
    let sizeBytes = 0
    const relay = new PassThrough()

    params.stream.on('data', (chunk: Buffer) => {
      sizeBytes += chunk.length
      if (sizeBytes > MAX_ARTIFACT_BYTES) {
        params.stream.destroy(new PayloadTooLargeException('Artifact exceeds the 2 GiB limit'))
        relay.destroy(new PayloadTooLargeException('Artifact exceeds the 2 GiB limit'))
        return
      }
      hash.update(chunk)
    })
    params.stream.pipe(relay)

    const stagingKey = `orgs/${params.orgId}/staging/${params.releaseId}.${params.platform}`
    try {
      await this.blobs.put(stagingKey, relay, params.contentType)
    } catch (error) {
      if (error instanceof PayloadTooLargeException) throw error
      if (isTooLarge(error)) throw new PayloadTooLargeException('Artifact exceeds the 2 GiB limit')
      throw error
    }

    const sha256 = hash.digest('hex')
    const storageKey = artifactKey(params.orgId, sha256)

    // Re-stream from staging to the final key, then drop the staging object.
    const staged = await this.blobs.head(stagingKey)
    if (!staged) {
      throw new BadRequestException('Upload did not complete')
    }

    try {
      return await withTenant(this.db, params.orgId, async (tx) => {
        const [row] = await tx
          .insert(artifacts)
          .values({
            orgId: params.orgId,
            releaseId: params.releaseId,
            platform: params.platform,
            storageKey,
            sha256,
            sizeBytes,
            contentType: params.contentType,
          })
          .returning()
        return {
          id: row!.id,
          sha256: row!.sha256,
          sizeBytes: row!.sizeBytes,
          storageKey: row!.storageKey,
          platform: row!.platform,
        }
      })
    } finally {
      await this.blobs.copy(stagingKey, storageKey)
      await this.blobs.delete(stagingKey)
    }
  }
}

function isTooLarge(error: unknown): boolean {
  return error instanceof Error && /exceeds the 2 GiB limit/.test(error.message)
}
```

Add `copy` to the `BlobStore` interface in `apps/api/src/storage/blob-store.ts`:

```ts
  copy(sourceKey: string, destinationKey: string): Promise<void>
```

and to `S3BlobStore`:

```ts
  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: destinationKey,
        CopySource: `${this.bucket}/${sourceKey}`,
      }),
    )
  }
```

importing `CopyObjectCommand` from `@aws-sdk/client-s3`.

- [ ] **Step 5: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test src/artifacts/upload.service.spec.ts
```

Expected: PASS — 5 tests. The oversized test streams 2 GiB and is slow by design; its timeout is set to 300 seconds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): stream artifact uploads with hash-on-write and a 2GiB cap"
```

---

### Task 12: Presigned artifact download

**Files:**
- Create: `apps/api/src/artifacts/download.service.ts`
- Modify: `apps/api/src/artifacts/artifacts.controller.ts`
- Test: `apps/api/test/download.e2e-spec.ts`

**Interfaces:**
- Consumes: `BlobStore.presignGet`, `artifacts`, `releases`, `JwtGuard`, `RolesGuard`
- Produces: `DownloadService.issue(orgId: string, actorId: string, releaseId: string, platform: 'android' | 'ios'): Promise<{ url: string; sha256: string; sizeBytes: number; expiresAt: Date }>`

**Design note for the implementer:** the API issues a short-lived presigned URL rather than proxying bytes. A 2 GiB download through the Node process would pin an event-loop worker for minutes and make horizontal scaling a function of bandwidth rather than request rate. The tradeoff is that the audit log records *issuance*, not completion — Plan 03 adds a client-side completion callback for install telemetry.

- [ ] **Step 1: Write the failing download test**

`apps/api/test/download.e2e-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, seedPublishedRelease, type TestApp } from './support/app'

describe('artifact download', () => {
  let ctx: TestApp
  let app: INestApplication

  beforeEach(async () => {
    ctx = await createTestApp()
    app = ctx.app
    await ctx.reset()
  })

  it('issues a presigned URL that retrieves the artifact bytes', async () => {
    const { token, releaseId, payload } = await seedPublishedRelease(app, 'acme-corp', 'lee@acme.test')

    const response = await request(app.getHttpServer())
      .get(`/v1/releases/${releaseId}/artifacts/android/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body.sha256).toMatch(/^[0-9a-f]{64}$/)
    const fetched = await fetch(response.body.url)
    expect(fetched.status).toBe(200)
    expect(Buffer.from(await fetched.arrayBuffer())).toEqual(payload)
  })

  it('returns the checksum so the client can verify the download itself', async () => {
    const { token, releaseId, sha256 } = await seedPublishedRelease(app, 'acme-corp', 'lee@acme.test')
    const response = await request(app.getHttpServer())
      .get(`/v1/releases/${releaseId}/artifacts/android/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(response.body.sha256).toBe(sha256)
  })

  it('refuses an unauthenticated download', async () => {
    const { releaseId } = await seedPublishedRelease(app, 'acme-corp', 'lee@acme.test')
    await request(app.getHttpServer())
      .get(`/v1/releases/${releaseId}/artifacts/android/download`)
      .expect(401)
  })

  it('returns 404 for a release belonging to another organization', async () => {
    const { releaseId } = await seedPublishedRelease(app, 'acme-corp', 'lee@acme.test')
    const { token: otherToken } = await seedPublishedRelease(app, 'globex-inc', 'sam@globex.test')

    await request(app.getHttpServer())
      .get(`/v1/releases/${releaseId}/artifacts/android/download`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404)
  })

  it('returns 404 for a draft release', async () => {
    const { token, draftReleaseId } = await seedPublishedRelease(app, 'acme-corp', 'lee@acme.test')
    await request(app.getHttpServer())
      .get(`/v1/releases/${draftReleaseId}/artifacts/android/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })
})
```

Append this helper to `apps/api/test/support/app.ts`.

It seeds through the database and the blob store rather than through HTTP. That is
deliberate: the fixture's job is to put the system into a known state, and routing
it through publish/upload endpoints would make every download test fail whenever an
unrelated endpoint changed. The one thing it does over HTTP is signup, because a
password hash and a real token are exactly what the download tests need.

```ts
import { createHash, randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { apps } from '../../src/db/apps.schema'
import { artifacts } from '../../src/db/artifacts.schema'
import { releases } from '../../src/db/releases.schema'
import { organizations } from '../../src/db/schema'
import { withTenant } from '../../src/db/tenant'
import { artifactKey, BLOB_STORE, type BlobStore } from '../../src/storage/blob-store'

export interface SeededRelease {
  token: string
  orgId: string
  releaseId: string
  draftReleaseId: string
  sha256: string
  payload: Buffer
}

export async function seedPublishedRelease(
  app: INestApplication,
  orgSlug: string,
  email: string,
): Promise<SeededRelease> {
  const signup = await request(app.getHttpServer())
    .post('/v1/auth/signup')
    .send({
      orgSlug,
      orgName: orgSlug,
      email,
      password: 'correct horse battery staple',
      displayName: 'Owner',
    })
    .expect(201)

  const db = app.get<Database>(DATABASE)
  const blobs = app.get<BlobStore>(BLOB_STORE)

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug))
  const orgId = org!.id

  const payload = randomBytes(2048)
  const sha256 = createHash('sha256').update(payload).digest('hex')
  const storageKey = artifactKey(orgId, sha256)
  await blobs.put(storageKey, Readable.from([payload]), 'application/vnd.android.package-archive')

  const seeded = await withTenant(db, orgId, async (tx) => {
    const [application] = await tx
      .insert(apps)
      .values({ orgId, slug: 'payroll', name: 'Payroll', platform: 'android' })
      .returning()

    // Build number 2 is the published one; 1 stays draft so the "draft 404s" test
    // has a real draft to ask for rather than a fabricated uuid.
    const [draft] = await tx
      .insert(releases)
      .values({ orgId, appId: application!.id, version: '1.0.0', buildNumber: 1, status: 'draft' })
      .returning()

    const [published] = await tx
      .insert(releases)
      .values({
        orgId,
        appId: application!.id,
        version: '1.1.0',
        buildNumber: 2,
        status: 'published',
        publishedAt: new Date(),
      })
      .returning()

    await tx.insert(artifacts).values({
      orgId,
      releaseId: published!.id,
      platform: 'android',
      storageKey,
      sha256,
      sizeBytes: payload.length,
      contentType: 'application/vnd.android.package-archive',
    })

    return { releaseId: published!.id, draftReleaseId: draft!.id }
  })

  return {
    token: signup.body.accessToken,
    orgId,
    releaseId: seeded.releaseId,
    draftReleaseId: seeded.draftReleaseId,
    sha256,
    payload,
  }
}
```

The `releases` insert sets `status: 'published'` directly rather than inserting a
draft and updating it. The immutability trigger from Task 9 rejects most updates to
a published row, and a fixture should not be exercising the code under test.

- [ ] **Step 2: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test test/download.e2e-spec.ts
```

Expected: FAIL — 404 on the download route.

- [ ] **Step 3: Implement the download service**

`apps/api/src/artifacts/download.service.ts`:

```ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { artifacts } from '../db/artifacts.schema'
import { DATABASE, type Database } from '../db/database.provider'
import { releases } from '../db/releases.schema'
import { withTenant } from '../db/tenant'
import { BLOB_STORE, type BlobStore } from '../storage/blob-store'
import { AuditService } from '../audit/audit.service'

const DOWNLOAD_TTL_SECONDS = 5 * 60

export interface DownloadTicket {
  url: string
  sha256: string
  sizeBytes: number
  expiresAt: Date
}

@Injectable()
export class DownloadService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(BLOB_STORE) private readonly blobs: BlobStore,
    private readonly audit: AuditService,
  ) {}

  async issue(
    orgId: string,
    actorId: string,
    releaseId: string,
    platform: 'android' | 'ios',
  ): Promise<DownloadTicket> {
    const rows = await withTenant(this.db, orgId, (tx) =>
      tx
        .select({
          storageKey: artifacts.storageKey,
          sha256: artifacts.sha256,
          sizeBytes: artifacts.sizeBytes,
        })
        .from(artifacts)
        .innerJoin(releases, eq(releases.id, artifacts.releaseId))
        .where(
          and(
            eq(artifacts.releaseId, releaseId),
            eq(artifacts.platform, platform),
            eq(releases.status, 'published'),
          ),
        )
        .limit(1),
    )

    const row = rows[0]
    if (!row) {
      throw new NotFoundException('No published artifact for that release and platform')
    }

    const url = await this.blobs.presignGet(row.storageKey, DOWNLOAD_TTL_SECONDS)
    await this.audit.record(orgId, {
      actorId,
      action: 'artifact.download_issued',
      subjectType: 'release',
      subjectId: releaseId,
      metadata: { platform, sha256: row.sha256 },
    })

    return {
      url,
      sha256: row.sha256,
      sizeBytes: row.sizeBytes,
      expiresAt: new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000),
    }
  }
}
```

The join against `releases.status = 'published'` is what makes the draft test pass and is the reason a draft returns 404 rather than 403 — an unpublished release should not be discoverable at all.

- [ ] **Step 4: Add the controller route**

The download route is **not** a member of `ArtifactsController`. That controller is
declared `@Controller('artifacts')`, so a method path of `releases/:releaseId/...`
would resolve to `/v1/artifacts/releases/:releaseId/...` — while every test above
requests `/v1/releases/:releaseId/artifacts/:platform/download`. Give it its own
controller rooted at `releases` instead.

Create `apps/api/src/artifacts/release-artifacts.controller.ts`:

```ts
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../auth/jwt.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import type { AccessClaims } from '../auth/token.service'
import { DownloadService, type DownloadTicket } from './download.service'

@Controller('releases')
@UseGuards(JwtGuard, RolesGuard)
export class ReleaseArtifactsController {
  constructor(private readonly downloads: DownloadService) {}

  @Get(':releaseId/artifacts/:platform/download')
  @Roles('viewer', 'publisher', 'admin')
  async download(
    @Req() request: { auth: AccessClaims },
    @Param('releaseId') releaseId: string,
    @Param('platform') platform: 'android' | 'ios',
  ): Promise<DownloadTicket> {
    return this.downloads.issue(request.auth.orgId, request.auth.sub, releaseId, platform)
  }
}
```

Register `ReleaseArtifactsController` in `ArtifactsModule`'s `controllers` array
alongside `ArtifactsController`, and add `DownloadService` to its `providers`.

- [ ] **Step 5: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test test/download.e2e-spec.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): issue short-lived presigned artifact download tickets"
```

---

### Task 13: Append-only audit log

**Files:**
- Create: `apps/api/src/db/audit.schema.ts`, `apps/api/src/audit/audit.service.ts`, `apps/api/src/audit/audit.controller.ts`, `apps/api/src/audit/audit.module.ts`
- Modify: `apps/api/src/db/schema.ts`, `apps/api/src/app.module.ts`
- Test: `apps/api/src/audit/audit.service.spec.ts`

**Interfaces:**
- Consumes: `withTenant`
- Produces: `audit_events` table; `AuditService.record(orgId: string, event: AuditEvent): Promise<void>` where `AuditEvent = { actorId: string | null; action: string; subjectType: string; subjectId: string; metadata?: Record<string, unknown> }`; `AuditService.list(orgId, limit): Promise<AuditRecord[]>`

- [ ] **Step 1: Define the table and revoke mutation**

`apps/api/src/db/audit.schema.ts`:

```ts
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations, users } from './schema'

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_events_org_created_idx').on(table.orgId, table.createdAt)],
)
```

Generate the migration and append:

```sql
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_events_tenant_isolation ON audit_events
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Append-only at the privilege level: the runtime role can write and read audit
-- events but has no grant to change or remove them. An audit log an application
-- bug can rewrite is not an audit log.
REVOKE UPDATE, DELETE ON audit_events FROM app_runtime;
```

- [ ] **Step 2: Write the failing test**

`apps/api/src/audit/audit.service.spec.ts`:

```ts
import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll, useTestDb } from '../../test/support/db'
import { auditEvents } from '../db/audit.schema'
import { organizations } from '../db/schema'
import { withTenant } from '../db/tenant'
import { AuditService } from './audit.service'

describe('AuditService', () => {
  const ctx = useTestDb()
  let service: AuditService
  let orgId: string

  beforeEach(async () => {
    await truncateAll(ctx.db)
    service = new AuditService(ctx.db)
    const [org] = await ctx.db.insert(organizations).values({ slug: 'acme-corp', name: 'Acme' }).returning()
    orgId = org!.id
  })

  it('records an event with its metadata', async () => {
    await service.record(orgId, {
      actorId: null,
      action: 'release.published',
      subjectType: 'release',
      subjectId: 'abc',
      metadata: { version: '1.0.0' },
    })

    const events = await service.list(orgId, 10)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ action: 'release.published', metadata: { version: '1.0.0' } })
  })

  it('returns events newest first', async () => {
    await service.record(orgId, { actorId: null, action: 'first', subjectType: 'x', subjectId: '1' })
    await service.record(orgId, { actorId: null, action: 'second', subjectType: 'x', subjectId: '2' })
    const events = await service.list(orgId, 10)
    expect(events.map((event) => event.action)).toEqual(['second', 'first'])
  })

  it('refuses an update to a recorded event', async () => {
    await service.record(orgId, { actorId: null, action: 'release.published', subjectType: 'release', subjectId: 'abc' })
    await expect(
      withTenant(ctx.db, orgId, (tx) => tx.update(auditEvents).set({ action: 'tampered' })),
    ).rejects.toThrow(/permission denied/i)
  })

  it('refuses a delete of a recorded event', async () => {
    await service.record(orgId, { actorId: null, action: 'release.published', subjectType: 'release', subjectId: 'abc' })
    await expect(
      withTenant(ctx.db, orgId, (tx) => tx.delete(auditEvents)),
    ).rejects.toThrow(/permission denied/i)
  })

  it('does not return another organization events', async () => {
    const [other] = await ctx.db.insert(organizations).values({ slug: 'globex-inc', name: 'Globex' }).returning()
    await service.record(orgId, { actorId: null, action: 'mine', subjectType: 'x', subjectId: '1' })
    await service.record(other!.id, { actorId: null, action: 'theirs', subjectType: 'x', subjectId: '2' })

    const events = await service.list(orgId, 10)
    expect(events.map((event) => event.action)).toEqual(['mine'])
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test src/audit/audit.service.spec.ts
```

Expected: FAIL — cannot resolve `./audit.service`.

- [ ] **Step 4: Implement AuditService**

`apps/api/src/audit/audit.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import { desc } from 'drizzle-orm'
import { auditEvents } from '../db/audit.schema'
import { DATABASE, type Database } from '../db/database.provider'
import { withTenant } from '../db/tenant'

export interface AuditEvent {
  actorId: string | null
  action: string
  subjectType: string
  subjectId: string
  metadata?: Record<string, unknown>
}

export interface AuditRecord extends AuditEvent {
  id: string
  createdAt: Date
}

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async record(orgId: string, event: AuditEvent): Promise<void> {
    await withTenant(this.db, orgId, (tx) =>
      tx.insert(auditEvents).values({
        orgId,
        actorId: event.actorId,
        action: event.action,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        metadata: event.metadata ?? {},
      }),
    )
  }

  async list(orgId: string, limit: number): Promise<AuditRecord[]> {
    const rows = await withTenant(this.db, orgId, (tx) =>
      tx.select().from(auditEvents).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(limit),
    )
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: row.createdAt,
    }))
  }
}
```

The secondary sort on `id` matters: two events recorded in the same millisecond would otherwise return in arbitrary order and the ordering test would flake.

- [ ] **Step 5: Run it and confirm it passes**

```bash
pnpm --filter @appstore/api test src/audit/audit.service.spec.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 6: Add the admin-only audit endpoint**

`apps/api/src/audit/audit.controller.ts`:

```ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../auth/jwt.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import type { AccessClaims } from '../auth/token.service'
import { AuditService, type AuditRecord } from './audit.service'

@Controller('audit')
@UseGuards(JwtGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('admin')
  async list(
    @Req() request: { auth: AccessClaims },
    @Query('limit') limit = '100',
  ): Promise<AuditRecord[]> {
    const parsed = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500)
    return this.audit.list(request.auth.orgId, parsed)
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): add privilege-enforced append-only audit log"
```

---

### Task 14: OpenAPI document and the full-suite gate

**Files:**
- Modify: `apps/api/src/main.ts`
- Create: `apps/api/src/openapi.ts`
- Test: `apps/api/test/openapi.e2e-spec.ts`

**Interfaces:**
- Consumes: every controller registered so far
- Produces: `buildOpenApiDocument(app: INestApplication): OpenAPIObject`; served at `/v1/docs`

- [ ] **Step 1: Install Swagger support**

```bash
pnpm --filter @appstore/api add @nestjs/swagger
```

- [ ] **Step 2: Write the failing test**

`apps/api/test/openapi.e2e-spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { buildOpenApiDocument } from '../src/openapi'
import { createTestApp, type TestApp } from './support/app'

describe('OpenAPI document', () => {
  let ctx: TestApp

  beforeEach(async () => {
    ctx = await createTestApp()
  })

  it('documents every implemented route', () => {
    const document = buildOpenApiDocument(ctx.app)
    const paths = Object.keys(document.paths)
    expect(paths).toContain('/v1/auth/login')
    expect(paths).toContain('/v1/auth/signup')
    expect(paths).toContain('/v1/apps')
    expect(paths).toContain('/v1/audit')
  })

  it('declares bearer authentication', () => {
    const document = buildOpenApiDocument(ctx.app)
    expect(document.components?.securitySchemes).toHaveProperty('bearer')
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
pnpm --filter @appstore/api test test/openapi.e2e-spec.ts
```

Expected: FAIL — cannot resolve `../src/openapi`.

- [ ] **Step 4: Implement the document builder**

`apps/api/src/openapi.ts`:

```ts
import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger'

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Enterprise App Store API')
    .setDescription('Multi-tenant distribution API for internal Android and iOS builds')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build()
  return SwaggerModule.createDocument(app, config)
}
```

In `apps/api/src/main.ts`, after `setGlobalPrefix` and before `listen`:

```ts
  SwaggerModule.setup('v1/docs', app, buildOpenApiDocument(app))
```

- [ ] **Step 5: Run the full suite**

```bash
pnpm test
```

Expected: PASS — every suite across `@appstore/shared` and `@appstore/api`. This is the gate for Plan 01; do not proceed to Plan 02 with anything red.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): publish OpenAPI document at /v1/docs"
```

---

## Self-Review

**Spec coverage.** Against `00-overview.md` and the surviving BRD requirements: FR-1.1/1.2 catalog listing (Task 8, search deferred to Plan 05 where the UI needs it), FR-2.1 upload (Task 11), FR-2.3 size and checksum (Task 11), FR-2.4 download (Task 12), FR-2.7 size and type rejection (Task 11), FR-3.1 RBAC (Task 7), FR-3.3 immutable releases (Task 9), FR-3.4 audit (Task 13), FR-3.5 lifecycle (Task 9), FR-4.1 auth (Tasks 5–6), NFR-2 security (Tasks 4–7), NFR-3 integrity (Tasks 9, 11).

**Known gaps, deferred deliberately:** FR-1.3/1.4 category filter and sort, FR-1.6 featured flag, and FR-2.6 update detection have no task here — they are read-model concerns whose shape depends on the mobile catalog screen, and they belong in Plan 03. Member invitation and role assignment (FR-3.6) is org administration and belongs in Plan 05. iOS artifact typing beyond content-type validation lands in Plan 02.

**Type consistency.** `MembershipRole` is defined once in `token.service.ts` and reused by the guard, the schema enum, and the claims. `Database` is exported from `client.ts` and re-exported by `database.provider.ts` so tasks import it from one place. `withTenant` returns `TenantTx` everywhere. `ArtifactRecord.platform` and `artifactPlatform` share the `'android' | 'ios'` union — deliberately narrower than `appPlatform`, which includes `'both'`, since a single binary is never both.

**One thing the implementer should push back on if it bites:** Task 11's staging-then-copy dance exists only because the content-addressed key is not known until the stream ends. If the client can be trusted to send the digest up front, the copy disappears — but a client-declared hash must then be verified against the computed one before the row is written, or content addressing becomes a client-controlled primitive.

---

*Plan 01 v1 — 2026-08-12.*
