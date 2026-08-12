# Implementation Plan — Overview & Spec Deltas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-tenant B2B SaaS enterprise app store — customer organizations distribute their own internal Android and iOS builds to their own employees through a React Native app, a web console, and a REST API.

**Architecture:** A NestJS monolith exposes a versioned REST API over Postgres (shared schema, `org_id` on every tenant table, enforced by Row Level Security) and S3-compatible object storage for binaries. Two clients consume it: an Expo React Native app (the primary surface) and a React web console. Platform-specific install mechanics live behind a `DistributionPort` interface so Android's package-installer flow, iOS `itms-services://`, and a future MarketplaceKit adapter are swappable without touching domain code.

**Tech Stack:** TypeScript · pnpm workspaces · NestJS 11 · Postgres 16 + Drizzle ORM + RLS · S3-compatible object storage (MinIO local, S3/R2 prod) · Zod (shared schemas) · Expo SDK latest + EAS (New Architecture, development build) · React + Vite (console) · Stripe (billing) · Vitest + Supertest + Testcontainers

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Node >= 22 LTS**, **pnpm >= 9**. Pin via `.nvmrc` and `packageManager` field.
- **TypeScript `strict: true`**. `@typescript-eslint/no-explicit-any` set to `error`. No `as any` escape hatches.
- **Every table holding tenant data carries `org_id uuid NOT NULL`** and has an RLS policy. No exceptions.
- **The runtime database role must NOT have `BYPASSRLS`.** Migrations run as the owner role; the application connects as `app_runtime`. RLS is enforced with `FORCE ROW LEVEL SECURITY` so even the table owner is subject to it.
- **Never deduplicate artifacts across organizations.** Content-addressed storage keys are scoped per org (`orgs/{orgId}/artifacts/{sha256}`). Cross-tenant dedupe would leak the existence of another tenant's binary through timing and storage accounting.
- **All monetary values are integers in minor units** (cents). Never floating point.
- **Artifact upload hard cap: 2 GiB** (`2147483648` bytes) — carried forward from BRD FR-2.7.
- **SHA-256 is computed during upload streaming**, never by re-reading the stored object.
- **Published releases are immutable.** No mutation path may exist for a release in `published` state; a correction is a new release row.
- **Docker must be running** for the test suite — Testcontainers provisions Postgres and MinIO per suite.
- **Expo development build only.** Expo Go cannot carry `REQUEST_INSTALL_PACKAGES` or config plugins and is unsupported for this project.
- **Conventional Commits** for every commit message.
- **No secrets in the repository.** `.env` is gitignored; `.env.example` documents every variable with a non-secret placeholder.

---

## Spec Deltas — What This Supersedes

The documents in `docs/01-brd/`, `docs/02-tor/`, and `docs/03-techstack/` describe a **single-tenant, self-hosted, Tailscale-private** system. The 2026-08-12 decisions changed the product into a **multi-tenant B2B SaaS**. Those documents remain the record of intent for everything not listed below; the rows below are superseded.

