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

## 2026-08-23 — Portal & CMS: ERD + review keamanan (desain)

**Prompt user:** "continue to make a portal and cms for user and admin to upload
the apk, make sure you have a good ERD then make sure from security side is oke too"

Dikerjakan urut sesuai permintaan: ERD dulu, lalu keamanan. Belum ada kode
portal — dua dokumen ini yang menentukan bentuknya.

- `docs/07-console/erd.md` — 7 tabel yang ada + 6 tabel baru, diagram mermaid.
- `docs/07-console/security-review.md` — 8 temuan, semuanya **direproduksi ke API
  yang berjalan**, bukan hasil membaca kode.

### Tabel baru & alasannya
`sessions` (revokasi refresh token + deteksi reuse) · `invitations` (anggota kedua
sekarang mustahil kecuali lewat script) · `api_keys` (upload dari CI, `role`
dibatasi CHECK ke `publisher`) · `password_resets` · `devices` + `install_events`
(audit cuma mencatat tiket **diterbitkan**, tidak pernah tahu install berhasil).

Aturan baru yang berlaku ke semua: **rahasia disimpan ter-hash, tidak pernah
mentah**, dan **tiap tabel kredensial punya `expires_at NOT NULL`**.

### Tiga temuan yang dibuktikan
- **S-1 (HIGH)** — `POST /v1/auth/refresh` itu `@Public()` dan stateless.
  Hapus baris `memberships`-nya: akses data benar-benar ditolak (403, karena
  `RolesGuard` membaca ulang membership), **tapi refresh token yang sama tetap
  mencetak pasangan token baru** selama 30 hari penuh. Belum jadi kebocoran
  karena semua jalur data lewat `RolesGuard` — tapi artinya "sign out" tidak bisa
  membatalkan apa pun, token curian tidak bisa diputus, dan endpoint pertama yang
  percaya klaim JWT tanpa cek membership mengubahnya jadi kebocoran betulan.
- **S-2 (HIGH)** — validasi upload **cuma ekstensi nama file**. Biner ELF dan file
  HTML dua-duanya diterima dan sampai `status: published` sebagai APK Android.
  Device menolak memasangnya (bukan RCE), tapi ini kegagalan integritas di sistem
  distribusi — satu-satunya properti yang bikin toko aplikasi ada gunanya.
- **S-3 (MEDIUM)** — tidak ada rate limit. Delapan login gagal beruntun:
  `401 401 401 401 401 401 401 401`, tidak pernah `429`. Dengan argon2id tiap
  percobaan mahal **untuk server**, jadi ini vektor DoS sekaligus.

Sisanya: CORS/helmet/CSP belum ada (sekarang fail-closed, jangan "diperbaiki"
dengan `enableCors()` telanjang), tempat menyimpan token di browser, TLS, sweep
temp upload, dan CHECK constraint untuk `api_keys`.

### ⚠️ KEHILANGAN DATA: biner artifact hilang dari store
`store/` sekarang berisi **1 dari 15 artifact** yang direferensikan database.
Yang tersisa hanya Calculator (6,2 MB); ~2,6 GB APK/IPA lain (Instagram, Netflix,
Spotify, Telegram, Canva, dst.) tidak ada. Direktori shard-nya masih ada tapi
kosong, mtime **22 Agu 16:25**.

Tidak bisa dipastikan perintah mana yang menghapusnya, jadi tidak diklaim.
Faktanya: pukul 00:41 tanggal 23 `prune` masih melaporkan 16 objek; pukul 01:08
tinggal 3. Folder sumber ingest tidak ditemukan lagi di disk.

**Dampak (pasti, dari kode):** `download.controller.ts` melempar
`NotFoundException('Artifact is missing from the store')` kalau file tidak ada —
jadi 14 dari 15 app gagal diunduh. Baris katalog, release, dan checksum-nya utuh.

**Pemulihan:** `pnpm --filter @appstore/api ingest -- <dir>` kalau user masih
punya folder binernya, atau `pnpm seed` untuk placeholder yang bisa dites (bukan
paket yang bisa dipasang).

### Catatan toolchain
`tsx` ternyata **tidak pernah dideklarasikan** di package.json mana pun — script
`ingest`/`prune`/`seed` bergantung padanya secara transitif, jadi ia ikut hilang
waktu `pnpm prune` (builtin) dijalankan. Sekarang jadi devDependency eksplisit di
`@appstore/api`. node_modules sempat rusak dan diinstal ulang bersih.

## 2026-08-23 — Install gagal tapi tercatat "terpasang"

**Laporan user:** "why when i install then error -> the status change to open ?
then at the sudden push to installed app, i was do on field scanner"

Benar, dan penyebabnya sudah tertulis jujur di komentarnya sendiri:

```
// The system installer runs in its own process and reports nothing back,
// so this records "handed to the installer", not a confirmed install.
await recordInstall(app.slug, ticket.version)
```

`installApk()` memanggil `IntentLauncher.startActivityAsync(...)` lalu
**membuang hasilnya** — return type-nya `Promise<void>`. Jadi begitu APK
diserahkan ke system installer, MAYA langsung mencatatnya sebagai terpasang:
tombol berubah jadi "Open" dan app muncul di My Apps, tak peduli Android
menolaknya, gagal, atau user membatalkan.

**Perbaikan:** `installApk` sekarang mengembalikan `'installed' | 'dismissed'`
dari `resultCode`. Hanya `ResultCode.Success` (-1) yang dicatat. Artifact yang
sudah diunduh **sengaja tidak dihapus** kalau tidak jadi terpasang — alasan
paling umum sampai ke sana adalah user menutup sheet, dan menyuruhnya mengunduh
ulang byte yang sudah ada itu salah.

Android tidak membedakan "user menekan back" dari "installer menolak paket" di
result code ini, jadi `dismissed` diperlakukan sebagai **"kami tidak tahu ini
terpasang"**, bukan sebagai kegagalan yang perlu diteriakkan.

**Diverifikasi di emulator**, bukan cuma dibaca: install Field Scanner (artifact
placeholder dari seed) → logcat `PackageInstaller: Parse error when parsing
manifest. Discontinuing installation` → Android bilang "There was a problem
parsing the package" → tombol **tetap "Install"**, dan My Apps tetap "Nothing
installed yet". Sebelum perbaikan, keduanya berubah jadi terpasang.

### Dua cacat UI yang terlihat sambil menguji (belum diperbaiki)
- Panel gradient di onboarding menampilkan **huruf raksasa "Y"** — inisial judul
  slide dipakai sebagai artwork placeholder. Terlihat seperti bug, bukan desain.
- Form login **tidak naik di atas keyboard**: field password tertutup dan tidak
  bisa di-scroll.

## 2026-08-23 — Dependabot: 2 dari 4 ditutup, 2 tidak bisa

**Prompt user:** "i need you to fix the vulnerability"

