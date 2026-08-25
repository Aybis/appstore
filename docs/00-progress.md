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

## 2026-08-24 — Desain: springs yang sama, bukan tiruannya

"Rujuk Mobbin/Claude — sederhana, bersih, minimalis, elegan" dan "animasi serta
transisinya harus seperti app mobile, seperti Phantom."

### Fisika yang sama, bukan pendekatan yang mirip
Bagian paling menentukan bukan warna, tapi gerak. `scripts/spring-easings.py`
mengintegrasikan **persamaan orde dua yang sama** dengan yang diselesaikan
Reanimated, memakai konstanta asli dari `apps/mobile/src/motion/motion.ts`, lalu
mencuplik hasilnya menjadi easing `linear()` CSS. Jadi web dan ponsel bergerak
dengan fisika identik — bukan cubic-bezier yang digeser-geser sampai kelihatan
mirip.

Overshoot terukurnya cocok persis dengan klaim komentar di app itu sendiri:
press "nyaris tanpa overshoot" (3,7%), standard "sedikit hidup di ujung" (7,3%),
sheet "tanpa pantulan terlihat" (1,5%). Durasi adalah waktu settle penuh dan
terbaca panjang — padahal tidak: press menempuh 86% perjalanannya dalam 91 ms
pertama, sisanya tiba tanpa terasa. Memangkasnya justru membuang settle yang
membuat sebuah spring terasa seperti spring.

`.rise` adalah `FadeIn` milik app (opacity di-timing, offset di-spring, stagger
38 ms, dibatasi 8 langkah). `.pressable` adalah `PressableScale`. Keduanya hanya
menganimasikan transform dan opacity, jadi tetap di compositor dan tidak pernah
memicu layout — itulah sebabnya ini terjangkau di perangkat lama.

### Lebih sedikit, bukan lebih banyak
Archivo dihapus: keluarga display kedua tidak memberi apa pun yang tidak bisa
dicapai bobot dan letter-spacing, dan memakan satu unduhan font penuh. Sekarang
satu keluarga (IBM Plex Sans) plus mono untuk fakta mesin. Kartu dipisahkan oleh
**satu garis rambut**, bukan garis plus bayangan. Skala spasi 4px dan skala tipe
eksplisit menggantikan nilai rem yang ditabur ad-hoc.

### 🐞 Dua cacat yang hanya muncul saat diperiksa
- **`.btn` tidak pernah mendeklarasikan background.** Akibatnya `<button>`
  memakai `buttonface` bawaan browser sementara `<a class="btn">` transparan —
  kelas yang sama, dua kontrol yang berbeda. Di mode gelap tombol ghost tampil
  sebagai pil abu-abu terang di atas halaman nyaris hitam. Sistem tombol pindah
  ke `ui.css` (dipakai setiap rute, bukan hanya portal) dengan background
  eksplisit.
- **`PublicApp` memakai `.eyebrow`, `.hero-actions`, `.hero-note`** yang ikut
  terhapus saat portal disederhanakan — halaman deep link diam-diam kehilangan
  gayanya. Bahaya khas CSS berlingkup halaman yang ternyata dipakai halaman
  lain. Ditambah `.form-error` yang **tidak pernah didefinisikan di mana pun**,
  jadi setiap pesan validasi tampil sebagai teks biasa.

`ui.css` kini diimpor sekali di `main.tsx`; sebelumnya cascade bergantung pada
rute mana yang kebetulan mengimpornya lebih dulu.

Diverifikasi di browser: `linear()` didukung dan benar-benar dipakai (bukan
fallback), kedua tema bersih, tanpa overflow horizontal di 375px, dan
`prefers-reduced-motion` mengembalikan `.rise` ke keadaan selesai — tanpa itu
konten justru tidak akan pernah muncul.

194 test lolos, empat paket typecheck, konsol 264 kB (83 kB gzip), CSS 18 kB.

## 2026-08-24 — Penamaan environment: kosakata tim, enum tetap

Tim bicara **dev → staging/prodlike → production**; sistem menyimpan
`internal | beta | production`. Pemetaannya 1:1, jadi konsol sekarang memakai
kata-kata tim: **Development**, **Staging**, **Production** — di pill, pemilih
unggah, tombol promosi, dan pendaftaran tester.

Enum-nya **tidak** diganti nama, alasan yang sama seperti peran keanggotaan:
setiap baris `releases.track` dan setiap peristiwa audit yang sudah ada membawa
kata lama, dan mengganti enum akan diam-diam menyatakan ulang isi baris-baris
itu. `TrackPill` menyimpan nilai mentah sebagai `title` supaya orang yang
mencocokkan dengan audit log punya jembatan.

### ⚠️ Satu hal yang perlu dinyatakan terang
Track mengatur **siapa yang bisa melihat** sebuah build, bukan **ke mana build
itu menunjuk**. "Staging" di sini berarti binernya terlihat oleh QA dan tester
yang disebut namanya — bukan bahwa ia dikompilasi terhadap API staging. Ini
penting karena promosi tidak pernah membangun ulang: artefak yang disetujui QA
sama persis, bit demi bit, dengan yang sampai ke semua orang. Build yang memang
dikompilasi terhadap backend berbeda adalah artefak berbeda, dan itu rilis lain,
bukan track lain. Setiap pilihan track di konsol kini menyebutkan audiensnya.

### 🐞 Tiga cacat yang tersingkap
- **`.pill-beta` dan `.pill-production` hilang.** Terhapus saat bagian track di
  portal dipangkas. `TrackPill` merakit kelasnya lewat template literal, jadi
  tidak ada pencarian `className` literal yang menemukannya — pill track tampil
  tanpa warna sama sekali.
- **`.form-error` menduplikasi `.err-msg`** yang sudah ada. Disatukan.
- **Bundel melonjak 264 → 320 kB** begitu konsol mengimpor `@appstore/shared`:
  `publish.ts` membangun skema zod di lingkup modul, dan rollup tidak bisa
  membuktikan `z.object()` bebas efek samping. Konsol minta tiga label dan
  ikut membawa 14 kB validator. Peta label pindah ke `contracts/tracks.ts` yang
  **tidak mengimpor apa pun saat runtime** (tipe di-erase), dengan subpath
  `@appstore/shared/tracks`. Kembali ke 264 kB.

219 test lolos (194 API + 25 shared), empat paket typecheck.

## 2026-08-24 — Halaman Testing: pertanyaan yang tidak bisa dijawab per-app

Pendaftaran tester selama ini hanya bisa dicapai dari dalam halaman satu app.
Itu menjawab "siapa yang menguji app ini?" dan tidak pernah menjawab **"orang
ini sedang menguji apa saja?"** atau **"build mana yang menunggu di Staging
tanpa seorang pun mencobanya?"** — dan justru dua pertanyaan itulah yang
dimiliki orang yang benar-benar menjalankan siklus pengujian. Keduanya tidak
berlingkup satu app, jadi tidak ada rute per-app yang bisa menjawabnya.

