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

## 2026-08-12 — PIVOT: internal single-tenant → B2B SaaS multi-tenant

**Prompt user:** "clone app play/app store pakai React Native (latest) android + iOS, scalable, enterprise grade, B2B SaaS"

Spec v1 (2026-08-09) tidak pernah di-sign-off. Sebelum eksekusi, 4 keputusan diambil user. Ini **mengubah arsitektur inti**, bukan sekadar nambah fitur.

### ⚖️ KEPUTUSAN USER (2026-08-12)

1. **Tenancy → Full B2B SaaS termasuk billing.** Organization = tenant boundary. Self-serve signup, plan tiers, Stripe, seat + storage quota. Bukan lagi satu perusahaan satu deployment.
2. **Mobile → Expo SDK latest, New Architecture, development build + EAS.** Bukan Expo Go — Expo Go tidak bisa bawa `REQUEST_INSTALL_PACKAGES` maupun config plugin.
3. **Build order → API core → RN app → web console.** Override timeline lama (web M3, mobile minimal M4).
4. **iOS → EU alternative app marketplace**, dibangun di balik interface. `DistributionPort` dengan `ItmsServicesAdapter` (tenant pakai Apple account sendiri) jalan di v1; `MarketplaceKitAdapter` menunggu entitlement Apple.

### Konsekuensi arsitektur (bukan pilihan terpisah — ikutan otomatis)
- SQLite → **Postgres 16 + Row Level Security**. Isolasi tenant tidak boleh cuma di service layer.
- Local FS → **S3-compatible object storage**, key di-prefix per org. **Tidak boleh dedupe artifact antar-org.**
- Tailscale-only → **public TLS ingress**. NFR-1 dan KPI-4 ("zero eksposur publik") gugur — customer tidak bisa masuk tailnet kita.
- FTS5 → Postgres `tsvector` + GIN.
- class-validator → Zod di `packages/shared`, satu skema dipakai API + RN + console.
- Timeline 5 minggu **gugur** — scope kira-kira 3×.

### Jawaban teknis yang menentukan keputusan #2
- **Android bisa install.** `expo-file-system` `getContentUriAsync()` → `expo-intent-launcher` `INSTALL_PACKAGE` → system installer sheet. Butuh `REQUEST_INSTALL_PACKAGES` + user grant "install unknown apps" (Android 8+). Silent install = Device Owner/MDM saja, tidak untuk store app biasa.
- **iOS tidak bisa, dan tidak ada app manapun yang bisa.** Semua jalur menyerahkan ke OS: `itms-services://`, MDM, TestFlight, App Store, atau alternative marketplace.
- MarketplaceKit butuh custom native module Swift baik di Expo maupun bare RN — jadi bare RN tidak memberi keuntungan di sini.

### ⚠️ GATE EKSTERNAL (bukan task engineering)
EU alternative marketplace butuh entitlement `com.apple.developer.marketplace.app-installation`, notarization Apple, dan **standby letter of credit €1.000.000**. Status: belum dimulai. Karena itu iOS dibangun di balik port + adapter — ada jalur yang benar-benar jalan hari ini, MarketplaceKit masuk belakangan tanpa rewrite.

### Yang TIDAK berubah
Immutable release · SHA-256 checksum · audit log append-only · RBAC · lifecycle draft/published/archived · streaming download · cap 2 GiB · auth boundary siap OIDC.

## 2026-08-12 — Fase 4: PLAN (slot docs/04 yang selama ini kosong)

Scope dipecah jadi 5 plan — masing-masing menghasilkan software yang jalan & bisa dites sendiri:
- `docs/04-plan/00-overview.md` — delta vs spec lama, global constraints, index, DoD v1
- `docs/04-plan/01-api-core.md` — **ditulis lengkap**, 14 task TDD
- `02-distribution.md` · `03-mobile-app.md` · `04-billing.md` · `05-web-console.md` — ditulis saat gilirannya tiba (signature-nya bergantung interface dari Plan 01)