| Area | Signed spec | Superseded by | Why |
|---|---|---|---|
| **Tenancy** | Single company, one deployment | Multi-tenant; `organization` is the tenant boundary | Product is now B2B SaaS |
| **Database** | SQLite WAL, single file (`tech-stack.md:15`) | Postgres 16+ with Row Level Security | Tenant isolation, concurrent writers, billing-grade audit retention |
| **Binary storage** | Local filesystem, content-addressed (`ToR.md:29`) | S3-compatible object storage, per-org key prefix | No shared host across tenants; durability and quota accounting |
| **Network exposure** | Tailscale only, "zero public exposure" (NFR-1, KPI-4, G3) | Public TLS ingress; isolation moves to authn/authz + RLS | Customers cannot join your tailnet |
| **Auth** | Invite-only, no self-service registration (FR-4.1) | Self-serve org signup; invite-only *within* an org. Per-org OIDC in backlog | Billing requires self-serve onboarding |
| **Search** | SQLite FTS5 (`tech-stack.md:17`) | Postgres `tsvector` + GIN index | Follows the database change |
| **Validation** | class-validator DTOs (`ToR.md:130`) | Zod schemas in `packages/shared` via `nestjs-zod` | One schema definition shared by API, RN app, and console |
| **Test runner** | Jest + Supertest (`tech-stack.md:50`) | Vitest + `unplugin-swc` + Supertest + Testcontainers | Single runner across the monorepo; swc handles `emitDecoratorMetadata` |
| **Billing** | Absent | Stripe: plans, seat counts, storage quotas, self-serve checkout | User decision |
| **Surface order** | Web M3, mobile minimal M4 (`timeline-gantt.md:41`) | API core → RN app → web console | User decision |
| **iOS distribution** | "metadata + instructions" only (`goals-deliverables.md:30`) | `DistributionPort` interface; `itms-services` adapter ships v1; MarketplaceKit adapter deferred behind Apple entitlement | User decision |
| **Timeline** | 5 weeks (`timeline-gantt.md`) | Re-baselined per plan; scope is roughly 3× | Consequence of the above |

### Carried forward unchanged

Immutable published releases · SHA-256 checksums · append-only audit log · RBAC · release lifecycle (`draft`/`published`/`archived`) · streaming download with HTTP `Range` · 2 GiB upload cap · isolated auth boundary for future OIDC.

### Known external gate

The EU alternative-marketplace path requires Apple's `com.apple.developer.marketplace.app-installation` entitlement, app notarization, and a €1,000,000 standby letter of credit. **This is an eligibility gate, not an engineering task.** Plan 03 therefore builds the `DistributionPort` abstraction with a working `ItmsServicesAdapter` (tenant supplies their own Apple credentials) so iOS is testable end-to-end today. `MarketplaceKitAdapter` is a stub with a defined interface and no implementation until the entitlement exists.

---

## Plan Index & Sequencing

| # | Plan | Delivers working software that... | Depends on |
|---|---|---|---|
| **01** | [`01-api-core.md`](01-api-core.md) | Signs up an org, authenticates users, enforces RLS isolation, publishes an immutable release, streams an artifact download, writes audit events | — |
| **02** | `02-distribution.md` | Serves platform-correct install descriptors: Android package-installer metadata, iOS `itms-services` manifest.plist signed per tenant | 01 |
| **03** | `03-mobile-app.md` | Expo dev build: login, org catalog, app detail, download, Android system-installer handoff, iOS manifest handoff | 01, 02 |
| **04** | `04-billing.md` | Stripe checkout, plan tiers, seat and storage quota enforcement, webhook reconciliation | 01 |
| **05** | `05-web-console.md` | Publisher upload/publish UI, org admin (members, roles, billing), audit viewer | 01, 02, 04 |

Plans 04 and 05 are independent of 02/03 and of each other except where noted; 04 must land before 05's billing screens.

**Only Plan 01 is written in full.** Plans 02–05 are written as each becomes next — their task detail depends on interfaces that Plan 01 establishes, and writing them now would guess at signatures rather than reference them.

---

## Definition of Done — v1

1. A new organization can self-serve sign up, be billed, and invite members with roles.
2. A publisher in org A can upload an APK and an IPA, publish immutable releases, and see audit events.
3. A viewer in org A sees only org A's catalog. **Verified by an automated cross-tenant isolation test, not by inspection.**
4. The Expo app on Android downloads an APK and hands it to the system installer, and the install completes.
5. The Expo app on iOS renders an `itms-services://` install link generated from tenant-supplied Apple credentials.
6. Storage and seat quotas are enforced against the org's Stripe plan.
7. `pnpm test` is green, including cross-tenant isolation and release-immutability suites.

---

*Plan set v1 — 2026-08-12. Supersedes the timeline in `docs/06-timeline/timeline-gantt.md`.*