`GET /v1/testing` mengembalikan setiap app, penguji-pengujinya, dan apa yang ada
di tiap tahap. Tiga kueri yang dijahit di memori, bukan satu join: join-nya akan
mengalikan app × tester × rilis lalu harus diurai lagi, sedangkan tabel-tabel ini
cukup kecil per organisasi sehingga round trip tambahan lebih murah daripada
fan-out-nya. `DISTINCT ON (app_id, track)` mengambil rilis terbaru per tahap,
diurutkan berdasarkan `updated_at` **bukan** versi — versi itu teks bebas
("9.2 (941607204)"), jadi urutan leksikal akan menaruh 1.10 di belakang 1.9.

`POST /v1/testing/enrolments` mendaftarkan satu orang ke beberapa app sekaligus.
Ia memanggil `enrol()` per app alih-alih menulis INSERT massal, supaya
pemeriksaan keanggotaan, semantik upsert, dan peristiwa audit tetap berada di
**satu** tempat. Kegagalan dikumpulkan, bukan menggugurkan semuanya: mendaftarkan
seseorang ke enam app tidak boleh diam-diam berhasil untuk empat dan menghilangkan
alasan dua sisanya.

### Angka yang layak ditonjolkan
Kartu ketiga menghitung **build di tahap pra-produksi yang tidak punya penguji
sama sekali**. Siklus pengujian yang diam-diam tidak punya penguji terlihat persis
seperti siklus yang berjalan lancar. Kartu itu berubah amber hanya bila hitungannya
bukan nol — nol di sini adalah hasil yang baik — dan sebuah notice menyebut nama
app-nya sebagai tautan.

Diverifikasi di browser: mendaftarkan satu orang ke 2 app memperbarui statistik
(4 app dengan penguji, 2 orang), tabel dimuat ulang, dan kolom email dikosongkan;
menghapus lewat chip menurunkan hitungan kembali. Batas otorisasi diuji dengan
akun `viewer` sungguhan — **403** pada kedua rute, dan nav tidak menawarkan
tautannya. Publisher ke atas diizinkan, karena memberi seseorang penglihatan awal
atas perangkat lunak yang belum dirilis adalah wewenang yang sama dengan
menerbitkannya.

8 test baru; total 202 test lolos, empat paket typecheck.

## 2026-08-24 — S-5 ditutup: refresh token keluar dari jangkauan JavaScript

Konsol menyimpan refresh token di `sessionStorage`, tempat **skrip mana pun di
origin itu** bisa membacanya — jadi satu XSS menghasilkan kredensial yang bisa
diperbarui selama 30 hari. Ini sengaja ditunda sampai S-1 mendarat, karena
cookie yang tidak bisa dicabut nyaris tidak lebih baik daripada storage yang
bisa dibaca. Sesi sudah ada, jadi sekarang cookie-nya benar-benar lebih baik.

### Separuh yang mudah terlewat
Memindahkan token ke cookie httpOnly **tidak membeli apa pun** kalau respons
login dan refresh masih membawa token itu di body-nya. XSS tinggal memanggil
`/auth/refresh` — cookie-nya ikut otomatis — lalu membaca jawabannya. Jadi mode
cookie juga **membuang** refresh token dari body. Keduanya satu perubahan, bukan
dua.

### Mode dipilih klien, bukan ditebak server
Header `X-Auth-Mode: cookie` yang menentukan. Tanpa header itu API menjawab
seperti sebelumnya — token di body — yang persis dibutuhkan app mobile, setiap
skrip CI, dan setiap curl. Menebak dari `Origin` adalah jenis inferensi yang
diam-diam rusak begitu ada proxy yang membuang sesuatu.

### `SameSite=Strict`, bukan Lax
Endpoint refresh justru sasaran ideal permintaan lintas situs: dengan rotasi
aktif, penyerang yang bisa memaksa browser me-refresh **tidak** mempelajari
token-nya — CORS menghalangi mereka membaca balasannya — tapi mereka **memutar**
token itu, sehingga refresh berikutnya dari tab asli terlihat seperti replay dan
seluruh rantai dicabut. Itu tombol logout yang bisa ditekan situs mana pun.

Strict menuntut konsol dan API berada di *site* yang sama (port tidak dihitung,
jadi `localhost:5173` dan `localhost:3000` memenuhi syarat, begitu pula
`maya.example.com` dan `api.example.com`). API di domain terdaftar yang
benar-benar berbeda akan butuh `SameSite=None`, yang menuntut `Secure`.

Cookie di-`Path`-kan ke `/v1/auth` saja — cookie di `/` akan ikut menempel pada
setiap pembacaan katalog dan setiap unduhan artefak, yaitu banyak sekali
kesempatan mencatat atau men-cache kredensial yang tidak dipakai permintaan itu.

`COOKIE_SECURE` default mengikuti `NODE_ENV`. Cookie `Secure` dibuang browser di
HTTP polos, jadi menyalakannya tanpa TLS tidak mengeraskan apa pun — ia hanya
mengeluarkan semua orang.

### Diverifikasi di browser sungguhan
Masuk lewat form → `document.cookie` **kosong** (httpOnly bekerja),
`sessionStorage` hanya berisi alamat email, `localStorage` kosong. Muat ulang
penuh → sesi pulih, 17 app, pill peran `admin`. Klik "Sign out" → kembali ke
`/login`, dan **satu** sesi tercabut dengan alasan `logout`. Cookie yang sudah
dirotasi ditolak 401. Mode body diuji terpisah dan tidak berubah.

11 test cookie baru; total 213 test lolos, empat paket typecheck.

## 2026-08-24 — S-6: kode siap TLS, sertifikat yang dipercaya ponsel masih tersisa

### 🐞 Cacat laten yang justru dibuka oleh TLS
`AuthThrottlerGuard` mengunci pada `req.ips[0] ?? req.ip`, dan Express **tidak**
mengisi keduanya dengan benar kecuali diberi tahu untuk mempercayai header
penerusan. Begitu TLS diterminasi di proxy — yaitu bentuk produksi yang diminta
S-6 — setiap pemanggil akan runtuh menjadi **satu keranjang rate-limit**, dan
satu klien berisik mengunci seluruh perusahaan. `req.protocol` juga akan terbaca
`http`, sehingga manifest instalasi iOS ditulis dengan URL `http://` yang persis
ditolak iOS.

`TRUST_PROXY` default **mati**, dan default itu yang benar: mempercayai
`X-Forwarded-For` saat tidak ada yang mengisinya membuat siapa pun bisa memalsukan
alamat, lolos dari rate limit, dan meracuni jejak audit. Menerima hitungan hop
(`1`), preset Express, atau daftar CIDR.

