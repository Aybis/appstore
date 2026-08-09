# Internal Enterprise App Store

Platform self-hosted untuk distribusi app internal perusahaan (Android APK + iOS IPA). Clone Play Store/App Store khusus internal — privat, terkontrol, dan aman.

## Stack
- **Web**: React + Vite + TypeScript
- **Mobile**: Expo / React Native
- **Backend**: NestJS (TypeScript)
- **DB**: SQLite (WAL) + Drizzle ORM
- **Storage**: Local filesystem (content-addressed, SHA-256)
- **Search**: SQLite FTS5
- **Auth**: JWT + Passport (invite-only, siap upgrade SSO/OIDC)
- **Deploy**: Docker Compose · Tailscale · TLS MagicDNS

## Dokumentasi
Lihat `docs/`:
- [BRD](docs/01-brd/BRD.md) — business requirements
- [ToR](docs/02-tor/ToR.md) — technical spec, data model, API
- [Tech Stack](docs/03-techstack/tech-stack.md)
- [Goals & Deliverables](docs/05-goals/goals-deliverables.md)
- [Timeline & Gantt](docs/06-timeline/timeline-gantt.md)
- [Progress](docs/00-progress.md) — log keputusan & status

## Structure
```
apps/
  api/     # NestJS backend
  web/     # React SPA (catalog + admin)
  mobile/  # Expo app
packages/
  shared/  # shared TS types + Zod schemas
infra/     # docker-compose, Caddyfile
docs/      # spec documents
```

## Status
Menunggu sign-off spec → BUILD. Lihat `docs/00-progress.md`.