| Sev | Paket | Sebelum | Sesudah | Jalur |
|---|---|---|---|---|
| moderate | `esbuild` | 0.18.20 | **0.25.12** | drizzle-kit → @esbuild-kit/esm-loader |
| moderate | `uuid` | 7.0.3 | **14.0.2** | @expo/config-plugins → xcode@3.0.1 |
| high | `image-size` | 1.2.1 | 1.2.1 | metro |
| high | `image-size` | 1.2.1 | 1.2.1 | metro |

Ketiganya **build-time saja** — bundler dan CLI migrasi. Tidak ada yang bisa
dijangkau runtime API maupun app yang dikirim ke device.

### Kenapa `image-size` tidak diperbaiki
Bukan karena malas. **Tidak ada versi patched di jalur 1.x** (`patched: <0.0.0`),
dan `metro` — bahkan rilis terbarunya, 0.87.0 — masih mendeklarasikan
`image-size ^1.0.2`. Versi 2.0.2 ada, tapi v1 mengekspor **fungsi yang bisa
dipanggil langsung** sementara v2 mengubah kontrak entry point-nya; memaksa 2.x
lewat override kemungkinan besar mematikan bundler-nya. Kerentanannya sendiri
adalah DoS saat **mem-parse gambar waktu bundling** — penyerang harus lebih dulu
menaruh gambar jahat di source tree, dan dampaknya build menggantung.

Jadi ini **risiko yang diterima secara sadar**, bukan kelalaian: tunggu Metro
pindah.

### Jebakan yang terukur: di mana `overrides` sebenarnya dibaca
pnpm menyalak `The "pnpm" field in package.json is no longer read by pnpm` di
tiap perintah, jadi override-nya dipindah ke `pnpm-workspace.yaml` — dan
**tidak berpengaruh sama sekali**: esbuild tetap 0.18.20. Dikembalikan ke
`pnpm.overrides` di package.json → langsung resolve ke 0.25.12.

Peringatannya menyesatkan di repo ini: ia datang dari pnpm yang lebih baru di
PATH, sementara `packageManager` mem-pin **pnpm 9.12.0** dan versi itulah yang
benar-benar melakukan install — dan ia membaca package.json.
`pnpm-workspace.yaml` sekarang berisi komentar yang menjelaskan ini, supaya
orang berikutnya tidak memindahkannya lagi dan diam-diam menjatuhkan pin-nya.

### Override diverifikasi tidak merusak konsumennya
Override bisa mematikan paket yang bergantung pada versi lama, jadi keduanya
diuji, bukan diasumsikan: `uuid@14` masih mengekspor `v4` (yang dipakai
`xcode@3.0.1`) dan `expo config` tetap resolve; `drizzle-kit migrate` tetap
jalan dengan `esbuild@0.25`; 148 test hijau; Metro tetap bundling 2109 modul.

## 2026-08-23 — Release track + beta testing (API)

**Prompt user:** alur rilis 3 environment (dev → staging/prodlike → production),
build diunggah tanpa memberi tahu siapa pun, QA smoke test, baru rilis; plus
fitur beta testing untuk mengundang sebagian user; plus aturan update:
**digit pertama & kedua = major → force update tanpa tombol batal**, digit
terakhir = minor → boleh dilewati.

### Tiga track, satu build
`releases.track`: `internal` → `beta` → `production` (migration 0008).

- **internal** — tempat build mendarat. Terlihat oleh staff
  (publisher/admin/owner) saja, **tidak diumumkan ke siapa pun**.
- **beta** — terlihat oleh tester yang didaftarkan untuk app itu, plus staff.
- **production** — terlihat semua anggota org.

**Default-nya `internal`, sengaja.** Sebuah build tidak boleh jadi publik karena
ada field yang lupa diisi; sampai ke production harus tindakan eksplisit.

Promosi **tidak membangun ulang** — itu intinya: biner yang di-smoke-test QA
adalah biner yang sampai ke production. Trigger immutability (0006) membekukan
`app_id`/`platform`/`version`/`published_at`, dan `track` sengaja **tidak** ada
di daftar itu supaya promosi mungkin. Promosi juga **satu arah**; menarik build
buruk itu `unpublish`, bukan menurunkan track.

`app_testers` per-app, bukan per-org: jadi tester aplikasi expense bukan alasan
untuk melihat build HR yang belum rilis. Staff tidak perlu baris di sana —
role-nya sudah memberi akses, dan mendaftarkan tiap publisher ke tiap app akan
membuat tabel itu tidak berarti apa-apa.

Tester dibandingkan **berdasarkan peringkat**, bukan kesamaan: tester di `beta`
tetap melihat `production`. Kalau tidak, mempromosikan build justru
**menghilangkannya dari orang yang baru saja mengujinya**.

### Baris paling menentukan di seluruh fitur
`version-check` sekarang **hanya melihat `track = 'production'`**. Endpoint itu
`@Public()` dan dipanggil oleh app terdistribusi sendiri — tidak ada sesi user,
jadi tidak ada "tester" di sana. Kalau ia bisa melihat build internal, setiap
versi yang belum dirilis akan diumumkan ke setiap install; persis yang dicegah
oleh track privat.

### Aturan update: aturan organisasi, bukan semver
`updateSeverity(current, latest)` → `none | minor | major`. Untuk `X.Y.Z`,
perubahan **X atau Y = major** (tidak bisa ditutup), **Z saja = minor** (boleh).
Jadi 1.0.0 → 1.1.0 **major**, walau semver menyebutnya rilis fitur.

Hanya tiga segmen pertama yang dibaca. Versi toko sungguhan membawa metadata
build — "9.72.0 build 3 64377" jadi `[9,72,0,3,64377]` — dan nomor build naik
bukan alasan mengunci orang dari aplikasinya.

`minimum_version` **dipertahankan**: satu-satunya cara memaksa update yang oleh
aturan disebut minor — patch keamanan 1.0.0 → 1.0.1 persis kasus itu.

### `RolesGuard` sekarang menerbitkan role yang terverifikasi
Visibilitas track ditentukan oleh role, dan `req.auth.role` selama ini adalah
**klaim token yang bisa basi sampai 30 hari**. Guard sudah membaca ulang baris
`memberships` tiap request tapi membuang hasilnya; sekarang hasilnya ditimpakan
ke `auth.role`. Tanpa itu tiap handler yang membaca role jadi tempat anggota
yang sudah diturunkan mempertahankan wewenang lamanya.

### 🐞 Bug yang ketahuan dari test sendiri: rilis tanpa artifact
`artifacts` UNIQUE `(org_id, sha256)` + `ON CONFLICT DO NOTHING`. Jadi
menerbitkan build yang **byte-nya identik** dengan build sebelumnya — re-tag
1.0.0 jadi 1.0.1, terbit ulang setelah rollback — membuat baris release lalu
**diam-diam melewati artifact-nya**. Hasilnya release yang tidak terlihat di
katalog (INNER JOIN ke artifacts) dan tidak bisa diunduh, tanpa error di mana
pun.