### Dua bentuk penyebaran, bukan satu
API kini bisa menyajikan TLS **langsung** (`TLS_CERT`/`TLS_KEY`) — untuk toko
yang di-host di LAN perusahaan, yang tidak punya DNS publik untuk menjawab
tantangan ACME dan jauh lebih sederhana dengan satu proses memegang sertifikat
daripada satu komponen tambahan yang harus dijaga tetap hidup. `deploy/Caddyfile`
menutupi bentuk proxy untuk penyebaran yang terjangkau internet.

### Diverifikasi terhadap sertifikat sungguhan
Bukan dinalar, tapi dijalankan: `Set-Cookie` membawa
`HttpOnly; SameSite=Strict; Secure`; refresh lewat TLS hanya dengan cookie
mengembalikan 200; dan tiket `itms-services` menyematkan URL manifest **https** —
hal spesifik yang ditolak iOS ketika ia http.

### Yang masih tersisa, dan itu keputusan penyebaran
Sertifikat yang dipercaya **ponsel**. `mkcert` cukup untuk laptop; ponsel butuh
root CA didorong lewat MDM, atau sertifikat tepercaya publik lewat hostname
sungguhan atau tunnel. Sampai itu ada, `app.json` **tetap** memegang pengecualian
`usesCleartextTraffic`: menghapusnya selagi API masih `http://` membuat build
rilis tidak bisa menjangkau API sama sekali — persis kegagalan yang dulu
menempatkan pengecualian itu di sana. Langkah penghapusannya ada di
`deploy/README.md`.

Peringatan saat start dipasang untuk produksi tanpa TLS, tanpa `COOKIE_SECURE`,
atau tanpa `TRUST_PROXY`, supaya ini tidak bisa diam-diam terlewat.

217 test lolos, empat paket typecheck.

## 2026-08-24 — S-7 dan S-8 ditutup, plus dua bahaya yang tersingkap

### S-7: kebocorannya nyata, bukan teoretis
Diukur di mesin pengembangan: **99 berkas spool yatim**. Ukurannya kecil hanya
karena unggahan uji kecil — APK 100 MB yang ditolak membocorkan 100 MB, dan
jalur penolakan justru yang berulang kali dihantam job CI yang salah konfigurasi.

`ArtifactStore.put()` sudah mengonsumsi berkasnya saat sukses dan membersihkan
saat gagal, jadi setiap kebocoran berasal dari kegagalan yang **lebih awal**:
validasi body (pipe berjalan setelah multer, jadi `packageId` yang hilang
men-spool seluruh APK lalu 400), pemeriksaan ekstensi, `assertValidPackage`,
atau klien yang memutus koneksi. `finalize` menutup semuanya, termasuk
unsubscribe.

Interceptor yang sama memegang slot konkurensi, karena slot harus diklaim
**sebelum** multer menulis — kalau tidak, batasnya hanya melaporkan disk penuh,
bukan mencegahnya. Diuji dengan enam unggahan serentak: tiga diterima, tiga
ditolak 429.

### 🐞 `prune --delete` nyaris menghapus build klien MAYA
Tersingkap saat menguji penyapu spool: sapuan menghapus apa pun yang tidak
disebut basis data, dan biner portal **sengaja** tidak ada di basis data. Ia
melaporkan APK 107 MB dan manifest-nya sebagai yatim; `--delete` akan
menghapusnya, dan portal akan berkata "No build published yet" tanpa satu baris
pun di log yang menjelaskan. `client/` kini prefix terpesan.

### S-8: constraint dibuktikan, bukan diasumsikan
Constraint tidak bisa diverifikasi pada tabel yang tidak ada, jadi tabelnya ikut
dikirim (migrasi 0011). `api_keys_role_capped` dibuktikan dengan menulis SQL
mentah **sebagai pemilik skema** — jalur paling berwenang yang ada, dan yang
akan ditempuh skrip migrasi atau sesi psql. `admin` dan `owner` ditolak pada
INSERT **dan** UPDATE; yang kedua adalah eskalasi licik yang luput dari
pemeriksaan waktu-pembuatan.

### 🐞 Dua cacat saat membangunnya
- **Kunci harus membawa org-nya sendiri.** `api_keys` di-FORCE RLS seperti tabel
  tenant lain, jadi mengautentikasi berarti membaca baris yang org-nya belum
  diketahui. Versi pertama mencarinya di koneksi tanpa scope, tidak cocok dengan
  apa pun karena policy menyembunyikan semua baris, dan mengembalikan 401 untuk
  kunci yang sah.
- **Org dipotong pada 22 karakter tetap**, bukan dicari dengan pemisah — alfabet
  base64url **memuat** `_`, jadi org yang kebetulan terkode dengan `_` akan
  terbelah di tempat yang salah.

Migrasi 0012 menambah `releases.created_by_api_key`: `created_by` mereferensi
`users`, jadi aktor mesin gagal dengan 23503. Kolom paralel, bukan kolom kosong,
karena "siapa yang menerbitkan ini?" dijawab di setiap baris rilis.

241 test lolos, empat paket typecheck.

## 2026-08-24 — Halaman kunci API, dan pemilih tester yang menunjukkan kemajuan

### Rahasia yang hanya ada sekali
Server hanya menyimpan hash argon2, jadi momen tepat setelah pembuatan adalah
**satu-satunya** saat rahasia itu ada di luar mesin yang akan memakainya. Panelnya
sengaja mencolok — border dan isian aksen yang tidak dipakai di tempat lain pada
halaman itu, karena "ini tidak akan ditampilkan lagi" bukan hal yang diucapkan
pelan-pelan. Tidak disimpan di mana pun: muat ulang menghilangkannya, dan itu
benar. Diverifikasi — setelah reload, `sessionStorage` hanya berisi alamat email.

Statusnya **tiga**, bukan dua: kunci yang habis masa berlakunya berbeda dari
kunci yang sengaja dicabut, dan daftar yang menampilkan keduanya sebagai
"nonaktif" menyembunyikan perbedaan itu justru saat paling dibutuhkan — pipeline
yang mati jam 3 pagi adalah investigasi yang sangat berbeda tergantung mana yang
terjadi.

Konfirmasi pencabutan menyebut kapan kunci terakhir dipakai: "terakhir dipakai
24 Agu, jadi kemungkinan masih ada yang memakainya" adalah informasi yang
menentukan, bukan basa-basi.

### 🐞 Daftar tidak dimuat ulang saat pencabutan gagal
Tersingkap saat menguji: penyebab paling mungkin pencabutan gagal adalah
kuncinya **sudah tidak aktif** — klik ganda, atau admin lain mendahului. Versi
pertama hanya memuat ulang saat sukses, jadi barisnya tetap berkata "Active" di
sebelah pesan "Could not revoke" — yang tidak menggambarkan apa yang terjadi
maupun apa yang benar. Sekarang dimuat ulang di `finally`, dan tombolnya
dinonaktifkan selama proses.

