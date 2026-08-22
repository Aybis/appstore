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

## 2026-08-17 — Seed + runbook mesin baru

Sebelum ini clone bersih **tidak bisa dijalankan tanpa folder binary 2,6 GB**
— katalog kosong, tidak ada login, tidak ada yang bisa dites.

`scripts/seed-demo.ts` (`pnpm seed`) menutup itu: bikin org, owner login, 4 app
dengan 6 release published lintas platform, plus artifact placeholder di store.
Semua jalur jalan — katalog, search, detail, ticket, stream ber-tanda tangan,
version-check termasuk **forced update** (HR Portal `minimum_version = 3.0.0`).

Placeholder-nya beberapa KB filler, **bukan package yang bisa dipasang**. Jalur
download resolve, tapi OS akan menolak memasang — itu benar, bukan bug. Binary
asli tetap lewat `pnpm ingest` atau upload API.

Diverifikasi end-to-end di org scratch: login → katalog 3 app Android → stream
62.464 byte → version-check 2.9.0 balik `REQUIRED: true`. Org scratch dihapus,
`prune --delete` otomatis membersihkan 6 artifact yatimnya — sekalian bukti
loop GC-nya jalan.

`docs/local-setup.md` ditulis ulang jadi **11 langkah berurutan**, tiap langkah
menyebut kegagalan yang dicegahnya, termasuk Step 6 (seed) dan Step 9 (EAS —
`eas login` + `eas init --id`, dan penegasan bahwa Step 1–8 jalan tanpa EAS
sama sekali).

## 2026-08-22 — Plan 01 Task 13: audit log append-only (+ bug publish draft)

Plan 01 selama ini disebut selesai, padahal **12 dari 14 task**. Task 13 (audit
log) tidak pernah dibangun — `grep -r audit src/` cuma menemukan komentar yang
menjanjikannya. Itu bukan sekadar task yang belum jalan: "publisher publishes
immutable releases **and sees audit events**" adalah DoD v1 baris 2, dan store
yang jalur publish-nya tidak meninggalkan jejak tidak bisa menjawab satu-satunya
pertanyaan yang penting setelah build salah tayang — siapa yang menaruhnya.

### Yang jadi
- **`audit_events`** (migration 0007) — RLS `ENABLE`+`FORCE`+policy seperti tabel
  tenant lain, plus `REVOKE UPDATE, DELETE ... FROM app_runtime`.
- **`AuditService`** `record()` / `list()`, **`GET /v1/audit`** admin+owner.
- **Hook di jalur yang benar-benar istimewa**: `app.created` / `app.updated`,
  `release.created`, `release.published`, `artifact.download_issued`.

123 test API + 25 test shared hijau (dari 106).

### Keputusan yang menentukan benar/tidaknya
- **Append-only itu GRANT, bukan method.** `AuditService` cuma kemudahan; yang
  menjamin adalah privilege. Kode yang lewat samping service tetap tidak bisa
  menulis ulang sejarah — alasan yang sama kenapa tenancy ada di RLS, bukan di
  service layer. Diverifikasi di database dev, bukan cuma di test:
  `app_runtime=ar/horus` — insert dan select saja.
- **Audit dicatat SETELAH transaksi commit**, tidak di dalamnya. `record()` buka
  transaksi sendiri, jadi mencatat dari dalam transaksi yang kemudian rollback
  akan meninggalkan klaim permanen tentang kerja yang tidak pernah mendarat —
  dan log ini tidak punya DELETE untuk menariknya kembali.
- **`xmax = 0` membedakan insert dari update** di upsert `createApp`. "Bikin HR
  Portal" dan "menimpa metadata HR Portal" itu dua peristiwa berbeda bagi yang
  membacanya nanti.
- **Subject download = artifact, bukan app.** Sempat salah: `row.id` di
  `catalog.service.ts` itu **app id** (`appId: row.id`), jadi event pertama
  menunjuk app sambil mengaku menunjuk release. Ketahuan dari smoke test live,
  bukan dari test — assertion-nya tidak membandingkan id.

### 🐞 Bug yang ditemukan sambil lewat: **draft tidak pernah bisa dibuat**

`createReleaseSchema.publish` pakai `z.coerce.boolean()`. Itu `Boolean(value)`,
dan **setiap string tidak-kosong itu truthy** — sementara multipart mengirim
kata, bukan boolean. Terukur:

| dikirim | `z.coerce.boolean()` | seharusnya |
|---|---|---|
| `"true"` | `true` | `true` |
| `"false"` | **`true`** | `false` |
| `"0"` | **`true`** | `false` |

