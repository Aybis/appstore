# App Store Clone — Progress Log

> Single source of truth. Append-only. Update after EVERY phase & user touchpoint.

## Status
**Phase:** 3 (RESEARCH) — in progress
**Project dir:** /Users/horus/Sandbox/app-store-clone/

## 2026-08-09 — Fase 1+2: ENHANCE + CLARIFY (COMPLETE)
**Prompt user:** "buatkan clone playstore/appstore"

### ✅ KEPUTUSAN LENGKAP (dari clarify)
1. **Level install**: Full marketplace OS tertentu — repo APK/IPA yang bisa di-install device
2. **Platform frontend**: Web app (React/Vite/TS) + mobile app (Expo/RN)
3. **Target/scale**: Korporat/internal — distribusi app internal perusahaan, user tertentu
4. **Mekanisme install**: Web app — browse & download APK/IPA
5. **OS target**: Android (APK) + iOS (IPA) — dua platform
6. **Auth**: Email/password (JWT) + opsi SSO (OAuth2/SAML)
7. **Upload**: Hanya admin/dev yang bisa upload
8. **Infra**: Local/private — self-host + Tailscale + SQLite
9. **Approval**: Ada approval flow — app di-review admin dulu sebelum tampil

### Definisi produk (final)
**Internal Enterprise App Store** — platform distribusi app internal perusahaan:
- Marketplace katalog app internal (Android APK + iOS IPA)
- User internal (auth email/password + SSO)
- Admin/dev upload app + versi → approval flow → tampil
- User browse/search/detail/download APK/IPA dari web
- Mobile app (Expo/RN) untuk experience on-device
- Self-hosted, local/private, Tailscale access, SQLite

## 2026-08-09 — Fase 3: RESEARCH (dimulai)
Research target: feature set, architecture, infra, tech stack, komparator (F-Droid, Aptoide, Google Play, Apple App Store, enterprise MDM/app stores).

## 2026-08-09 — Fase 3: RESEARCH (COMPLETE)
Research done via 2 parallel subagents. Reports saved to docs/_research/.

### Fitur & user flows (ringkasan)
- **User**: browse grid + kategori, search (nama+deskripsi), featured, filter/sort, app detail (ikon/versi/size/deskripsi/screenshots/release notes/min OS/rating), download APK/IPA, update detection, rating/review, favorites, notif.
- **Admin/dev**: upload binary+metadata, multi-version mgmt (promote/rollback), approval flow (pending→approve/reject+reason), publish/unpublish, edit metadata tanpa re-upload binary, screenshots/ikon, release notes, RBAC (viewer/developer/admin).
- **User flow**: home→browse→search→detail→download→rate→favorite→update. **Admin flow**: upload→metadata→draft→submit→approve→live→update→unpublish.
- **Metadata**: nama, package/bundle id, versi+code, platform, min OS, size (auto), ikon, screenshots, deskripsi, release notes, kategori, developer, rating, tanggal rilis.

### Arsitektur & stack (ringkasan)
- **Arsitektur**: NestJS monolith (JSON API + streaming binary) — web SPA + Expo mobile = 2 client, 1 backend. No CDN (Tailscale private). Binaries di local FS content-addressed (SHA-256), DB cuma metadata.
- **Stack**: React+Vite+TS (web) · Expo/RN (mobile) · **NestJS** (backend) · **SQLite WAL + Drizzle ORM** (DB, swap ke PG gampang) · local FS (binaries, MinIO nanti) · **SQLite FTS5** (search) · JWT+Passport (auth) + OIDC SSO add-on (Keycloak/Authentik/Entra).
- **Serve APK/IPA**: streaming + Range (resumable), SHA-256 checksum + X-Checksum header, opsional ClamAV scan, size cap 2GB, store dir luar web root, download butuh auth.
- **Data model**: users, roles, user_roles, apps, app_versions (status draft|pending|approved|rejected|live|unpublished), downloads, reviews, approvals (audit), tokens, app_fts.
- **Deploy**: Docker Compose di 1 host Tailscale, Caddy/Traefik TLS via MagicDNS, backup SQLite .backup + restic. iOS install via itms-services:// manifest / MDM.