### Pemilih tester: dua panel, bukan tujuh belas kotak centang
Tujuh belas kotak centang memberi tahu apa yang **ada** dan tidak memberi tahu
apa pun tentang apa yang **sudah dipilih** — pilihannya tersebar di antara
opsinya, jadi "orang ini akan saya daftarkan ke mana saja" harus disusun ulang
dengan mata setiap kali. Dua panel menjadikan jawabannya tempat yang dilihat,
bukan hal yang dihitung.

Klik adalah interaksi utama dan seret adalah tambahan, dalam urutan itu dengan
sengaja: menyeret canggung di layar sentuh dan mustahil dari papan ketik, jadi
setiap baris adalah `<button>` sungguhan yang berpindah dengan Enter atau Spasi.
Panah arah muncul saat hover **dan** saat fokus, sehingga bisa ditemukan lewat
papan ketik juga.

Diverifikasi: memindahkan tiga app menghasilkan 14/3 dan tombol berbunyi "Enrol
in 3 apps"; mengembalikan satu menjadi 15/2; filter mempersempit ke satu hasil;
dan drop HTML5 sungguhan memindahkan app antar panel.

241 test lolos, empat paket typecheck, konsol 279 kB (87 kB gzip).

## 2026-08-24 — Baris pemilih tester: ikon, platform, versi

Daftar nama saja tidak bisa menjawab pertanyaan yang sebenarnya dimiliki orang
yang mendaftarkan tester: build Android dan build iOS dari produk yang sama
adalah dua hal berbeda untuk diuji, dan sebuah nama tidak mengatakan yang mana.

Setiap baris kini membawa **ikon yang sama** dengan yang dipakai katalog —
warna dan inisial dari `colorFor`/`initialsFor`, sehingga sebuah app tampak
seperti dirinya sendiri di mana pun ia muncul — lalu platform dan versi pada
baris kedua dengan huruf mono.

Versi yang ditampilkan adalah **yang paling jauh melangkah**: Production dulu,
lalu Staging, lalu Development. Build yang sudah sampai ke semua orang adalah
yang dimaksud orang dengan "versi berapa app ini", dan menurun melalui tahapan
berarti app yang belum dirilis tetap menampilkan sesuatu alih-alih kosong.

Detail kecil yang menentukan: `min-width: 0` pada pembungkus teks. Anak flex
secara bawaan berukuran min-content, bukan nol — tanpa itu nama panjang akan
memaksa barisnya lebih lebar dari panelnya alih-alih dipotong. Diuji langsung
dengan nama yang sengaja dipanjangkan: terpotong dengan elipsis, dan barisnya
**tidak** melebihi wadahnya.

Konsol 279 kB (87 kB gzip), empat paket typecheck.

## 2026-08-24 — Menambah app dari CMS: identitas app, ikon, dan halaman yang hilang

"Di CMS bagaimana saya menambah app baru?" Jawaban jujurnya: **tidak bisa**.
`POST /v1/apps` ada sejak lama, tapi konsol tidak pernah memunculkannya. Dan dua
dari enam field yang diminta memang belum ada sama sekali.

### Package id itu milik APP, bukan milik biner
Sebelumnya `package_id` hanya ada di `artifacts`, diisi dari biner terakhir yang
diunggah. Itu terbalik. Bundle identifier adalah properti **produk** — tetap
sepanjang umur app, dan justru itu yang dicocokkan perangkat untuk memutuskan
apakah app-nya sudah terpasang. Menurunkannya dari artefak terbaru berarti app
yang baru dibuat tidak punya package id sama sekali (`catalog.service.ts`
mengembalikan `''` persis untuk kasus itu), jadi deteksi terpasang tidak bisa
bekerja sampai ada yang mengunggah sesuatu. Migrasi 0013 memindahkannya ke
`apps` dan **mengisi mundur** 17 app dari artefak terbarunya.

Keduanya dipertahankan dengan sengaja: package id artefak adalah apa yang
**benar-benar ada di dalam** biner, package id app adalah apa yang **seharusnya**.
Penerbitan kini membandingkan keduanya — dan APK yang package id-nya tidak cocok
dengan app tujuannya hampir selalu berkas yang salah, kekeliruan yang sebelumnya
**berhasil** lalu diam-diam merusak deteksi terpasang untuk semua orang.

### Ikon: dialamatkan lewat digest, disajikan publik
Tidak ada field ikon sama sekali; konsol menggambar inisial di atas warna
turunan. Sekarang ikon diunggah, disimpan content-addressed, dan disajikan dari
rute **publik** — karena tag `<img>` tidak bisa mengirim header Authorization,
dan alternatifnya lebih buruk: token di query string adalah kredensial di setiap
log akses. Yang membuatnya bisa diterima adalah pengalamatannya: URL-nya hanya
SHA-256, tanpa org, tanpa slug, tanpa id app — tidak bisa ditebak dan tidak
mengungkap apa pun. Magic bytes diperiksa, bukan MIME type atau ekstensi.

### 🐞 Alur baru itu mendarat di 404
Konsol membaca endpoint **katalog**, yang menerapkan aturan visibilitas app
mobile: sebuah app baru muncul kalau punya rilis yang **published**. Benar untuk
perangkat, salah untuk CMS — app yang baru didaftarkan semenit lalu tidak ada
sama sekali menurut konsol, jadi membuat app langsung mengarah ke 404.
`/v1/manage/apps` menampilkan semua app beserta jumlah rilis dan versi
terbarunya. Prefix terpisah, bukan `/apps/manage`, karena `CatalogController`
juga memiliki `/apps` dan `@Get(':slug')`-nya akan mencocokkan `manage` sebagai
slug — resolusi rute mengikuti urutan registrasi modul, jadi mana yang menang
bergantung pada sesuatu yang tidak terlihat di kedua berkas.

### Catatan rilis sengaja tidak ada di form ini
Catatan menjelaskan apa yang **berubah pada sebuah build**, jadi ia milik build
itu, dan ditanyakan saat unggah. Menaruhnya di sini berarti ditulis sekali lalu
basi sejak rilis kedua.

241 test lolos, empat paket typecheck.

## 2026-08-24 — CMS yang sebenarnya: rail kiri, bukan menu header

Menu horizontal berhenti bekerja begitu sebuah CMS punya lebih dari sekitar
lima tujuan — tautan berebut satu baris dengan brand dan identitas, dan setiap
bagian baru memperburuk baris itu. Konsol sudah punya enam. Rail tumbuh ke
bawah, dan itu gratis.