Akibatnya, di jalur produksi:
1. Publisher yang minta draft (`publish=false`) mendapat release **published,
   immutable, dan langsung tayang di semua device org-nya**. Tidak ada jalan
   mundur — immutability trigger justru mengunci kesalahan itu.
2. `POST /v1/apps/:slug/releases/:id/publish` **tidak pernah bisa dipanggil**:
   query-nya `WHERE status <> 'published'`, dan draft tidak pernah ada. Selalu
   404. Itu sebabnya endpoint itu satu-satunya jalur publish yang **tidak punya
   test sama sekali** — mustahil menulis test yang lolos untuknya.
3. `createAppSchema.featured` kena hal yang sama: `featured=false` → app
   nangkring di baris featured.

Diganti `formBooleanSchema` di `packages/shared` — menerima boolean asli
(pemanggil JSON tidak terpengaruh) dan ejaan yang dikenal, lalu **menolak** yang
tidak dikenal. `"ture"` sekarang 400, bukan tebakan tentang apakah build tayang.

### Catatan operasional
- **`pnpm prune` itu builtin pnpm**, dan ia menang atas script repo — menghapus
  117 paket dari `node_modules` alih-alih menyapu artifact yatim. Yang benar
  **`pnpm run prune`**. Runbook menyebut `pnpm prune`; perlu dikoreksi.
- Peringatan `pnpm.overrides` masih muncul, tapi `pnpm install` di sesi ini
  **tidak** menjatuhkan pin `vite`: lockfile tetap 6.4.3 dan resolusi terukur
  6.4.3. Kekhawatiran 2026-08-17 belum terwujud — tetap perlu pindah, tapi
  bukan kebakaran.

### Sisa Plan 01
Task 14 (OpenAPI `/v1/docs`) — satu-satunya yang tersisa sebelum Plan 01 benar
benar tutup. Setelah itu: Plan 04 (billing) atau Plan 05 (web console).

## 2026-08-23 — MAYA redesign: dark violet, spring-animated

**Prompt user:** "i like the design, animation, smoothnes interactive [dari Phantom],
i want you to make this app like that ... every design card, list, icon, image,
profile, page, search"

Bahasa visualnya dibangun jadi identitas MAYA sendiri — bukan menyalin logo,
wordmark, atau aset brand Phantom.

### Fondasi
- `src/constants/theme.ts` ditulis ulang: kanvas near-black bernada violet
  (`#0F0E13`), **kedalaman lewat fill transparan, bukan garis abu**, aksen
  lavender `#A78BFA` yang selalu membawa teks gelap, radius besar, plus token
  `gradients`/`blur`.
- `src/motion/` baru — `PressableScale` (spring + haptic, jalan di UI thread),
  `FadeIn` (stagger yang tidak mengulang saat refetch), `Shimmer`, `haptics`.
- Native: reanimated 4 + worklets, gesture-handler, svg, linear-gradient, blur,
  haptics, expo-image, system-ui. `app.json` jadi dark-first.
- Ikon: 20 glyph SVG menggantikan glyph yang dulu disusun dari `View`.

### Dua hal yang diverifikasi, bukan diasumsikan
- **`babel-preset-expo` otomatis memasang `react-native-worklets/plugin`**
  begitu paketnya resolve (`build/configs/expo.js:107`), jadi `babel.config.js`
  tidak perlu dibuat — worklet tetap ter-compile.
- **Build Android sukses** dengan enam modul native baru, lalu jalan di
  emulator dan bundling 1558 modul tanpa crash. Semua layar dicek dari device.

### Temuan
- **Bintang rating dulu SELALU 5 solid.** Versi glyph lama menggambar `★` tanpa
  melihat nilainya, jadi katalog yang seluruh `rating`-nya `0` tampak bintang
  lima. Versi SVG menampilkannya jujur (outline kosong) — lalu diubah lagi jadi
  **tidak dirender sama sekali** saat `rating <= 0`, karena lima outline mati
  cuma jadi derau.
- **Tab bar melayang** (`position: 'absolute'`), jadi tiap layar tab wajib
  menambah `TAB_BAR_HEIGHT` ke bottom inset-nya sendiri —
  `src/constants/layout.ts`. Tanpa itu baris terakhir mustahil di-scroll bebas.
  `profile.tsx` sebelumnya tidak mengirim inset sama sekali.
- **Tab bar dibuat OPAQUE, bukan glass.** Blur-nya tembus: konten kartu terbaca
  menembus label tab dan terlihat rusak, bukan glassy. Baris di bawahnya adalah
  artwork kontras tinggi, bukan wash datar yang cocok untuk blur.