Tujuan constraint itu lintas-tenant: "dua org boleh punya biner identik dan
tak satupun bisa mengintip milik yang lain". Jaminan itu ada di **storage key**
(`orgs/{orgId}/artifacts/{sha256}`), bukan di constraint digest. Migration 0009
memindahkannya jadi UNIQUE `(release_id)` — satu biner per release — dan
menyisakan indeks non-unik di `(org_id, sha256)`.

### Endpoint baru
`POST /v1/apps/:slug/releases/:id/promote` · `GET|POST /v1/apps/:slug/testers` ·
`DELETE /v1/apps/:slug/testers/:email` — semuanya publisher+.
`POST /v1/apps/:slug/releases` menerima `track` (default `internal`).

171 test hijau (dari 148), termasuk `release-flow.e2e-spec.ts` yang menjalankan
alur user langkah demi langkah lewat HTTP.

### Belum
UI mobile: badge beta, dan modal update yang **memaksa** saat major / bisa
ditutup saat minor. Konsol web untuk mengelola tester dan promosi.

## 2026-08-23 — Modal update: paksa saat major, boleh ditutup saat minor

Sisi yang terlihat dari aturan versi. `src/update/` di app mobile: klien
`version-check`, hook `useUpdateGate`, dan komponen `UpdateGate`.

**Sengaja berdiri sendiri** — tanpa header auth, tanpa `getClient()`, tanpa
provider. App yang butuh ini (HR Portal, Calculator) **bukan** toko-nya, tidak
punya sesi user, dan harus bisa mengadopsi update-gating dengan menyalin dua
file saja tanpa ikut membawa sisa MAYA. Karena itu request-nya `fetch` telanjang.

### Tiga hal yang menentukan benar/tidaknya
- **Gagal = jangan halangi.** `fetchVersionCheck` mengembalikan `null`, bukan
  melempar, kalau toko tidak terjangkau atau paketnya belum punya rilis. Update
  paksa yang menyala **karena jaringan mati** lebih buruk daripada update yang
  terlewat.
- **Blokir ditegakkan di tiga tempat**: tombol batal tidak dirender, `dismiss()`
  **mandul** (bukan sekadar tidak ditampilkan), dan tombol back Android ditelan.
  Modal yang bisa lolos lewat salah satu dari tiga itu bukan modal yang
  memblokir — dan kode tidak berhak menebak yang mana yang akan dipakai user.
- **Cek diulang saat app kembali ke foreground.** Orang yang dikirim ke toko
  untuk memperbarui akan **kembali** ke app ini, dan app harus sadar dia sudah
  terbaru alih-alih menahannya di balik modal basi.

MAYA memakai gate-nya untuk dirinya sendiri (`SelfUpdateGate` di `_layout.tsx`):
toko juga app terdistribusi, jadi ia memanggil endpoint publik yang sama dengan
app tenant-nya. Aturannya jadi dipakai sungguhan, bukan cuma diuji.

### Diverifikasi di device, bukan cuma di test
1. Unggah MAYA 1.1.0 ke track `internal` → version-check **404**, tidak ada modal.
2. Promosikan ke `production` → version-check balik `severity: major`,
   `updateRequired: true`.
3. App menampilkan **"Update required"**, `1.0.0 → 1.1.0`, **hanya** tombol
   "Update now". Tombol back ditekan → frame **identik byte-per-byte**, modal
   tidak bergeming.
4. Tarik 1.1.0, terbitkan 1.0.1 → `severity: minor`, `updateRequired: false`.
5. App menampilkan **"Update available"** dengan "Update now" **dan "Later"**,
   plus catatan rilis. "Later" menutupnya.

Data demonstrasi dihapus setelahnya; store di-prune.

## 2026-08-23 — Perbaikan dari pemakaian langsung + siapkan portal

Empat hal dari user sambil memakai app.

### Chip kategori terlihat terpotong
`ChipRow` memberi padding `spacing.xl` ke kontennya, **dan induknya**
(`CatalogHeader`) juga. Jadi viewport scroll-nya masuk 24px dan chip terpotong
di situ, bukan di tepi layar — terbaca seperti bug render.

Sekarang full-bleed: margin negatif membatalkan gutter induk, lalu padding
konten mengembalikannya. Chip lewat tepi layar berarti "masih ada lagi"; chip
berhenti 24px sebelum tepi berarti "rusak". Prop `gutter` membuat asumsi tentang
induk itu tertulis, bukan tersembunyi.

### Performa untuk perangkat lawas
Kendala baru dari user: perangkat pemakainya bisa tua.

- **`useReducedMotion`** — satu saklar, dua audiens. Orang yang menyalakan
  "reduce motion" di OS memang memaksudkannya, dan hardware lawas benar-benar
  membayar untuk spring di tiap baris. `FadeIn` langsung mulai di keadaan akhir
  (tidak menjadwalkan animasi sama sekali), `PressableScale` turun ke opacity
  saja, `Shimmer` diam.
- **`Shimmer` membatalkan `withRepeat`-nya saat unmount.** Repeat tak hingga
  terus jalan di UI thread sampai dihentikan; skeleton yang mount/unmount saat
  pindah layar akan menumpuk sweep yang tak dilihat siapa pun.
- **`ListTemplate`**: `removeClippedSubviews`, `windowSize` 7 (dari 21),
  `initialNumToRender`/`maxToRenderPerBatch` 6, plus `getItemLayout` — tinggi
  baris tetap secara konstruksi, jadi list bisa menempatkannya tanpa mengukur.
- **`AppCard` di-`memo`.** Katalog re-render tiap kali status install berubah;
  tanpa memo, tiap render itu me-render ulang semua baris terlihat — hal mahal
  paling mudah dihindari di layar ini.

### `packageId` masuk ke API katalog
Prasyarat permintaan user: My Apps harus **menanyakan ke OS** apakah tiap app
benar-benar terpasang lewat package id, lalu membandingkan versinya — bukan
percaya log install MAYA sendiri. Katalog sekarang mengembalikan `packageId`.

### CORS + basis deep link jadi konfigurasi
- `CORS_ORIGINS` (dipisah koma, **tanpa default, tanpa wildcard**). Konsol tidak
  bisa bicara ke API sampai ada yang menyebut origin-nya — kegagalan yang jauh
  lebih baik daripada `enableCors()` telanjang yang memantulkan origin apa pun.
  Menutup S-4 dari review keamanan.
- `DEEP_LINK_BASE` (default `maya://app`). `storeUrl` di version-check memakainya,
  jadi bisa diarahkan ke origin https milik sendiri tanpa mengubah kode.

## 2026-08-23 — Portal + landing page (`apps/console`)

**Prompt user:** "make the portal and landing page for website, you already make it?"

Jawaban jujurnya waktu ditanya: **belum**. Yang ada baru desainnya
(`docs/07-console/`), nol baris kode. Sekarang ada.

