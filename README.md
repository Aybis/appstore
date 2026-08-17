# Enterprise App Store — B2B SaaS

Platform multi-tenant untuk distribusi app internal (Android APK + iOS IPA). Setiap organisasi customer mendistribusikan build internal-nya sendiri ke karyawannya sendiri — lewat app React Native, web console, dan REST API.

## Stack
- **Mobile**: Expo SDK latest (New Architecture, **development build**) + EAS — surface utama
- **Web console**: React + Vite + TypeScript
- **Backend**: NestJS (TypeScript)
- **DB**: Postgres 16 + Drizzle ORM + **Row Level Security**
- **Storage**: S3-compatible object storage, content-addressed per-org (SHA-256)
- **Search**: Postgres `tsvector` + GIN
- **Auth**: JWT org-scoped, self-serve signup + invite dalam org (siap OIDC per-org)
- **Billing**: Stripe — plan tiers, seat + storage quota
- **Distribusi iOS**: `DistributionPort` — adapter `itms-services` jalan sekarang, MarketplaceKit menunggu entitlement Apple

## Dokumentasi
Lihat `docs/`:
- **[Local Setup](docs/local-setup.md)** — bring the whole stack up on a new machine ⬅ start here to run it
- **[Plan Overview](docs/04-plan/00-overview.md)** — delta vs spec lama, global constraints, index plan ⬅ mulai di sini
- **[Plan 01 — API Core](docs/04-plan/01-api-core.md)** — 14 task TDD, siap dieksekusi
- [Progress](docs/00-progress.md) — log keputusan & status
- [BRD](docs/01-brd/BRD.md) — business requirements *(sebagian superseded, lihat plan overview)*
- [ToR](docs/02-tor/ToR.md) — technical spec *(sebagian superseded)*
- [Tech Stack](docs/03-techstack/tech-stack.md) *(sebagian superseded)*
- [Goals & Deliverables](docs/05-goals/goals-deliverables.md)
- [Timeline & Gantt](docs/06-timeline/timeline-gantt.md) *(superseded — scope ~3×)*

> ⚠️ Dokumen 01/02/03/06 ditulis untuk arsitektur **single-tenant self-hosted** sebelum pivot 2026-08-12. Tabel delta di [plan overview](docs/04-plan/00-overview.md#spec-deltas--what-this-supersedes) menandai baris mana yang sudah tidak berlaku.

## Structure
```
apps/
  api/     # NestJS backend (multi-tenant, RLS)
  mobile/  # Expo / React Native app
  web/     # React SPA (console: publisher + org admin)
packages/
  shared/  # Zod schemas + TS types, dipakai ketiganya
infra/     # docker-compose, ingress, migrations
docs/      # spec + plan
```

## Status
Plan set v1 selesai. **Plan 01 (API core) siap dieksekusi** — belum ada kode.

Prasyarat lokal: Node >= 22, pnpm >= 9, dan **Docker harus jalan** (test suite pakai Testcontainers untuk Postgres + MinIO).