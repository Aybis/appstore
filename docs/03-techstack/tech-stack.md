# Tech Stack — Internal Enterprise App Store

> Stack + rationale per layer. Status: v1.

---

## 1. Stack by Layer

| Layer | Choice | Why |
|---|---|---|
| **Frontend (web)** | React + Vite + TypeScript | Vite fast/HMR, TS-first, ecosystem besar. TanStack Query + React Router. Tailwind + shadcn/ui untuk internal-tool UI cepat. |
| **Mobile** | Expo / React Native (TS) | Satu codebase iOS+Android, Expo covers provisioning/OTA/file-system/download. EAS Build untuk signing CI. |
| **Backend** | NestJS (TS) | Struktur module-based, DI, Guards/Interceptors, TS-first — ideal untuk RBAC + approval + audit. Runs on Express (streaming `res` tersedia). |
| **ORM** | Drizzle ORM | SQLite-first, typed, schema migrasi bersih; swap ke Postgres mudah nanti. |
| **Database** | SQLite (WAL mode) | Zero ops, satu file, gampang backup. WAL + busy_timeout + single-write-connection hindari SQLITE_BUSY. |
| **Binary storage** | Local filesystem (content-addressed, SHA-256) | Minimal ops, fast reads. MinIO/S3 di balik interface `BlobStore` untuk growth. |
| **Search** | SQLite FTS5 (BM25) | Katalog kecil (ratusan app) — cukup, zero daemon. Meilisearch overkill. |
| **Auth** | JWT + Passport (local email/password) | Stateless, simple. `@nestjs/passport` + `passport-jwt`, argon2/bcrypt. RBAC via RolesGuard. |
| **SSO (v1.1)** | OIDC add-on (Keycloak/Authentik/Entra) | Auth boundary diisolasi dari awal; upgrade tanpa rewrite. |
| **Upload handling** | Multer (streamed, size cap) | Streaming ke temp, tidak buffer di memory. |
| **CDN** | None (v1) | Private Tailscale mesh — CDN tidak ada keuntungan. |
| **Deploy** | Docker Compose (1 host Tailscale) | Caddy/Traefik reverse proxy + TLS via MagicDNS HTTPS. |
| **Backup** | SQLite `.backup` + restic artifacts | Nightly, off-box, restore drill. |

## 2. Monorepo Tree

```
app-store-clone/
├── apps/
│   ├── api/            # NestJS backend
│   ├── web/            # React + Vite + TS SPA (catalog + admin)
│   └── mobile/         # Expo / React Native app
├── packages/
│   └── shared/         # Zod schemas + TS types (dibagi backend+frontend+mobile)
├── supabase/           # (tidak dipakai — pakai SQLite lokal)
├── infra/              # docker-compose.yml, Caddyfile, tailscale notes
└── docs/               # BRD, ToR, techstack, goals, timeline
```

## 3. Key Libraries (shortlist)

| Area | Library |
|---|---|
| Validation | class-validator, class-transformer (NestJS) |
| Data fetching (web) | TanStack Query, Axios |
| Mobile download | expo-file-system, expo-media-library, expo-device |
| Password hash | argon2 |
| File upload | multer |
| Logging | pino / NestJS logger |
| Testing | Jest (unit), Supertest (integration), Playwright (E2E) |

## 4. Rationale notes
- **NestJS + Drizzle + SQLite**: konsisten, TS-full, bisa naik ke Postgres tanpa rewrite besar.
- **FTS5 bukan Meilisearch**: skala internal kecil → hindari daemon tambahan + 6-10x storage.
- **Local FS bukan BLOB-in-DB**: backup/locking/file-serving jadi simpel; metadata vs binary terpisah.
- **JWT + invite-only**: sesederhana mungkin untuk v1; auth boundary siap SSO.
- **Expo masuk v1 (user decision)**: dua surface, timeline pecah per platform, tapi user memilih tetap.

---

*Dokumen: Tech Stack v1.*