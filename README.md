# MAYA — Enterprise App Store

Multi-tenant platform for distributing internal apps (Android APK + iOS IPA).
Each customer organization publishes its own builds to its own employees,
through a React Native app, a REST API, and — later — a web console.

MAYA is the mobile client: a private App Store for company-built software. It
does not just *list* apps, it **installs** them, which is why it also owns a
version-check contract that shipped apps call on launch.

---

## Status

| Area | State |
|---|---|
| **API core** — auth, org-scoped RLS, memberships | ✅ working |
| **Catalog API** — list / search / detail / download | ✅ working |
| **Signed artifact streaming** | ✅ working |
| **Version-check** for distributed apps | ✅ working |
| **Mobile** — auth, catalog, install pipeline, notifications | ✅ working |
| **Android install** — download → system installer | ✅ working |
| **iOS install** — `itms-services` manifest | ⚠️ built; needs HTTPS + a signed IPA on a real device |
| **Publish/upload endpoints** — create app, upload build, publish | ✅ working |
| **Release immutability** — enforced by trigger | ✅ working |
| **Remote push** | ⚠️ client ready, needs EAS credentials |
| **Web console** | ❌ not started |

**106 tests passing** across 16 files, including a catalog-driven RLS invariant
that automatically covers every table carrying `org_id`.

> **Docker is not used.** It is not installed on the build machine, so the test
> suite runs against a native PostgreSQL 17 cluster on port 5433 rather than
> Testcontainers, and artifacts are stored on the filesystem rather than MinIO.
> See [`database-and-storage.md`](docs/04-plan/database-and-storage.md).

---

## Quick start

Eleven ordered steps — each naming the failure it prevents — are in
**[docs/local-setup.md](docs/local-setup.md)**, including Postgres setup, the
seed, and the EAS project. The short version:

```bash
git clone https://github.com/Aybis/appstore.git && cd appstore
pnpm install
./infra/local/setup.sh                          # roles, databases, grants
cp .env.example .env

cd apps/api
DATABASE_URL="postgres://localhost:5433/appstore" npx drizzle-kit migrate
MIGRATION_DATABASE_URL="postgres://localhost:5433/appstore" pnpm seed
set -a && . ../../.env && set +a && npx nest start     # NOT tsx — see below

cd ../mobile
LAN_IP=$(ipconfig getifaddr "$(route -n get default | awk '/interface:/{print $2}')")
MAYA_API_URL="http://$LAN_IP:3000" npx expo run:android    # or run:ios
```

`pnpm seed` gives you 4 apps with published releases on both platforms, so the
app is usable immediately — no binaries required. Load real APK/IPA files later
with `pnpm ingest` or the upload API.

Sign in with `demo@maya.app` / `demo1234`.

---

## Three things that will cost you an hour each

Learned the hard way; all three fail in ways that point somewhere else.

1. **Start the API with the Nest CLI, never `tsx`.** tsx uses esbuild, which
   does not implement `emitDecoratorMetadata`, so Nest's type-based DI dies with
   `Nest can't resolve dependencies of the RolesGuard`. The `scripts/*.ts`
   helpers run fine under tsx — they use no DI.

2. **Run migrations as the schema owner.** `app_runtime` deliberately has no
   CREATE privilege, and pointing drizzle-kit at it makes the tool report
   success having created nothing.

3. **`expo.extra` is read at build time.** Changing the API URL, app name or
   icon needs a rebuild — a Metro reload will keep serving the old values, and
   `expo run:*` does **not** re-sync native config when `android/`/`ios/`
   already exist. Run `npx expo prebuild -p <platform>` first.

---

## Architecture

```
Mobile (Expo / RN)                API (NestJS)                 Postgres 17
─────────────────────             ─────────────────            ───────────
AuthProvider ──login/refresh──▶  /v1/auth/*          ──▶  users, memberships
                                                            organizations
getClient() ────catalog───────▶  /v1/apps            ──▶  apps ─ releases
  HttpAppProvider                /v1/apps/:slug              └─ artifacts
  (platform-scoped)              /v1/apps/search                  │
                                                                  │
InstallProvider ─ticket───────▶  /v1/apps/:slug/download          │
  ├─ android: download ───────▶  /download/:id/stream ◀───────────┘
  │    └─ system installer         (signed, public)         ./store
  └─ ios: itms-services ──────▶  /download/:id/manifest.plist
                                                        (content-addressed
Shipped apps ────version──────▶  /v1/version-check         by SHA-256)
  (HR Portal, etc.)                (public, metadata only)
```

