# MAYA — Enterprise App Store

A private app store for company-built apps. An organization publishes its
Android (APK) and iOS (IPA) builds, and its people install them from the MAYA
mobile app or the web portal.

| Side | Folder | Stack | README |
|---|---|---|---|
| API + database | `apps/api` | NestJS, Drizzle ORM, PostgreSQL 17 | [apps/api](apps/api/README.md) |
| Web console | `apps/console` | React 19, Vite, React Router | [apps/console](apps/console/README.md) |
| Mobile app | `apps/mobile` | Expo SDK 57, React Native, expo-router | [apps/mobile](apps/mobile/README.md) |
| Shared types | `packages/shared` | Zod contracts used by all three | — |
| Deploy | `deploy/` + `docker-compose.yml` | Docker, Caddy, Vercel, Supabase, R2 | [deploy](deploy/README.md) |

## Folder structure

```
appstore/
├── .env.example            one env file for every side (copy to .env)
├── docker-compose.yml      production: API + Caddy on the Tencent server
├── package.json            root scripts: pnpm dev:api, dev:console, ...
├── apps/
│   ├── api/
│   │   ├── database/       local Postgres setup + Supabase bootstrap SQL
│   │   ├── drizzle/        SQL migrations (RLS and triggers live here)
│   │   ├── scripts/        seed, ingest, publish-client helpers
│   │   ├── src/
│   │   │   ├── config/     env loading + validation
│   │   │   ├── database/   Drizzle schema, client, tenant (RLS) helper
│   │   │   ├── modules/    one folder per feature: auth, catalog, publish, ...
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   └── test/           e2e tests against a real Postgres
│   ├── console/
│   │   └── src/
│   │       ├── components/ atoms → molecules → organisms → templates
│   │       ├── pages/      one file per route
│   │       ├── services/   API client + auth session
│   │       ├── styles/     design tokens + shared CSS
│   │       └── utils/
│   └── mobile/
│       ├── app/            expo-router screens (the "pages" layer)
│       └── src/
│           ├── components/ atoms → molecules → organisms → templates
│           ├── hooks/
│           ├── services/   api, auth, install, notifications, storage, ...
│           ├── theme/      palettes, tokens, layout constants
│           └── utils/
├── packages/shared/        Zod contracts shared by API and clients
├── deploy/                 Dockerfile, Caddyfile, deploy guide
└── docs/                   data model (ERD) and security review
```

## Quick start (everything on your machine)

You need Node 22+, pnpm (`corepack enable`) and PostgreSQL 17 on port 5433.
The [API README](apps/api/README.md) explains the Postgres setup.

```bash
pnpm install
cp .env.example .env

pnpm db:setup        # roles + databases (once)
pnpm db:migrate      # apply migrations
pnpm db:seed         # demo org, apps and a login

pnpm dev:api         # http://localhost:3000
pnpm dev:console     # http://localhost:5173
pnpm dev:mobile      # Expo / Metro (see the mobile README for devices)
```

Sign in with `demo@maya.app` / `demo1234`.

Checks for the whole repo:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Environment

There is **one** `.env`, at the repo root, and every side reads it:

- the API loads it on start (`apps/api/src/config/load-env.ts`),
- the console reads it through Vite (`envDir`), and only `VITE_*` values reach the browser,
- the mobile app reads it in `app.config.js` at build time.

Values already set in your shell win over the file, so a one-off override like
`PORT=4000 pnpm dev:api` still works. `.env.example` lists every variable and
what to use in production.

## App IDs

The MAYA app is `com.maya.store`. Apps you publish through it follow the same
pattern and only the last part changes: `com.maya.hrportal`,
`com.maya.expenses`, `com.maya.fieldscanner`.

The id is set in `apps/mobile/app.json` (`ios.bundleIdentifier` and
`android.package`). How to register it with Apple and Google is in the
[mobile README](apps/mobile/README.md#app-id-package-name).

## Docs

- [Data model (ERD)](docs/erd.md)
- [Security review](docs/security.md)
- [Deploying](deploy/README.md)