## 2026-08-09 — Fase 3b: WAR ROOM (COMPLETE)
8 role SDLC debat scope v1. Output lengkap: docs/war-room.md. Models gpt-5.4, codex backend, 2 rounds.

### VERDICT WAR-ROOM (consensus)
V1 harus **web-only** (web admin + web catalog + API), BUKAN mobile app. Approval war-room menentukan scope yang dipangkas:
- **POTONG dari v1**: Expo mobile app, ClamAV, approval workflow formal, SSO (kecuali sudah paved), request-access workflow, granular RBAC, notifikasi/analytics.
- **WAJIB di v1**: web admin + web catalog responsif + API, SQLite metadata, artifact storage terpisah, local auth invite-only (SSO hanya kalau siap), RBAC sederhana (admin/publisher/viewer), domain model (app/release/artifact/visibility/audit), release lifecycle (draft/published/archived), immutable releases, checksum + size/type validation, audit log, Android install flow jalan, iOS minimal (metadata + instructions).
- **Conviction tertinggi**: Architect 96, Infra 96, Tech Lead 95 → converge "web-only, minimal core, operable first".

### RISIKO KUNCI (dari war-room)
- Scope melebar (mobile+SSO+approval+scan) → lock v1 web-only
- iOS distribution lebih sulit dari asumsi → pisahkan DoD Android vs iOS
- Local auth jadi hutang → isolasi auth boundary, rencanakan migrasi OIDC
- Rilis salah tayang → publisher whitelist + immutable releases + audit

### KEPUTUSAN AKHIR (ditandatangani user)
Scope v1 = **web-only enterprise app store** dengan local auth invite-only, RBAC admin/publisher/viewer, upload+approval-minimal, download, checksum, audit log. Expo mobile app, SSO, ClamAV, approval workflow formal = ditunda.

> Catatan: user awal minta Expo mobile + SSO + approval flow di clarify, tapi war-room 8 role merekomendasikan memotong semuanya dari v1 untuk tim kecil self-host. Ini KONFLIK — perlu konfirmasi ulang ke user di Phase 5 (SPEC) sebelum di-lock.

### ⚖️ KEPUTUSAN FINAL (user override war-room, 2026-08-09)
User memutuskan: **Tetap pengen Expo mobile dari awal — Expo mobile app MASUK v1**, walau lebih berat. Ini override rekomendasi war-room (yang bilang web-only).
- **Keputusan DITERIMA**: Expo mobile app = scope v1 (web + mobile).
- **Tetap tunda** (ikut war-room): ClamAV, approval workflow formal → publisher whitelist + immutable release + audit. SSO → local auth invite-only dulu, arsitektur siap upgrade OIDC.
- **ToR/BRD harus mencakup**: web app (React/Vite/TS) + mobile app (Expo/RN) + API (NestJS) + SQLite + artifact storage.
- Implikasi: DoD & timeline harus pecah per platform (web + mobile + API), uji dua surface.

## 2026-08-09 — Fase 5: SPEC (COMPLETE — menunggu sign-off user)
Semua dokumen spec ditulis:
- `docs/01-brd/BRD.md` — business requirements, pillars P1-P5, FR, NFR, KPIs, risks, scope, DoD
- `docs/02-tor/ToR.md` — architecture, data model (SQLite), process flows, REST API, security, testing
- `docs/03-techstack/tech-stack.md` — stack per layer + monorepo tree + rationale
- `docs/05-goals/goals-deliverables.md` — SMART goals, deliverables per phase, DoD per platform
- `docs/06-timeline/timeline-gantt.md` — 5 phase/5 minggu + Gantt + critical path + risk

**RINGKASAN FINAL v1**:
- Web (React/Vite/TS) + Mobile (Expo/RN) + API (NestJS) + SQLite (Drizzle) + local FS binaries + FTS5 search + JWT local auth (invite-only) + RBAC (admin/publisher/viewer) + approval-min (publisher gate + immutable release + audit) + checksum + download streaming.
- Deploy: Docker Compose 1 host Tailscale, TLS MagicDNS.
- Non-goals v1: SSO, ClamAV, approval workflow formal, rating/review, analytics, notifikasi.
- Timeline: 5 minggu, 5 phase.

**STATUS: MENUNGGU APPROVAL USER** — perlu konfirmasi "ini yang gue mau" sebelum build.