React + Vite + TS di `apps/console`, memakai **bahasa visual yang sama** dengan
app MAYA — palet, radius, skala tipografi. Publisher yang mengunggah build di
sini lalu membuka app di ponselnya harus merasa melihat satu produk.

### Yang ada
- **Landing** (`/`) — publik. Hero, alur 4 langkah, tiga track, dan dua kartu
  yang menunjukkan aturan update (major tidak bisa ditutup, minor bisa).
- **Login** (`/login`).
- **Portal** — katalog, dan halaman app berisi **upload build**, **promosi
  release**, dan **kelola beta tester**.
- **Audit** (`/audit`) — hanya admin/owner; link-nya disembunyikan untuk yang
  lain supaya UI tidak menawarkan sesuatu yang akan 403.

### Penyimpanan token: keadaan sementara, ditulis bukan disembunyikan
Access token **hanya di memori**. Refresh token ke **`sessionStorage`**, jadi
mati bersama tab, bukan menetap di disk seperti `localStorage`.

Review keamanan (S-1, S-5) meminta cookie httpOnly — itu jelas lebih baik,
JavaScript tidak bisa membacanya. Tapi itu **bergantung pada tabel `sessions`
yang belum ada**: cookie yang tidak bisa dicabut nyaris tak lebih baik daripada
storage yang bisa dibaca. Sampai S-1 mendarat, `sessionStorage` adalah paparan
terkecil yang tersedia — bertahan saat reload, yang memang dibutuhkan CMS
pengunggah file besar, dan tidak lebih.

### S-4 ditutup dan diverifikasi
`CORS_ORIGINS` diisi origin konsol. Diuji: preflight dari
`http://localhost:5173` mengembalikan `Access-Control-Allow-Origin`; preflight
dari origin lain mengembalikan **nol** header `access-control-allow-origin`.

### Dua hambatan toolchain yang terukur
- **esbuild menolak menurunkan sintaks react-router 7** ke baseline
  dep-optimizer Vite (`es2020`/`safari14`) — 289 error "Transforming
  destructuring ... is not supported yet". Konsol adalah alat internal di
  browser modern, jadi menaikkan target ke `es2022` adalah perbaikan yang benar,
  bukan mem-pin router lama.
- **React versi bentrok**: `node-linker=hoisted` menaruh satu react di root, dan
  `^19.2.0` di konsol me-resolve `react-dom` ke 19.2.8 sementara app mobile
  mem-pin react 19.2.3. React menolaknya saat runtime. Kedua paket sekarang
  di-pin persis.

### Diverifikasi di browser, bukan diasumsikan
Login → katalog (semua app, pill peran OWNER) → halaman app (fakta, form upload
dengan track default `internal`, promosi, tester) → **menambahkan tester
sungguhan lewat form**, muncul di tabel, terkonfirmasi di API, dan tercatat di
audit sebagai `tester.enrolled`. Tester uji dihapus setelahnya (204).

Build produksi: 255 kB JS (81 kB gzip), 12 kB CSS.

### Belum
Halaman publik per-app (`/app/:slug`) sebagai target fallback deep link · daftar
release di UI (promosi masih menempel id dari hasil upload, karena API belum
punya endpoint daftar release) · S-1 `sessions` yang akan menggantikan
penyimpanan token di atas.

## 2026-08-23 — My Apps bertanya ke OS, bukan ke log sendiri

**Prompt user:** "for list installed, you must check all app was install on device
check with package id inside app, then get the version is same or not? if not
button will showing update"

### Asumsi yang selama ini salah
Komentar di `storage/installs.ts` berbunyi: Android butuh
`QUERY_ALL_PACKAGES` yang "Play-restricted", jadi My Apps dibangun dari log
install MAYA sendiri.

Itu **kebijakan Google Play, bukan batasan Android**. MAYA didistribusikan di
luar Play, jadi kebijakan itu tidak mengikatnya. Alternatif `<queries>` yang
statis juga tidak bisa dipakai di sini karena katalognya dinamis.

### Modul native lokal
`modules/installed-apps` — modul Expo lokal, Kotlin + Swift.
`getInstalledVersions(packageIds)` mengembalikan versionName per paket atau
null. **Dibatch satu panggilan**: menyeberangi bridge sekali per app akan
membuat katalog 40 app jadi 40 round-trip, persis di perangkat lawas yang harus
tetap mulus.

`null` berarti "tidak terpasang **atau** tidak terlihat oleh kami" — Android
tidak membedakan keduanya, jadi ketidakhadiran bukan bukti ketidakhadiran.

**iOS mengembalikan `isSupported() === false`, sengaja.** Tidak ada API yang
melaporkan app lain terpasang atau tidak, apalagi versinya. `canOpenURL` hanya
menjawab apakah *ada* app yang mengklaim sebuah skema, menuntut tiap skema
dideklarasikan di muka (mustahil untuk katalog dinamis), dan tidak melaporkan
versi. Jadi iOS tetap memakai log lokal. Mengirim setengah jawaban yang
diam-diam berbeda dari kenyataan perangkat lebih buruk daripada mengakui
platformnya tidak bisa.

### Dampaknya
`packageId` ditambahkan ke tipe `App` dan respons katalog. Dua tempat memakai
kebenaran yang sama:
- **My Apps** — daftar dibangun dari apa yang benar-benar ada di perangkat.
- **Discover** — `stateFor` mengutamakan versi dari OS di atas log, jadi tombol
  Install/Update/Open mencerminkan perangkat. Satu query OS per pemuatan
  katalog, bukan per kartu.

Baris yang tidak punya tanggal install (karena bukan MAYA yang memasangnya)
berbunyi **"Found on this device"**, bukan "Installed" dengan tanggal kosong.

### 🐞 Loop render yang ketahuan saat pengujian
`useAsync` mengembalikan **objek baru tiap render**, dan `useFocusEffect`
bergantung pada `state` utuh. Identitas callback berubah tiap render → efek
jalan lagi → `refresh()` → render → ... sampai React menyerah dengan
**"Maximum update depth exceeded"**. Dependensinya sekarang `state.refresh`
yang stabil.

### Diverifikasi di device
Emulator sudah punya `com.google.android.calculator` 9.2(941607204) dan
`com.facebook.katana` 573.0.0.37.74 — **tidak satupun dipasang lewat MAYA**, dan
log MAYA kosong. My Apps tetap menampilkan keduanya, versi benar, "up to date".
Lalu Calculator 9.3 diterbitkan: My Apps berubah jadi **UPDATE** dengan
"v9.2 (941607204) → v9.3", dan Discover jadi tombol **Update** — sementara
Facebook tetap **Open** dan app yang tidak ada di perangkat tetap **Install**.