- `StyleSheet.absoluteFillObject` **tidak lagi ada di tipe RN 0.86**.
- `pnpm prune` itu **builtin pnpm** dan menang atas script repo — ia mencabut
  `react`/`react-native` dari `node_modules` root, yang muncul sebagai 867
  error "Cannot find module 'react'". Yang benar `pnpm run prune`.

### Cara kerjanya
Workflow 13 agent berlapis (atoms → molecules → organisms → screens → integrate
→ review). **7 agent selesai, 6 gagal kena limit spend bulanan** — slice screens,
integrasi, dan tiga review dikerjakan manual. Typecheck bersih di tiga package.

### Belum
Toggle dark/light dan i18n EN/ID (diminta user, sedang dikerjakan) · portal +
CMS upload APK dengan ERD + review keamanan (diminta user, antre berikutnya) ·
iOS belum dilihat: `xcode-select` menunjuk CommandLineTools, jadi tidak ada
simulator. Perbaikannya butuh password user:
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

## 2026-08-23 — Dark/light + EN/ID

**Prompt user:** "you can set dark/ligh mode too and english and indonesia too"

### Masalah sebenarnya: `StyleSheet.create` menangkap warna sekali
43 komponen memanggil `StyleSheet.create` di level modul. Itu jalan **sekali saat
import** dan menyalin string warna ke objek style — mustahil ganti tema saat
runtime. Jalur "benar" (ubah semua jadi `const styles = useStyles()`) berarti
menyunting badan 43 komponen, termasuk mengubah arrow implicit-return jadi block
body. Banyak sekali perubahan, banyak peluang merusak layar yang sudah jalan.

Yang dipakai: **`colors` jadi Proxy** yang membaca palette aktif **saat diakses**,
dan `themedStyles(() => ({...}))` menerima thunk yang bisa dipanggil ulang per
palette. Pemakaian inline (`<StarIcon color={colors.star} />`) dievaluasi saat
render jadi benar dengan sendirinya. Perubahan per file tinggal dua baris
mekanis — dikerjakan codemod, bukan tangan. Enam file dengan >1 `StyleSheet.create`
dikonversi lewat pencocokan kurung, bukan regex.

### Yang halus: jangan remount
Versi pertama me-remount subtree lewat `key={scheme}`. Berhasil repaint, **tapi
me-reset navigator** — ganti tema dari Profil melempar user ke Jelajah.
Diganti: **tiap SCREEN memanggil `useTheme()`**. Re-render satu screen otomatis
membuat ulang elemen anaknya, jadi seluruh subtree ikut render dan membaca ulang
style yang resolusinya malas — tanpa ada yang unmount. Sembilan file, bukan 43.

### Palette terang bukan hasil membalik yang gelap
Fill putih transparan yang bikin kedalaman di kanvas gelap jadi **tak terlihat**
di kanvas terang, jadi light pakai **hitam transparan**. Lavender `#A78BFA` di
atas putih rasionya ~1.9:1 — gagal semua ambang kontras — jadi light pakai
`#6D28D9` yang membawa teks putih. Warna status ikut digelapkan.

`Palette` diturunkan dari palette gelap, jadi menambah token di satu skema
**gagal compile** sampai skema lain mendefinisikannya. Pola yang sama dipakai
`Strings`: `en` jadi sumber tipe, `id` wajib lengkap. Tidak ada fallback runtime
— fallback diam-diam mengirim layar setengah terjemahan yang tak ada yang sadar.

### i18n
~110 kunci, EN + ID. Placeholder `{name}`, dan bentuk jamak pakai dua kunci
(`_one`/`_other`) alih-alih menempel angka ke kata benda. Bahasa perangkat
dideteksi tanpa `expo-localization` — Indonesia melapor `id` di Android dan,
secara historis, `in` di iOS; keduanya dicek.

**Label sort dipindah jadi key**, bukan string: `src/utils/sort.ts` diimpor oleh
logika pengurutan, dan menanam bahasa Inggris di sana membuat urutan dan
tampilannya mustahil diterjemahkan terpisah. **Kategori tidak diterjemahkan** —
itu data dari `apps.category`, bukan string UI. Hanya entri sintetis "Semua".

Diverifikasi di emulator: ganti tema **tetap di Profil**, ganti bahasa mengubah
tab bar/header/tabel, dan keduanya bertahan setelah app di-restart.

### Belum
Portal + CMS upload APK dengan ERD + review keamanan (diminta user, berikutnya).