### Sidebar berada di LUAR `<Outlet>`
Bukan sekadar soal biaya render. Animasi masuk `.rise` terikat pada mount, jadi
sidebar di dalam outlet akan **menganimasikan dirinya sendiri setiap kali
pindah halaman** — navigasinya berkedip tiap kali dipakai. Diverifikasi: node
sidebar bertahan melewati navigasi (`animationName: none`), sementara konten
tetap beranimasi.

### 🐞 Breakpoint yang mengukur benda yang salah
`.transfer` dan `.new-app` beralih ke dua kolom pada lebar **viewport** (44rem
dan 48rem). Dengan rail 15rem di sebelahnya, kotak konten lebih sempit dari
viewport sebesar itu — jadi sebuah form akan pecah menjadi dua kolom saat ia
hanya punya ruang selebar satu kolom. Keduanya kini `@container content`,
mengukur kotak yang sebenarnya mereka tempati. Diverifikasi: viewport 1280,
kotak konten 1024, transfer terbagi 474px + 474px.

### Aksesibilitas yang benar-benar diuji, bukan diklaim
- **Skip link** sebagai elemen fokus pertama. Tanpanya pengguna papan ketik
  menyusuri setiap item navigasi sebelum mencapai konten, di setiap halaman,
  selamanya. Digeser keluar layar dengan transform — `display: none` membuatnya
  tidak bisa difokus, dan link itu jadi tidak bisa bekerja.
- **Item aktif ditandai tiga cara**: warna, latar terisi, dan rail padat di tepi
  depannya. Warna saja gagal untuk sebagian orang; `aria-current` dari NavLink
  yang membuatnya **diumumkan**, bukan sekadar terlihat.
- **Drawer**: fokus pindah ke tombol tutup saat dibuka dan **kembali ke tombol
  pembuka** saat ditutup — kalau tidak, pengguna papan ketik menutup drawer lalu
  mendarat di puncak dokumen tanpa tahu di mana. Escape menutup, scrim menutup,
  dan navigasi menutup (drawer yang menganga di atas halaman yang baru diminta
  adalah bug navigasi mobile yang klasik).

### Sekalian: halaman People tidak punya h1
Terlihat begitu sidebar menamai bagiannya. Nav berkata "People", halamannya
tidak pernah mengatakannya — pengguna pembaca layar tidak punya heading untuk
memastikan mereka sampai. Kini memakai pola `page-head` yang sama dengan rute
lain.

241 test lolos, empat paket typecheck, konsol 287 kB (89 kB gzip).

## 2026-08-24 — Konsol dalam register Airbnb (identitas MAYA, bukan milik mereka)

Diminta memakai bahasa desain situs Airbnb. Yang diambil adalah **registernya** —
halaman putih, kartu bersudut lembut yang terangkat saat disentuh pointer,
garis rambut netral, aksen koral, tipografi hangat. Yang **tidak** diambil:
nama, logo, atau tipe huruf mereka (Cereal itu proprietary). MAYA tetap MAYA,
digambar dalam bahasa itu — sama seperti app mobile dibangun dalam bahasa
Phantom tanpa menyalin asetnya.

### ⚠️ Ini memecah identitas produk
App mobile masih ungu. Konsol kini koral, jadi keduanya berhenti terlihat
sebagai satu produk. Disengaja untuk saat ini dan dicatat: seluruh perubahannya
satu pasang token, jadi menyelaraskan app nanti adalah suntingan kecil, bukan
desain ulang. Mark MAYA di konsol ikut diwarnai ulang — mark ungu di sebelah
antarmuka koral terbaca sebagai dua produk.

### 🐞 Kontras: dua kegagalan AA yang tidak terlihat mata
Nilai koral pertama yang dipilih dengan mata mengukur **4,06:1** terhadap putih
— gagal AA untuk teks normal **dua kali**: sebagai label tombol putih-di-atas-
koral, dan sebagai warna tautan koral-di-atas-putih. Diganti #d62b4f yang
mengukur **4,86** dengan margin, bukan yang duduk persis di ambang batas
sehingga sentuhan berikutnya diam-diam merusaknya.

`--text-3` mengukur 3,03 — itu teks sungguhan (hint dan caption), jadi dinaikkan
ke #767676 (4,54). Dan palet ikon hasil-generate: dua dari enam warnanya
mengukur **3,9:1** dengan inisial nyaris-hitam di atasnya — satu app dari tiga
akan punya inisial yang tidak terbaca. Paletnya kini sengaja **terang**, terburuk
7,53.

### Bentuk
Tombol berhenti jadi pil dan menjadi persegi membulat 8px; pil disimpan untuk
yang memang chip (status, peran). Kartu diam dengan garis rambut dan **hampir
tanpa bayangan**, lalu mendapat bayangan lembut saat ditunjuk — kontras itulah
gerakannya; kartu yang selalu terangkat sama sekali tidak terangkat.

### Catatan verifikasi
Pengukuran kontras tombol sempat menunjukkan 3,75 di mode gelap. Itu **nilai
transisi yang tersangkut** dari penggantian tema lewat devtools, bukan cacat:
elemen baru dengan deklarasi sama menghitung nilai yang benar, dan muat ulang
bersih memberi **7,33**. Diperiksa sampai tuntas alih-alih dicatat sebagai
kegagalan.

241 test lolos, empat paket typecheck, konsol 287 kB (89 kB gzip).

## 2026-08-24 — Token dua lapis, dan chrome yang hampir seluruhnya hitam-putih

Diminta lebih banyak hitam-putih, dan skala bernomor seperti Tailwind.

### Ramp lalu peran
**Ramp** duluan: skala bernomor yang menamai warna dan tidak lebih.
`--neutral-700` adalah abu-abu, bukan border. **Peran** menyusul, dan setiap
peran menunjuk ke satu langkah ramp. Komponen hanya boleh memakai peran —
diperiksa, dan tidak ada satu pun berkas komponen yang menjangkau langsung ke
ramp.

Pemisahan itulah yang membuat mode gelap menjadi **pemetaan ulang**, bukan
palet kedua: ramp-nya tidak berubah, perannya menunjuk ke tempat lain di
sepanjang skala yang sama.

### Aksi utama kini HITAM, bukan koral
Ini perbedaan terbesar dari percobaan sebelumnya. Tombol koral terisi menarik
mata di setiap layar, dan begitu setiap layar punya satu, tidak ada satu pun
yang berarti. Hitam lebih tenang dan terbaca lebih yakin — dan itu membebaskan
koral untuk menandai satu hal yang benar-benar sedang aktif.

Koral kini hanya muncul di **dua** tempat: rail tipis pada item navigasi yang
aktif, dan cincin fokus. Warna di tempat lain adalah **konten** — ikon app —
yang justru pola Mobbin: chrome monokrom, konten berwarna.