### `eas.json` ditambahkan
Belum ada sebelumnya, jadi EAS build mustahil. Profil `development`, `preview`,
`production`. `preview` menghasilkan **APK, bukan AAB** — profil itu ada untuk
menghasilkan build yang MAYA sendiri distribusikan, dan MAYA menyerahkan berkas
ke system installer; AAB tidak bisa dipasang langsung.

## 2026-08-23 — Konsol dilengkapi + EAS build pertama

### Dua celah konsol ditutup
- **`GET /v1/apps/:slug/releases`** (publisher+) — daftar release, terbaru dulu,
  **sengaja tidak difilter track**: ini layar tempat orang memutuskan apa yang
  dipromosikan, jadi build yang duduk di `internal` justru yang dicari.
- **Daftar release di konsol** menggantikan kolom "tempel release id". Tiap
  baris menawarkan hanya track **setelahnya** — promosi satu arah ditegakkan di
  UI, bukan cuma di API. Yang sudah di `production` berbunyi "Fully released".
- **`/app/:slug` publik** — target yang dituju App Link `https://` saat MAYA
  belum terpasang. Sengaja tipis dan tanpa auth: katalog itu data tenant di
  balik sesi, jadi halaman ini tidak bisa menampilkan versi, ukuran, atau
  unduhan. Menampilkan lebih dari itu berarti membocorkan katalog atau berbohong.

Diverifikasi di browser: unggah build `internal` → tombol `→ beta` dan
`→ production` muncul → klik `→ beta` → baris pindah ke `beta` dan hanya
menyisakan `→ production`. Tanpa error.

### EAS build: dua kegagalan, keduanya informatif
Build pertama **ERRORED** di `build:internal`:

```
Slug for project identified by "extra.eas.projectId" (uhnwi)
does not match the "slug" field (maya)
```

Proyeknya **`@abdulmuchtar/uhnwi`**, bukan `@uhnwi/maya` — itu juga sebabnya
pencarian lewat nama gagal. `expo.slug` sekarang `uhnwi`. "maya" tetap nama
produk dan slug org di API (`extra.orgSlug`), yang tidak ada hubungannya dengan
field itu.

Sebelum itu `eas.json` ditolak karena kunci `"//"` — EAS memvalidasi skema
dengan ketat. JSON tidak punya komentar, jadi alasannya pindah ke
`apps/mobile/EAS.md`, termasuk bagian yang penting: profil `preview`
menghasilkan **APK, bukan AAB**, karena profil itu ada untuk membuat build yang
**MAYA sendiri distribusikan**, dan MAYA menyerahkan berkasnya ke system
installer. AAB adalah format publikasi yang dibongkar Play, tidak bisa dipasang
langsung.

### Temuan dari log build: dua pnpm, dua file berbeda
Image builder memakai **pnpm 11.9.0**, yang mencetak "the pnpm field in
package.json is no longer read" — jadi override yang menutup advisory esbuild
dan uuid **tak terlihat olehnya**. Sementara pnpm 9.12.0 lokal hanya membaca
field itu dan mengabaikan `pnpm-workspace.yaml`.

Sekarang **kedua berkas memuat daftar yang sama**. Hari ini tidak mengubah apa
pun karena lockfile sudah menyimpan versi hasil resolusi dan keduanya memasang
dengan `--frozen-lockfile`. Yang berbahaya adalah saat pertama kali ada yang
me-regenerate lockfile di bawah pnpm 11: tanpa blok workspace, pin-nya hilang
diam-diam dan advisory-nya kembali.

## 2026-08-23 — EAS build pertama: sukses, dan menemukan cacat yang mustahil dilihat lokal

Build Android `preview` **FINISHED** — APK 111 MB, magic bytes `50 4B 03 04`,
terpasang di emulator, jalan tanpa Metro (JS-nya ter-bundle).
`QUERY_ALL_PACKAGES: granted=true`, jadi modul native lokal ikut terbawa.

### 🐞 Build rilis TIDAK BISA menjangkau API — dan build lokal selalu bisa
Login gagal di APK EAS. Sebabnya bukan kebetulan:

```
android/app/src/debug/AndroidManifest.xml:
  <application android:usesCleartextTraffic="true" ... />
android/app/src/main/AndroidManifest.xml:
  (tidak ada)
```

`usesCleartextTraffic` **hanya ada di manifest debug**. Jadi tiap build lokal
(`expo run:android` = debug) menjangkau `http://192.168.1.16:3000` dengan
mulus, sementara **tiap build rilis tidak bisa sama sekali**.

Ini **S-6 dari review keamanan** ("belum ada TLS"), tapi jauh lebih tajam dari
yang ditulis di sana: bukan cuma soal itms-services iOS dan cookie `Secure` —
tanpa TLS, **tidak ada satupun build non-debug Android yang bisa bicara ke API**.
Mustahil ketahuan lokal, karena semua build lokal itu debug.

**Penanganan sementara**: plugin `expo-build-properties` dengan
`usesCleartextTraffic: true`, ditulis di `app.json` sebagai **risiko yang
diterima dengan tanggal kedaluwarsa** — hanya bisa dibenarkan karena API-nya di
LAN privat, dan **wajib dicabut begitu `PUBLIC_BASE_URL` sudah https**.