**Tenancy is enforced in the database, not the service layer.** Every table with
`org_id` has RLS `ENABLE`d **and `FORCE`d** with a policy; `withTenant()` is the
only sanctioned path to tenant data, opening a transaction, dropping to the
non-privileged `app_runtime` role, and binding `app.current_org_id` for the
transaction's lifetime.

**Every route is authenticated by default.** Guards are global; `@Public()` is
the explicit, auditable opt-out — currently health, signup, login, refresh,
version-check, and the signed artifact stream.

---

## Repo structure

```
apps/
  api/          NestJS — auth, catalog, publish, downloads, version-check
    drizzle/    7 SQL migrations (RLS and immutability live here, not in code)
    scripts/    seed-demo.ts, ingest-binaries.ts, seed-member.ts, prune-store.ts
  mobile/       Expo SDK 57 / RN 0.86 — the MAYA client
    app/        expo-router routes (onboarding, auth, tabs, detail)
    src/
      api/      AppStoreClient seam: mock ⇄ http provider
      auth/     AuthProvider — the only thing screens touch
      install/  download → installer pipeline + state
      components/  atomic design: atoms → molecules → organisms → templates
packages/
  shared/       Zod contracts shared by API and clients
infra/local/    setup.sh — roles, databases, grants
docs/           spec, plans, and the setup runbook
store/          content-addressed artifacts (gitignored)
```

`apps/mobile` follows [atomic design](https://atomicdesign.bradfrost.com/chapter-2/);
the rule that keeps it honest is *what a component may know* — atoms see only
theme tokens, molecules take primitives, organisms know `App`, templates own
layout, pages own data. See [apps/mobile/README.md](apps/mobile/README.md).

---

## Platform realities

Non-obvious constraints that shape the product, not bugs to fix:

- **iOS cannot install an IPA from a plain link.** It needs an
  `itms-services://` manifest over **HTTPS**, an IPA signed with your
  ad-hoc/enterprise certificate, and a **physical device**. The Simulator can
  never install an IPA — it runs simulator-architecture bundles.
- **App Store IPAs are FairPlay-encrypted** and will not install anywhere,
  however they are signed.
- **Neither platform lets an app enumerate what else is installed** — iOS has no
  API, Android gates it behind the Play-restricted `QUERY_ALL_PACKAGES`. "My
  Apps" is therefore built from installs made *through MAYA*, not read off the OS.
- **Android install needs `REQUEST_INSTALL_PACKAGES`** plus a one-time per-app
  grant the user makes in Settings.
- **An arm64-only device cannot run a 32-bit-only APK.** Check before blaming
  the store: `aapt2 dump badging <apk> | grep native-code`.

---

## Documentation

- **[Local Setup](docs/local-setup.md)** — clone to running app ⬅ start here
- [Plan Overview](docs/04-plan/00-overview.md) — phase sequencing and spec deltas
- [Plan 01 — API Core](docs/04-plan/01-api-core.md)
- [Database & Storage](docs/04-plan/database-and-storage.md) — measured local behaviour
- [Mobile README](apps/mobile/README.md) — component layers, auth, install
- [Progress](docs/00-progress.md) — decision log
- [BRD](docs/01-brd/BRD.md) · [ToR](docs/02-tor/ToR.md) · [Tech Stack](docs/03-techstack/tech-stack.md) *(partly superseded)*

> ⚠️ Docs 01/02/03/06 were written for a **single-tenant self-hosted**
> architecture before the 2026-08-12 pivot. The delta table in the
> [plan overview](docs/04-plan/00-overview.md#spec-deltas--what-this-supersedes)
> marks which rows no longer apply.

---

## Roadmap

Next, in order:

1. **Serve over HTTPS** (`PUBLIC_BASE_URL`) — the last thing between the
   `itms-services` manifest and a working iOS install
2. **Device registration + push sender** — remote push once EAS credentials exist
3. **Web console** — publisher upload, org admin, audit viewer

## Stack

Expo SDK 57 / React Native 0.86 · NestJS 11 · PostgreSQL 17 + Drizzle + RLS ·
pnpm workspaces · Zod contracts · JWT (org-scoped, 15-min access + refresh)