### 🐞 Satu langkah ramp tidak bisa melayani kedua tema
`--text-3` mengukur 4,38 — di bawah AA. Menaikkan `--neutral-500` ke #71717a
memperbaikinya di terang (4,83) tapi merusaknya di gelap (4,07). **Tidak ada
satu nilai** yang lolos 4,5 di kedua dasar; itu persis alasan lapisan peran ada.
Terang menunjuk ke `neutral-500`, gelap ke `neutral-400` (8,05).

Semua terukur lolos AA di kedua tema: label tombol 17,7 / 18,8 · teks 17,7 /
18,8 · text-2 6,7 / 13,6 · text-3 4,8 / 8,1 · highlight 4,9 / 9,8 · danger
4,8 / 5,2 · success 5,0 / 6,0.

241 test lolos, empat paket typecheck, konsol 287 kB (89 kB gzip).

## 2026-08-24 — App mobile ikut pindah warna, dan halaman Settings

### Ramp yang sama, di kedua sisi
`src/theme/ramps.ts` membawa skala bernomor yang persis sama dengan konsol, dan
`palettes.ts` sekarang murni **peran di atas ramp**. Menjaga ramp-nya identik
berarti kedua produk hanya bisa berbeda di tempat sebuah peran dipetakan
berbeda — itu keputusan yang terlihat, bukan kecelakaan dua palet yang dipilih
tangan.

Aksi utama kini **monokrom**: nyaris-hitam di terang, nyaris-putih di gelap.
Ungu hilang sepenuhnya dari app — nol literal tersisa. Koral hanya untuk
`highlight` dan untuk mark-nya sendiri. Warna selebihnya adalah **konten**:
palet ikon app (enam warna yang sama dengan konsol), bintang rating, status
instal.

Diverifikasi di emulator sungguhan, bukan dikira-kira. Build debug dipasang
(build EAS harus di-uninstall dulu — kuncinya berbeda), lalu tiga layar
diperiksa: onboarding (mark koral, tombol putih), sign-in (primary monokrom,
permukaan abu, hierarki teks netral), dan **keadaan error** — pesan merah
terbaca benar di atas dasar nyaris-hitam.

### Halaman Settings
Sengaja pendek. Halaman setelan mengumpulkan hal-hal yang memang pilihan
seseorang; mengarang sakelar untuk mengisinya adalah cara berakhir dengan empat
puluh toggle yang tak seorang pun paham.

**Appearance** menutup celah nyata: `theme.css` sudah mendukung
`data-theme="light|dark"` sejak ditulis — setiap aturan gelap dijaga
`:root:not([data-theme="light"])` — tapi **tidak ada apa pun yang pernah
menyetel atributnya**, jadi konsol hanya bisa mengikuti sistem. Tiga keadaan,
bukan dua: "System" **menghapus** atributnya, bukan menyetelnya ke sesuatu —
tidak ada `data-theme="system"` di stylesheet, dan menyetelnya akan membuat
aturan gelap cocok selamanya.

Skrip inline di `index.html` menerapkan preferensi **sebelum cat pertama**.
Menerapkannya dari React berarti siapa pun yang memilih terang di mesin gelap
mendapat kedipan gelap di setiap muat halaman.

**Sign out everywhere** (`POST /v1/auth/logout-all`) menjawab pertanyaan yang
tidak bisa dijawab logout biasa: "saya rasa ada yang memegang token saya."
Logout biasa mencabut kredensial yang sedang Anda pegang dan membiarkan milik
mereka bekerja. Sengaja **bukan** `@Public()` — ia perlu tahu SIAPA, dan refresh
token di depan kita justru yang mungkin tidak dipercaya orang itu. Diuji:
22 sesi hidup → 0.

### 🐞 Membunuh proses yang salah
`kill $(lsof -ti:3000 | tail -1)` memilih proses netsim emulator, bukan node —
jadi API lama dari jam 07:21 terus melayani dan rute baru mengembalikan 404
padahal log start-up jelas memetakannya. Dicari sampai ketemu alih-alih
disimpulkan sebagai bug rute.

241 test lolos, empat paket typecheck, konsol 291 kB (90 kB gzip).

## 2026-08-24 — Putaran umpan balik: filter, sticky, flashbang, tombol lunak

### Flashbang
Berpindah gelap→terang mengganti seluruh viewport dalam satu frame — dari
`#0B0B0D` ke `#FFFFFF` tanpa jeda. "Flashbang" adalah kata yang tepat. `body`
kini melakukan cross-fade 320 ms pada **dua** properti yang memang berubah;
`transition: all` global akan membuat setiap hover di konsol terasa berat, dan
warna-warna ini tidak berubah saat pemakaian biasa, jadi transisinya tidak
berbiaya sampai ada yang mengganti tema. Rail ikut, supaya keduanya berubah
bersamaan alih-alih rail mendahului satu ketukan.

### Ruang kosong di halaman Apps
Kepala halaman **dan** baris filter kini sticky, dalam urutan itu, sehingga
filter tidak pernah menutupi judul yang dimilikinya. Tombol "Add an app" ikut
diam di atas — harus menggulir kembali ke atas untuk meraihnya adalah keluhan
intinya. Di bawah 44rem keduanya kembali statis: menempelkan tiga baris kontrol
di puncak layar ponsel tidak menyisakan ruang untuk daftar yang mereka filter.

Filter: cari (nama/slug/package id), platform, keadaan rilis, tim, dan urutan.
Daftar tim **dibangun dari datanya**, bukan di-hardcode — tim yang tidak lagi
menerbitkan apa pun tidak seharusnya menetap di filter selamanya. Diuji:
android 4/17, cari "cal" → Calculator, tanpa kecocokan → "Nothing matches",
kepala halaman tetap di 0 setelah menggulir 600px.

### Yang ternyata sudah ada
Pencarian mobile **sudah** di-debounce 300 ms (`useSearch.ts:7`). Filter konsol
menyaring array yang sudah dimuat — tidak ada permintaan jaringan per ketikan,
jadi debounce di sana tidak membeli apa pun.

### Tombol keluar merah lunak
Varian `danger` yang ada adalah isian merah penuh. Keluar itu **dapat
dibatalkan** — Anda masuk lagi — jadi tombol merah penuh melebih-lebihkannya dan
membuat tombol yang benar-benar tak terbalikkan jadi kurang berarti. Varian
`dangerSoft` mengatakan "hati-hati", bukan "bahaya".

### Field versi
`minimumVersion` sudah ada di kontrak sejak lama dan tidak pernah ada di form.
Itu **memang** properti app (lantai paksa-perbarui), berbeda dari versi rilis
yang ditanyakan saat unggah. Sekarang ada, dengan penjelasan bahwa versi
dibandingkan secara numerik.