Plan 01 mencakup: monorepo, NestJS + env typed, Drizzle + Testcontainers, **RLS + `withTenant()`**, argon2 + signup transaksional, JWT org-scoped, RBAC guard, apps domain, releases + immutability level-database (trigger), BlobStore port + S3 adapter, upload hash-on-write, presigned download, audit log append-only (privilege-enforced), OpenAPI.

**STATUS: plan set v1 selesai — Plan 01 siap dieksekusi.**
## 2026-08-16 → 08-17 — Fase 5: EKSEKUSI (Plan 01 → 02 → 03)

Dari "plan siap dieksekusi" jadi stack yang jalan end-to-end: publisher upload
build → katalog → download bertanda tangan → install di device.

### Yang jadi
- **Plan 01 (API core)** — auth (signup/login/**refresh**), RLS `ENABLE`+`FORCE`
  di tiap tabel ber-`org_id`, `withTenant()`, RBAC per-request, apps + releases
  + artifacts, **immutability level-database (trigger, migration 0006)**.
- **Plan 02 (distribution)** — `DistributionPort` + `AndroidAdapter` +
  `ItmsServicesAdapter`. Manifest plist lolos `plutil -lint`, bundle id asli
  diambil dari IPA waktu ingest.
- **Plan 03 (mobile)** — MAYA: onboarding, auth, 3 tab, katalog real,
  filter per-platform, pipeline install in-app (resumable), notifikasi lokal.
- **Publish endpoints** — `POST /v1/apps`, `POST /v1/apps/:slug/releases`
  (multipart), `POST .../publish`. Binary tidak lagi masuk lewat script lokal.
- **Version-check** — `GET /v1/version-check`, public, dipanggil app terdistribusi
  tiap launch. `minimum_version` = lantai forced-update (migration 0005).

106 test / 16 file hijau.

### Keputusan yang diambil di jalan
- **Docker tetap tidak dipakai.** Postgres 17 native di port 5433, artifact ke
  filesystem `./store` (content-addressed SHA-256), bukan MinIO.
- **Download URL ditandatangani HMAC**, bukan bearer token — Android
  DownloadManager ambil URL di proses sendiri dan tidak meneruskan header
  `Authorization`. Signature mengikat artifact ke satu org + expiry 15 menit.
- **Version-check sengaja `@Public()`** — pemanggilnya app LAIN (HR Portal),
  tidak punya sesi user. Balikannya metadata + deep link saja; binary tetap di
  balik ticket ber-tanda tangan. Kalau nanti tidak cukup, jawabannya API key
  per-org, bukan JWT user.
- **Katalog di-scope per platform.** Tanpa itu iPhone ditawari APK yang tidak
  akan pernah bisa dipasang.

### Temuan yang mahal (semua gagal sambil menunjuk ke tempat lain)
- `0002_rls.sql` menulis literal marker statement-breakpoint **di komentarnya
  sendiri**. drizzle-orm split teks mentah tanpa sadar komentar → migration
  diam-diam no-op. Sudah diperbaiki.
- **`tsx` tidak bisa menjalankan app Nest** — esbuild tidak implement
  `emitDecoratorMetadata`, DI mati di `RolesGuard`. Pakai Nest CLI (SWC).
- **`expo.extra` dibaca saat build**, bukan disajikan Metro. Ganti API URL /
  nama / ikon wajib rebuild, dan `expo run:*` **tidak** re-sync config native
  kalau `android/`/`ios/` sudah ada — `expo prebuild -p <platform>` dulu.
- Access token 15 menit tapi **tidak ada endpoint refresh** → tiap klien mati
  diam-diam setelah seperempat jam, muncul sebagai "you do not have access".
- drizzle membungkus error driver di `DrizzleQueryError` (PostgresError di
  `cause`), jadi cek `error.code` di level atas tidak pernah kena.

### Batas platform (bukan bug, jangan dicoba "diperbaiki")
- **Simulator iOS tidak akan pernah bisa install IPA.** Butuh manifest
  `itms-services` di atas **HTTPS**, IPA ditandatangani ad-hoc/enterprise, dan
  **device fisik**.
- **IPA dari App Store ter-enkripsi FairPlay** — tidak akan terpasang di mana pun.
- **Tidak ada OS yang mengizinkan app meng-enumerasi app lain.** "My Apps"
  dibangun dari log install MAYA sendiri.
- **Device arm64-only tidak bisa menjalankan APK 32-bit-only.** Instagram
  APKPure `armeabi-v7a` ditolak Android dengan benar.

### Belum jadi
Audit log append-only · OpenAPI · S3 adapter (masih filesystem) · HTTPS
(`PUBLIC_BASE_URL`) · device registration + push sender · Plan 04 billing ·
Plan 05 web console.

> Runbook mesin baru: [`docs/local-setup.md`](local-setup.md).

## 2026-08-17 — Housekeeping: garbage collection untuk artifact store

Store bersifat append-only dan **tidak pernah menghapus apa pun**. Itu benar
selama release-nya masih ada (published release immutable, device bisa menarik
kapan saja), tapi menghapus app hanya meng-cascade baris database — byte-nya
menggantung selamanya.

`scripts/prune-store.ts` menutup itu: cari objek yang tidak direferensikan
baris `artifacts` mana pun, laporkan, hapus kalau `--delete`. Orphan dicari
lewat selisih, **bukan umur file**, jadi tidak ada race dengan upload baru.

Detail yang menentukan benar/tidaknya: `artifacts` itu RLS-FORCEd bahkan untuk
owner, jadi script harus mengikat GUC per-org. Kalau tidak, semua objek terbaca
sebagai orphan — dan dengan `--delete` store-nya habis.

Diverifikasi: 15 objek, 15 direferensikan, 0 orphan; lalu satu file palsu
disuntikkan → terdeteksi, dihapus, 15 objek tersisa utuh.

Catatan disk: `ingest-binaries.ts` menyalin pakai `cp -c`, jadi di APFS store
berbagi block dengan folder sumber — clone 468 MB memakan ~1 MB nyata. Yang
benar-benar besar justru cache: DerivedData 5.4 G + build Android 1.1 G
dibersihkan, 6 GB kembali.

## 2026-08-17 — Merge ke `main`

`dev/feature/catalog-api-install-pipeline` (12 commit) di-merge `--no-ff` ke
`main` dan di-push. 73 file, +3971/−219. 106 test hijau, tiga package typecheck
bersih sebelum merge.

### Dependabot: 4 advisory di default branch
Dicek lokal dengan `pnpm audit` — **semua transitif dari toolchain Expo/Metro,
tidak satupun di jalur runtime API atau app**:

| Sev | Paket | Patched | Catatan |
|---|---|---|---|
| high | `image-size` | *belum ada* | lewat `metro@0.84.4`; DoS parser ICNS/JXL/HEIF |
| high | `image-size` | *belum ada* | idem |
| moderate | `esbuild` | `>=0.25.0` | dev server esbuild |
| moderate | `uuid` | `>=11.1.1` | bounds check v3/v5/v6 |

`image-size` **belum punya versi patched** (`patched: <0.0.0`), jadi override
tidak akan menolongnya — hanya bisa menunggu Metro bump. Keduanya DoS lewat
file gambar yang diparse **saat bundling**, bukan di server produksi.

⚠️ Peringatan pnpm masih muncul: `pnpm.overrides` di package.json **tidak
dibaca lagi**. Pin `vite ^6.4.3` masih efektif karena tercatat di lockfile,
tapi harus pindah ke `pnpm-workspace.yaml` sebelum install berikutnya
menjatuhkannya.