### Dua cacat UI yang sudah dua kali disebut, sekarang diperbaiki
- **Form login tidak naik di atas keyboard.** `KeyboardAvoidingView` diberi
  `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — di Android itu
  **no-op**. Dan karena kontennya dipusatkan serta lebih pendek dari layar,
  ScrollView-nya juga tidak punya ruang scroll. Field password benar-benar
  tidak bisa dijangkau. Sekarang `behavior="padding"` di kedua platform.
- **Huruf raksasa di panel onboarding** ternyata
  `slide.title.slice(0, 1).toUpperCase()` — inisial judul dipakai sebagai
  artwork, terbaca seperti placeholder yang lupa diganti. Tiap slide sekarang
  membawa ikon SVG sendiri (grid / download / refresh).

## 2026-08-23 — S-2 ditutup: paket divalidasi dari isinya

**Sebelum**: validasi upload hanya ekstensi nama file. Biner ELF dan file HTML
dua-duanya diterima dan **diterbitkan** sebagai APK.

`package-validator.ts` sekarang memeriksa dua hal, tanpa dependensi baru:
1. **Magic number ZIP** (`50 4B 03 04`) — wajib ada di APK maupun IPA.
2. **Nama entry wajib**, dibaca dari **central directory** arsip:
   `AndroidManifest.xml` untuk APK, `Payload/` untuk IPA.

Sengaja **bukan parser zip**: ia menemukan central directory lalu mencarinya
sebagai byte. Tidak ada yang di-dekompresi, tidak ada path yang diikuti, tidak
ada alokasi berdasarkan ukuran yang diklaim entry — jadi zip bomb dan path
traversal tidak punya permukaan untuk mendarat.

### 🐞 Versi pertama menolak APK asli
Versi awal memindai **64 KiB terakhir** file. Lolos semua fixture sintetis, lalu
**menolak APK EAS 111 MB yang sah** — central directory-nya lebih besar dari
jendela itu, jadi `AndroidManifest.xml` berada di luarnya.

Itu jauh lebih buruk daripada kerentanan yang diperbaikinya: menolak upload yang
sah. Ketahuan hanya karena diuji ke **APK sungguhan**, bukan cuma ke fixture
buatan sendiri.

Sekarang ia membaca record **EOCD** (`50 4B 05 06`) untuk mendapat offset dan
ukuran central directory, lalu membaca tepat wilayah itu. Ada batas 32 MB,
karena ukurannya adalah angka yang **disuplai file itu sendiri** — membaca apa
pun yang diklaim upload adalah cara validator berubah jadi DoS.

Fixture e2e ikut diperbaiki: `test/support/package.ts` membangun arsip zip
sungguhan. Alternatifnya melemahkan validator agar cocok dengan test, yang
menghapus gunanya.

157 test hijau (dari 146). Diverifikasi ke APK EAS 111 MB asli: **VALID**.
Placeholder seed: **ditolak** — memang bukan APK, persis seperti yang ditulis
skrip seed-nya.

## 2026-08-23 — EAS build kedua: cleartext terbukti sembuh

Build `preview` kedua FINISHED, dipasang, dan **login berhasil** —
katalog termuat, Facebook langsung tampil "Open" (deteksi lewat OS jalan juga di
build rilis), dan tidak ada satupun error cleartext di logcat.

Buktinya bertahap dan meyakinkan: sebelum perbaikan pesannya generik
"Something went wrong"; setelah perbaikan, salah password memberi
**"That email and password combination did not match an account"** — artinya app
benar-benar **mencapai API dan menerima 401 sungguhan**. Lalu dengan password
benar, masuk.

Perbaikan keyboard juga terlihat jelas: form naik sehingga field password **dan**
tombol Sign in berada di atas keyboard. Sebelumnya field-nya mustahil dijangkau.

## 2026-08-23 — S-3 ditutup: rate limit di endpoint kredensial

Terukur sebelumnya: delapan login gagal beruntun → `401` delapan kali, tidak
pernah `429`. Sekarang: `401 401 401 401 401 429 429 429`.

### 🐞 Versi pertama tidak melakukan yang ditulisnya sendiri
Komentarnya bilang "IP punya jatah sendiri, dan tiap (org, email) juga" — tapi
implementasinya menggabungkan keduanya jadi **satu kunci** `ip|account`. Efeknya:
ganti email → kunci baru → jatah baru. **Satu alamat bisa membuat organisasi tak
terbatas.** Ditemukan oleh test, bukan oleh membaca ulang.

Sekarang tracker membawa kedua bagian dan `generateKey` memilih bagian mana yang
dihitung sebuah named throttler, lewat prefiks `ip-` / `acct-`:

| Throttler | Jatah | Alasan |
|---|---|---|
| `ip-burst` / `ip-sustained` | 20/menit, 100/jam | **Sengaja longgar.** Satu kantor di balik satu NAT berbagi alamat; menolak satu gedung demi memperlambat satu penyerang itu pertukaran yang buruk. Tugasnya menghentikan otomasi massal, bukan mengawasi orang. |
| `acct-burst` / `acct-sustained` | 5/menit, 20/jam | **Sengaja ketat**, dan aman untuk ketat: ia hanya bisa menolak percobaan terhadap satu (org, email), dan baru setelah lima password salah dalam semenit. |

Menghabiskan salah satu jatah sudah cukup untuk ditolak.

**Balasan 429 sengaja tidak menyebut apa pun** — tidak limit mana yang kena,
tidak sisa jatah. "Tersisa 3 percobaan untuk akun ini" adalah orakel gratis yang
memberi tahu penyerang bahwa alamat itu ada.

### Throttle tetap AKTIF di test
Bukan dimatikan untuk test: limit yang cuma ada di produksi adalah limit yang
belum pernah dijalankan siapa pun. Tapi counter-nya global per proses dan tiap
suite login berkali-kali, jadi `ctx.reset()` sekarang ikut mengosongkan
storage-nya. 161 test hijau.

## 2026-08-23 — S-1 ditutup: sesi refresh bisa dicabut, dirotasi, dan replay-nya terdeteksi

Temuan awal: hapus baris `memberships` seseorang → access token-nya benar
ditolak (403), **tapi refresh token-nya tetap mencetak pasangan baru selama 30
hari penuh**. "Sign out" tidak membatalkan apa pun.

Tabel `sessions` (migration 0010) menyimpan **SHA-256 token, bukan tokennya** —
alasan yang sama kenapa password di-hash. SHA-256, bukan argon2: inputnya 200+
bit keacakan kita sendiri, bukan rahasia pilihan manusia, jadi tidak ada kamus
untuk diperlambat, dan refresh ada di jalur panas tiap klien bangun.

`POST /v1/auth/logout` ditambahkan. `@Public()` dengan alasan yang sama seperti
refresh: kredensial yang dipensiunkan adalah token di body, dan klien yang
access token-nya sudah kedaluwarsa tetap harus bisa keluar.

### Tiga bug yang ditemukan saat mengerjakannya — dua di antaranya serius

**1. Refresh token tidak pernah unik.** JWT adalah fungsi deterministik dari
payload-nya, dan `iat`/`exp` beresolusi satu detik. Dua penerbitan untuk subjek
yang sama dalam detik yang sama menghasilkan **token yang identik byte-per-byte**.
Artinya "rotasi refresh token" **tidak melakukan apa-apa** bagi klien mana pun
yang refresh dalam sedetik setelah penerbitan sebelumnya. Ketahuan karena indeks
unik `sessions_token_hash_key` menolak insert-nya. Sekarang tiap token membawa
`jti` acak.

**2. Respons keamanan membatalkan dirinya sendiri.** Deteksi replay mencabut
seluruh rantai **di dalam** transaksi lalu melempar `UnauthorizedException` —
dan lemparan itu **me-rollback pencabutannya**. Sesi baru yang baru saja dicetak
penyerang selamat dari deteksi yang seharusnya membunuhnya. Respons keamanan
yang membatalkan dirinya lebih buruk daripada tidak ada, karena log-nya bilang
ia menyala. Sekarang rantai dicabut di transaksi sendiri, setelah yang pertama
commit.

**3. CTE rekursif ditolak Postgres.** "recursive reference to query chain must
not appear within its non-recursive term" — Postgres mengizinkan **satu** term
rekursif, sementara versi pertama punya dua cabang UNION. Sekarang satu term
berjalan **dua arah** lewat `OR`: mundur ke leluhur, maju ke penerus. Mencabut
satu arah saja menyisakan separuh rantai tetap hidup.

### Offboarding jadi otomatis, bukan bergantung ingatan
Diukur ke API yang berjalan: menghapus membership **saja** masih mengembalikan
`200` — pencabutan bergantung pada tiap jalur penghapusan **ingat** memanggilnya.
Jadi `rotate()` sekarang **membaca ulang membership**, penalaran yang sama dengan
`RolesGuard`. Sekarang: hapus membership saja → `401`, dan sesinya tercatat
dicabut dengan alasan `membership_removed`.

169 test hijau, stabil di tiga kali jalan berturut-turut (satu kegagalan flaky
sempat muncul dan diverifikasi hilang — test keamanan yang kadang lolos tidak
ada gunanya).

## 2026-08-23 — Konsol menyusul S-1 (dan satu bug yang dibuat oleh rotasi)

Setelah S-1 mendarat, konsol jadi **membatalkan perbaikannya sendiri**:
`signOut` hanya membersihkan state lokal dan **tidak pernah memanggil**
`/auth/logout`. Artinya keluar dari konsol meninggalkan refresh token tetap
hidup di server selama 30 hari penuh — persis celah yang tabel `sessions`
dibangun untuk menutupnya.

### 🐞 Rotasi memperkenalkan bug baru di klien
Server sekarang merotasi refresh token dan memperlakukan token yang sudah
dirotasi sebagai **curian**. Klien punya satu jalur refresh tanpa pengaman:
dua permintaan yang 401 bersamaan akan **sama-sama** refresh dengan token yang
sama. Yang pertama merotasinya; yang kedua terlihat persis seperti replay →
**seluruh rantai dicabut** → user keluar paksa karena membuka dua panel
sekaligus.

`refresh()` sekarang **single-flight**: pemanggil yang datang belakangan ikut
menumpang percobaan yang sedang berjalan, bukan memulai yang kedua. Ini bukan
optimasi, ini syarat kebenaran.

`logout()` menangkap token **secara sinkron** sebelum membersihkan sesi, lalu
mengirim panggilannya tanpa ditunggu — UI keluar seketika, pencabutan menyusul.
Menunggu jaringan untuk mengeluarkan orang itu pertukaran yang salah; melewatkan
panggilannya sama sekali jauh lebih salah.

### Diverifikasi di browser, bukan diasumsikan
Masuk lewat konsol → `sessions` punya **1 baris hidup**. Klik "Sign out" →
**0 hidup, 1 dicabut dengan alasan `logout`**, `sessionStorage` kosong, dan
halaman kembali ke `/login`. Masuk lagi → katalog 17 app, pill peran `owner`.

Build produksi: 258 kB JS (82 kB gzip).

## 2026-08-23 — Portal unduh: cara MAYA sampai ke HP yang belum punya MAYA

Pertanyaan "how to access the web?" membuka lubang yang lebih besar dari
sekadar alamat: halaman depan adalah **halaman pemasaran**, bukan portal.
Semua yang dibangun sejauh ini menjawab "app mana yang boleh saya pasang?",
yang mengandaikan MAYA **sudah ada** di perangkat. Tidak ada satu pun yang
menjawab bagaimana MAYA sampai ke sana. Toko yang hanya bisa dicapai dari
dalam dirinya sendiri sama saja dengan tidak bisa dicapai.

### Klien adalah artefak rilis, bukan isi katalog
Baris katalog itu data tenant di bawah RLS, terikat satu org, dan diambil
dengan bearer token. Build klien bukan ketiganya: satu biner milik deployment,
sama untuk semua org, dan harus bisa diambil orang yang memegang HP **tanpa
app dan tanpa sesi**. Memodelkannya sebagai data tenant berarti mengarang
tenant untuknya. Jadi ia hidup di `store/client/` dengan manifest di sebelahnya.

`GET /v1/client` dan `GET /v1/client/:platform/download` **publik tanpa URL
bertanda tangan** — satu-satunya unduhan seperti itu di API ini. Biner ini
adalah layar login: tidak memuat data tenant, katalog, atau kredensial, dan
tidak menampilkan satu app pun sebelum ada akun sungguhan. Menguncinya hanya
membeli lingkaran buntu — butuh sesi di HP untuk memasang app yang memberi
sesi di HP — dan mendorong orang ke jalan yang justru ingin dihindari: saling
kirim APK lewat chat.

### Sidik jari yang tidak diperiksa itu hiasan
Portal mencetak SHA-256 dan menyuruh orang membandingkannya. Instruksi itu
hanya layak diikuti kalau server **menolak** menyajikan byte yang tidak cocok —
kalau tidak, halaman tetap menampilkan sidik jari yang terlihat benar untuk
biner yang sudah ditukar, dan itu lebih buruk daripada tidak mencetak apa-apa.
Digest dihitung dari file saat permintaan pertama lalu dibandingkan dengan
manifest; ukuran dicek lebih dulu karena `stat` sudah membuktikannya tanpa
perlu men-hash 107 MB. Beda sedikit saja → unduhan dimatikan, bukan disajikan.

### 🐞 Dua bug yang hanya muncul di perangkat sungguhan
- **QR yang menunjuk `localhost`.** Nilai pertama di `CORS_ORIGINS` selalu
  loopback. HP yang memindainya tidak pernah mesin yang menyajikan halaman,
  jadi QR itu gagal untuk **setiap** orang — dan gagal diam-diam, terlihat
  seperti unduhan rusak, bukan URL salah. `resolvePortalUrl` melewati loopback,
  dan mengembalikan null (QR disembunyikan) kalau semua kandidat loopback.
- **Konsol memanggil `localhost:3000` dari HP.** `apiBaseUrl` di-hardcode.
  Di HP, `localhost` **adalah HP itu**. Halaman termuat, lalu setiap panggilan
  API gagal ke dirinya sendiri. Sekarang diturunkan dari origin halaman, jadi
  benar secara konstruksi di loopback, alamat LAN, maupun domain sungguhan.

### Sesuai perangkat, dan bahasa yang dimengerti orang
Halaman menampilkan **hanya platform yang relevan**: Android → Android, iPhone
→ iOS, Windows/Mac lebar → keduanya, Mac disempitkan ke lebar HP → iOS. iPad
mengirim user-agent Macintosh, jadi Mac dengan `maxTouchPoints > 1` dibaca
sebagai iPad. Keenam kasus diuji langsung terhadap modul yang dikirim.

Isi halaman dipangkas: versi sebelumnya membuka dengan track, promosi, dan
semantik update — menjelaskan **cara kerja** sistem kepada orang yang belum
tahu sistem itu **untuk apa**. Konsep-konsep itu pindah ke konsol, tempat orang
yang merilis memang membutuhkannya. Di HP, tombol unduh sekarang ada di atas
lipatan; paragraf penjelas turun ke bawahnya.

`pnpm --filter @appstore/api publish:client <apk>` menggantikan prosedur manual
(unduh, hash, baca atribut, tulis JSON) yang dilakukan sekali dengan benar lalu
salah enam minggu kemudian. Dijalankan ulang atas APK yang sama, ia mereproduksi
manifest tulisan tangan **persis sama**.

Bonus: `apksigner` memberi SHA-256 sertifikat penanda tangan —
`799c41fd…57c1eb6e` — yang selama ini memblokir `assetlinks.json`.

182 test lolos, empat paket typecheck bersih, konsol 260 kB (82 kB gzip).

## 2026-08-23 — Temuan dari perangkat sungguhan (Galaxy Note 9)

### 🐞 Tombol "Open" yang tidak bisa membuka apa pun
Pengguna dengan Telegram terpasang melihat tombol **Open** — benar — lalu
menekannya dan diminta **memasang** Telegram. Penyebabnya bukan logika status:
`stateFor` sudah benar. Modul native hanya punya `isSupported()` dan
`getInstalledVersions()`; **tidak ada cara memanggil aplikasi lain sama
sekali**. Deteksi tanpa peluncuran membuat label itu janji yang tak bisa
ditepati.

Dua tempat melakukan kesalahan yang sama, satu lebih parah:
- `AppCard` memanggil `onOpen()` yang membuka sheet detail.
- `InstallBar` di halaman detail memberi label "Open" tapi `onPress`-nya
  **selalu** `requestInstall(app)` — jadi menekan Open memulai pemasangan.

`launchApp(packageName)` ditambahkan ke modul native (Android:
`getLaunchIntentForPackage` + `FLAG_ACTIVITY_NEW_TASK`; iOS: selalu false,
karena bundle id bukan URL). Mengembalikan false — bukan melempar — untuk paket
tanpa activity peluncur, sehingga pemanggil bisa mundur ke layar detail alih-alih
meledak di wajah orang yang menekan tombol.

### 🐞 Animasi masuk hanya main sekali seumur peluncuran
"Kalau sudah pindah halaman lalu balik lagi, bounce-nya hilang." Benar: Expo
Router **mempertahankan** layar tab tetap ter-mount setelah kunjungan pertama,
jadi entrance yang dipicu mount berjalan tepat sekali per peluncuran. Tidak ada
yang terlihat salah di kode — efeknya memang jalan, sekali, dengan benar.

`useFocusReplay` menghitung fokus lewat `useFocusEffect` milik expo-router
(bukan `@react-navigation/native`, yang sejak expo-router 57 tidak lagi ada di
pohon dependensi). Fokus pertama dilewati agar mount tidak menjalankan entrance
dua kali. `FadeIn` juga **mereset** nilainya sebelum menganimasikan — tanpa itu
animasi ke nilai yang sudah dipegang adalah no-op, dan bug-nya akan selamat dari
perbaikannya sendiri.

### Scroll 60 fps: memo yang dibayar tapi tidak pernah ditagih
`AppCard` dibungkus `React.memo` justru agar baris tidak render ulang. Tapi
setiap prop yang diberikan ke `FlatList` dibuat baru tiap render — `renderItem`
inline, elemen `<RefreshControl>` baru, literal array untuk
`contentContainerStyle`, `keyExtractor` panah inline di dua pemanggil — dan
masing-masing cukup untuk membuat FlatList merender ulang selnya. Memo-nya
dibayar dan tidak pernah ditagih.

Semuanya distabilkan: `getItemLayout` diangkat ke lingkup modul, `renderItem`
dan `onRefresh` ke `useCallback`, header/empty/refreshControl/contentStyle ke
`useMemo`, `keyExtractor` jadi fungsi tingkat modul di kedua layar. Bedanya
muncul sebagai frame yang jatuh saat menggeser cepat, bukan sebagai sesuatu yang
terlihat saat diam.

### Sapaan dengan nama sungguhan
`user.name` selama ini berisi **alamat email**. "Hello, orang@perusahaan.com"
terbaca seperti mail merge. `displayName` sudah ada di tabel `users` tapi tidak
di mana pun pada jalur login, jadi respons login sekarang menyertakan user —
bukan JWT-nya: token itu kredensial, bukan profil, dan apa pun yang ditanam di
dalamnya basi sampai login berikutnya. Header katalog menyapa dengan nama depan,
dan mundur ke judul bagian kalau tidak ada nama.

## 2026-08-23 — Manajemen anggota: CMS akhirnya bisa mengelola orang

"CMS masih terlalu dasar, belum ada halaman kelola user (admin, employee,
tester)." Benar, dan lebih dalam dari yang terlihat: **tidak ada endpoint
anggota sama sekali**. Satu-satunya cara menambah orang adalah skrip
`seed-member`. Konsol tidak menyembunyikan fitur — fiturnya memang tidak ada.

### "Tester" sengaja bukan peran
Peran di basis data: `owner`, `admin`, `publisher`, `viewer`. Kosakata pengguna:
admin, employee, tester. Dua yang pertama dipetakan lewat label — konsol menulis
**"Employee"** untuk `viewer`, karena `viewer` menggambarkan apa yang bisa
dilakukan terhadap konsol, bukan siapa orangnya; enum-nya sendiri tidak diganti,
sebab itu akan menulis ulang sejarah di audit log tanpa keuntungan apa pun.

Tapi **tester bukan peran**, dan itu keputusan yang dipertahankan: pengujian
adalah pendaftaran pada **satu app** (`app_testers`). Menjadikannya peran akan
membuatnya global — dan diminta menguji app pengeluaran bukan alasan untuk
melihat build HR yang belum dirilis. Jadi daftar anggota menampilkan peran
**dan** app yang diuji, sebagai dua sumbu terpisah.

### Dua aturan yang membedakan kekeliruan dari insiden
- **Owner terakhir tidak bisa diturunkan atau dihapus.** Organisasi tanpa owner
  tidak bisa mengangkat owner — setiap jalur pemberian peran menuntut admin atau
  owner sudah ada. Ini bukan invarian rapi-rapi, ini beda antara salah klik dan
  akun yang tidak bisa dipulihkan. Menaikkan owner *menjadi* owner (no-op) tidak
  ikut tertolak.
- **Menghapus anggota mencabut seluruh sesinya.** Refresh token berumur 30 hari,
  jadi keanggotaan yang dihapus tanpa pencabutan meninggalkan orang yang sudah
  keluar memegang kredensial yang masih bisa diperbarui sebulan penuh. Diuji
  langsung: 2 sesi hidup → 0, dan token yang sama ditolak 401.

Perubahan peran **tidak** mencabut sesi, dan itu aman: `RolesGuard` membaca
ulang baris keanggotaan tiap permintaan, jadi penurunan peran berlaku pada
panggilan berikutnya. Mengeluarkan orang karena izinnya berubah hanyalah teater.

`publisher` sengaja **tidak** ada di `@Roles` pengelolaan anggota: menerbitkan
perangkat lunak dan memutuskan siapa yang bekerja di sini adalah dua jenis
wewenang berbeda. Diverifikasi: publisher mendapat 403.

Semua tindakan tercatat di audit log, termasuk berapa sesi yang dicabut.
12 test baru; total 194 test lolos, empat paket typecheck bersih.