### Sisanya masuk backlog, dengan alasannya
`docs/08-backlog.md`. Yang penting untuk dikatakan terus terang: **dashboard
terhalang data yang tidak dikumpulkan** — dari tujuh angka yang diminta, tiga
bisa dihitung hari ini dan empat tidak. Membangunnya sekarang berarti
menampilkan tiga angka nyata dan empat karangan.

## 2026-08-24 — Dashboard nyata di atas tabel nyata, dan tiga perbaikan yang terlewat

### Tabel dulu, baru data contoh
Diminta dashboard dengan data dummy, **tapi pastikan field-nya ada di DB supaya
nanti datanya berbasis user, bukan dummy**. Itu urutan yang benar dan justru
yang dikerjakan: migrasi 0014 membuat `devices`, `install_events`, dan
`app_ratings` — lalu skrip seed mengisi **baris sungguhan** di tabel sungguhan.

Dashboard-nya menjalankan kueri asli. **Tidak ada satu konstanta pun** di
`dashboard.service.ts`. Jadi ketika perangkat sungguhan mulai melapor, kueri
yang sama mengembalikan angka yang sama bentuknya dan **tidak ada kode yang
berubah** — kebalikan dari menaruh angka palsu di komponen lalu harus mencabutnya
belakangan. Yang palsu adalah barisnya, bukan jalur pelaporannya.
`seed:telemetry -- --purge` menghapus persis yang ditulisnya.

### Mengapa audit log tidak bisa menjawabnya
`audit_events` mencatat tiket unduhan **diterbitkan**. Ia tidak bisa mencatat
apakah instalasinya berhasil, karena itu terjadi di perangkat setelah byte-nya
pergi — dan selisih antara keduanya justru angka yang dicari semua orang.

**Sesi bukan login.** Rotasi mengganti baris sesi setiap refresh, jadi menghitung
sesi berarti menghitung klien bangun. Peristiwa `auth.login` kini dicatat; itu
satu-satunya rekaman orang benar-benar masuk.

**Versi yang dipakai** memakai `DISTINCT ON (device, app)` — ponsel yang memasang
1.0 lalu memperbarui ke 1.1 dihitung sekali, untuk 1.1. Itu pertanyaan yang
sebenarnya diajukan "versi mana yang beredar".

### 🐞 Dropdown yang meregang
Dua default bertumpuk: `.field` adalah grid yang barisnya meregang, dan
`.form-grid` meregangkan selnya ke setinggi sel tertinggi di baris itu. Jadi
`<select>` di sebelah field yang punya hint tumbuh jadi dua kali tingginya.
Terlihat seperti pilihan gaya, padahal dua perilaku bawaan yang bertemu.
Sekarang tingginya tetap 2,75rem dan sel tidak lagi meregang.

Sekalian: aturan `.field` ternyata hidup di `login.css` sementara **setiap**
halaman memakainya — bahaya CSS berlingkup halaman yang sama seperti sebelumnya.
Dipindah ke `ui.css`.

### Unggah dua platform
Form tambah app kini punya bagian **build pertama (opsional)**. Platform "both"
memberi **dua slot** — APK dan IPA adalah dua biner berbeda dari produk yang
sama, dan tidak ada satu berkas pun yang mencakup keduanya; mengunggah satu lalu
kembali untuk yang lain adalah alur yang menghasilkan app setengah terbit.
Diunggah berurutan, bukan paralel: dua unggahan 100 MB sekaligus di wifi kantor
lebih lambat daripada satu-satu, dan kegagalan di tengah jauh lebih mudah
dijelaskan. Selalu mendarat di Development.

241 test lolos, empat paket typecheck.

## 2026-08-24 — Sisa daftar umpan balik

### Filter di halaman yang tersisa
**Audit** difilter berdasarkan **keluarga aksi**, bukan setiap aksi berbeda —
filter dengan lima belas entri adalah filter yang tidak dibuka dua kali;
"release" adalah pertanyaan yang orang ajukan, bukan "release.promoted"
spesifik. Pencariannya menjangkau aksi, subjek, dan metadata.

**People** mendapat pencarian nama/email dan filter peran.

### Ikon: dipangkas dan dikecilkan di browser
1600×900, 1,4 MB → **512×512, 190 KB**, dan pengguna diberi tahu bagian
tengahnya yang diambil. Perhatikan sumbernya **melebihi batas 1 MB server** —
sebelumnya akan ditolak.

Dikerjakan di browser karena tiga alasan yang mengarah ke tempat sama: foto 4 MB
tidak pernah melintasi jaringan, server tidak pernah men-decode data gambar
tidak tepercaya (decoder gambar adalah permukaan serangan besar untuk diarahkan
ke unggahan sembarang), dan orangnya melihat persis apa yang akan disimpan
alih-alih menemukan hasil pangkasnya belakangan.

**512×512** karena di situlah kedua platform bertemu — ikon listing Play 512,
dan itu aset terbesar yang diminta App Store — jadi satu persegi melayani
keduanya. Bagian **tengah** yang diambil karena di situlah subjek sebuah ikon
berada; memangkas dari sudut akan diam-diam memenggal separuh logo.

### T&C dan privasi: ditunjuk, bukan dikarang
Ini dokumen hukum milik siapa pun yang men-deploy MAYA. Setiap perusahaan sudah
punya, dan membundel teks generik berarti menyatakan kewajiban atas nama mereka
yang tidak pernah disetujui siapa pun. Jadi `extra.termsUrl` dan
`extra.privacyUrl` — kosong secara bawaan, dan tautannya **tidak ditampilkan**
kalau kosong. Itu jujur; tautan ke halaman berisi teks isian tidak.

### Pengujian beta di sisi ponsel
Ini yang benar-benar hilang: penguji **tidak bisa melihat** bahwa yang mereka
pegang bukan yang dimiliki orang lain. Tanpa itu, "ini rusak" dan "ini rusak dan
memang itu intinya, Anda sedang mengujinya" adalah kalimat yang sama.

API kini mengembalikan `track`, dan `TrackPill` menandainya — tapi **tidak
merender apa pun untuk `production`**, yang merupakan mayoritas besar dari apa
pun yang dilihat orang. Lencana di setiap baris adalah wallpaper; lencana yang
hanya muncul pada dua-tiga build yang sedang Anda uji adalah informasi.

241 test lolos, empat paket typecheck.

## 2026-08-24 — Pemeriksaan package id: dibangun sebagai catatan, bukan penghalang

Diminta memeriksa ke Apple dan Google supaya tidak ada dua app dengan package id
sama. Dibangun untuk Apple, **sebagai saran**, dan alasannya terbukti sendiri
saat diuji:

| Bundle id | Hasil |
|---|---|
| `com.burbn.instagram` | cocok — Instagram, oleh Instagram, Inc. |
| `com.company.definitely-not-real` | tidak cocok, benar |
| `com.google.android.calculator` | **tidak cocok** — padahal app nyata dan terkenal |

Baris ketiga adalah seluruh argumennya. Calculator milik Google itu ada; Apple
tidak pernah mendengarnya, karena hanya Android. Google Play tidak punya API
publik yang setara — Play Developer API hanya mencakup app yang sudah Anda
miliki, dan alternatifnya menggores halaman toko, yang rusak diam-diam dan
melanggar ketentuan mereka.

Jadi pemeriksaan ini bekerja untuk iOS dan buta terhadap Android. Menyajikannya
sebagai "kami memeriksa tabrakan" akan mengundang kepercayaan yang tidak bisa
dibayarnya. UI-nya mengatakan itu apa adanya, dan **tidak pernah memblokir** —
apalagi karena tabrakan sering kali memang benar: toko internal wajar memuat
build perusahaan sendiri atas app yang juga ada di publik.

Di-debounce 500 ms dan timeout 2,5 detik: penerbitan tidak boleh menunggu uptime
orang lain, dan satu permintaan per ketikan berarti satu permintaan untuk setiap
awalan sebuah bundle id. Terukur: **19 ketikan, 2 permintaan**.

Build EAS 1.0.2 dipicu — perubahan palet, tombol keluar, tautan legal, dan track
pill semuanya dikompilasi, jadi tidak ada yang sampai ke perangkat tanpa build.

241 test lolos, empat paket typecheck.

---

## Telemetri perangkat, dan APK yang separuhnya tidak pernah dijalankan

Angka di dashboard sebelumnya berasal dari seed. Sekarang ada jalur nyata:
`POST /v1/devices/register` mencatat perangkat per `(org_id, device_key)`, dan
`POST /v1/devices/install` mencatat hasil pemasangan. Diverifikasi langsung —
register berulang mengembalikan id yang sama (tidak ada baris ganda), versi OS
ikut terbarui, pemasangan berhasil dan gagal sama-sama 204, app tak dikenal 404.

Sisi mobile memanggilnya dengan sengaja tidak sempurna: **setiap fungsi telemetri
menelan galatnya sendiri**. Telemetri yang menggagalkan pemasangan lebih buruk
daripada telemetri yang hilang. Hasil pemasangan iOS **tidak** dilaporkan — di
sana URL diserahkan ke OS dan hasilnya memang tidak pernah kami lihat, jadi
melaporkannya berarti mengarang.

### 107 MB → 59,7 MB

APK universal membawa pustaka native untuk empat arsitektur sekaligus: 83,7 MB
dari 135 MB tak terkompresi. **46,6 MB di antaranya x86 dan x86_64 — tidak ada
ponsel yang memakainya.** Itu untuk emulator. Setiap karyawan mengunduhnya,
menyimpannya, dan tidak pernah bisa menjalankan satu byte pun.

Justru terasa paling berat di perangkat yang app ini memang dimaksudkan untuk
melayani: ponsel lama di wifi kantor.

Menghapusnya tidak merugikan pengembangan sama sekali — mesin build ini Apple
Silicon dan image Android yang terpasang arm64-v8a, jadi emulator berjalan di
arsitektur yang sama dengan ponsel.

Yang dipakai adalah `reactNativeArchitectures`, dan itu perlu satu build gagal
untuk dipelajari. `ndk.abiFilters` **diam-diam tidak berpengaruh** di sini — file
`.so` datang sudah jadi di dalam AAR, bukan dikompilasi proyek ini, jadi tidak
ada build NDK untuk dibatasi: keempat arsitektur tetap terkirim, APK tetap
106,6 MB. `splits.abi` memang bekerja, tapi menghasilkan satu APK per arsitektur
dan tidak ada yang gabungan, sementara EAS dan portal mengharapkan satu artefak.

Terukur, bukan diperkirakan: **106,6 MB → 59,7 MB (turun 44%)**, dan APK hasilnya
dipasang, diluncurkan, serta dirender di emulator arm64 tanpa `dlopen` yang gagal.

---

## Onboarding: ilustrasi unDraw, dan tema yang akhirnya benar-benar mengikuti sistem

Tiga slide pembuka sekarang memakai ilustrasi unDraw sungguhan — katalog app,
memasang, dan tetap terbarui. Sebelumnya panel gradien dengan satu glyph garis
di atasnya; sebelum itu lagi **huruf pertama judul**, yang merender "Y" raksasa
di slide pertama. Keduanya terbaca seperti gambar yang belum sempat diganti.

Yang penting bukan mengunduh SVG-nya, tapi ini: **tidak ada satu pun warna
harfiah yang dipertahankan.** unDraw digambar untuk halaman putih — permukaan
abu terang, figur nyaris hitam, satu aksen ungu `#6c63ff`. Ditempel apa adanya
ke app ini gagal dua kali: ungunya berkelahi dengan koral, dan di tema gelap
yang nyaris hitam, figur nyaris hitam itu lenyap.

Jadi setiap `fill` ditulis ulang menjadi slot pada palet ilustrasi, dan paletnya
diselesaikan per tema. Kedua skema **tidak mewarnai gambar yang sama — keduanya
membalik pencahayaannya**: `ink` dan `paper` bertukar tempat, sehingga figur yang
tadinya gelap di atas abu terang menjadi terang di atas abu gelap. Kontras yang
menjadi dasar komposisi gambar itu dipertahankan, bukan warna harfiahnya.

**Warna kulit sengaja tidak ikut ditemakan.** Itu satu-satunya bagian gambar yang
menggambarkan sesuatu yang nyata; menerangkannya untuk tema gelap berarti
mengubah *siapa* yang digambarkan, bukan bagaimana gambar itu disinari.

Konverternya (`scripts/undraw.mjs`) ikut masuk repo, bukan dijalankan sekali lalu
dilupakan: menambah slide keempat seharusnya satu perintah, bukan sesorean
menyunting elemen path.

### Bug yang ditemukan sambil jalan: "Sistem" tidak pernah berarti sistem

`app.json` mengunci `userInterfaceStyle: "dark"`. Artinya `useColorScheme()`
selalu menjawab gelap, dan opsi **"Sistem"** di halaman profil — yang memang
ditawarkan ke pengguna, lengkap dengan terjemahannya — hanyalah "Gelap" ketiga.
Seluruh `lightPalette` yang sudah dibangun dengan rapi tidak pernah terjangkau
lewat jalur itu.

Diubah ke `automatic` untuk kedua platform. Diverifikasi hidup di emulator:
menukar night mode OS membalik app ke terang lalu kembali ke gelap **tanpa
memulai ulang app**, dan ilustrasinya ikut membalik sebagaimana dirancang.

Empat paket typecheck, 241 test lolos.
