# BRD — Internal Enterprise App Store

> Business Requirements Document. Project: app-store-clone. Status: DRAFT v1.
> Scope v1: Web app + Expo mobile app + API backend. Local auth invite-only. Local/private infra (Tailscale + SQLite).

---

## 1. Executive Summary

**Internal Enterprise App Store** — platform self-hosted untuk distribusi app internal perusahaan (Android APK + iOS IPA). Karyawan bisa browse, search, lihat detail, download/install app internal; admin/publisher bisa upload app + versi dengan kontrol publish dan audit. Berjalan privat di jaringan Tailscale, storage SQLite, tanpa eksposur publik.

**Problem yang diselesaikan**: distribusi app internal yang sekarang kemungkinan lewat chat/manual sharing → versi kacau, tidak ada jejak, tidak ada kontrol siapa akses apa. App store ini memusatkan distribusi, memberi versi yang jelas, kontrol akses, dan audit.

## 2. Problem Statement
- Tim internal tidak punya satu tempat terpusat untuk mendistribusikan build app internal.
- Sharing manual (chat, drive, USB) → versi tidak jelas, file bisa salah, tidak ada kontrol siapa yang bisa akses.
- Tidak ada approval/audit sebelum app disebar → risiko build salah/keliru tampil.
- Karyawan tidak punya cara konsisten untuk menemukan & meng-update app internal mereka.

## 3. Vision
Satu pintu terpusat, privat, dan aman untuk semua distribusi app internal perusahaan — mirip Play Store/App Store tapi khusus internal, self-hosted, dan terkontrol.

## 4. Target Audience
- **End user (viewer)**: karyawan internal yang perlu menemukan & meng-install app kerja.
- **Publisher**: tim developer internal yang upload & mengelola versi app.
- **Admin**: tim IT/platform yang menyetujui publish, mengelola user & role.

## 5. Core Pillars (feature categories)

| Pillar | Deskripsi |
|--------|-----------|
| **P1. Katalog & Discovery** | Browse, search, kategori, filter/sort, app detail, featured |
| **P2. Distribusi & Instalasi** | Upload APK/IPA, multi-version, download/install Android (nyata) + iOS (minimal), checksum |
| **P3. Kontrol & Governance** | RBAC (admin/publisher/viewer), publisher whitelist, immutable release, audit log |
| **P4. Contoh & Akses** | Auth invite-only, role-based visibility, status app jelas per user |
| **P5. Rating & Umpan Balik** | Rating bintang + review (opsional, fase lanjutan) |

## 6. Differentiators vs. Market (komparator)

| Komparator | Mereka | Kita |
|---|---|---|
| **Google Play / App Store** | Publik, skala global, distribusi massal | Internal, privat, terkontrol, self-host |
| **F-Droid** | Repo APK open-source, publik | Internal enterprise, auth+RBAC+audit |
| **Aptoide** | Marketplace Android publik, multi-store | Internal, approval, audit |
| **Jamf / Intune Company Portal** | Enterprise MDM, distribusi via MDM | Self-host ringan, tanpa vendor MDM, Tailscale |
| **APKMirror** | Repo APK download | Internal, controlled access |

**Kelebihan kita untuk kebutuhan ini**: privat & self-host (data tidak keluar), ringan (SQLite + satu host), kontrol penuh (RBAC + audit + immutable release), tanpa vendor lock-in.

## 7. Functional Requirements (FR)

### P1 — Katalog & Discovery
- **FR-1.1** Sistem menampilkan daftar app (grid/list) dengan ikon, nama, versi, rating.
- **FR-1.2** Sistem mendukung pencarian app berdasarkan nama dan deskripsi.
- **FR-1.3** Sistem menampilkan app per kategori (HR, Sales, Tools, dll).
- **FR-1.4** Sistem mendukung filter & sort (platform, kategori, terbaru).
- **FR-1.5** Sistem menampilkan app detail: ikon, nama, versi, size, deskripsi, screenshots, release notes, min OS, rating.
- **FR-1.6** Sistem menandai app "featured/recommended".

### P2 — Distribusi & Instalasi
- **FR-2.1** Publisher dapat upload binary (APK/IPA) + metadata.
- **FR-2.2** Sistem mendukung multi-version per app (versi lama tetap tersimpan).
- **FR-2.3** Sistem menghitung size & SHA-256 checksum otomatis saat upload.
- **FR-2.4** User dapat download APK (Android) dengan streaming + resumable.
- **FR-2.5** iOS: sistem menyediakan metadata + instruksi/link distribusi (path sesuai proses yang tersedia).
- **FR-2.6** Sistem mendeteksi & menampilkan "update tersedia" per user.
- **FR-2.7** Sistem menolak upload > 2 GB dan file tidak valid (tipe/ekstensi).

### P3 — Kontrol & Governance
- **FR-3.1** Sistem menerapkan RBAC: `admin`, `publisher`, `viewer`.
- **FR-3.2** Hanya publisher/admin yang bisa upload & publish.
- **FR-3.3** Release immutable setelah published (tidak bisa di-overwrite).
- **FR-3.4** Sistem mencatat audit log untuk upload, publish, archive, login, download attempt.
- **FR-3.5** Release lifecycle: `draft`, `published`, `archived`.
- **FR-3.6** Hanya admin yang bisa manage user & role.

### P4 — Contoh & Akses
- **FR-4.1** Auth invite-only (email/password + JWT), tanpa self-service open registration.
- **FR-4.2** Arsitektur auth diisolasi agar siap upgrade ke SSO/OIDC tanpa rewrite.
- **FR-4.3** Visibility app dibatasi oleh role user (viewer hanya lihat app yang boleh diaksesnya).
- **FR-4.4** Status akses app jelas di UI (available / restricted / unsupported device).

### P5 — Rating & Umpan Balik (fase lanjutan)
- **FR-5.1** (Lanjutan) User dapat memberi rating 1-5 + review.
- **FR-5.2** (Lanjutan) Rating agregat ditampilkan di listing & detail.

## 8. Non-Functional Requirements (NFR)

| NFR | Kebutuhan |
|---|---|
| **NFR-1 Privasi** | Self-hosted, no public exposure, akses via Tailscale |
| **NFR-2 Keamanan** | JWT auth, password di-hash (argon2/bcrypt), RBAC, download butuh token, store di luar web root |
| **NFR-3 Integritas** | SHA-256 checksum, immutable releases, validasi tipe/size file |
| **NFR-4 Performance** | Streaming download, SQLite WAL, search FTS5 (cukup untuk ratusan app) |
| **NFR-5 Skalabilitas** | SQLite + Drizzle → swap ke Postgres & MinIO bila perlu |
| **NFR-6 Reliabilitas** | Backup SQLite + artifact off-box, restore drill, health checks |
| **NFR-7 Usability** | Web responsif + mobile app; empty/loading/error states jelas |
| **NFR-8 Maintenance** | Stack TS penuh (backend+frontend), testable, code review |

## 9. Success KPIs
- **KPI-1**: Tim internal bisa publish build dalam < 5 menit (vs manual sharing).
- **KPI-2**: 100% app internal terpusat di satu tempat dalam 1 bulan go-live.
- **KPI-3**: Zero kasus salah-version/keliru-tampil karena immutable release + approval.
- **KPI-4**: Zero eksposur publik (semua traffic via Tailscale).
- **KPI-5**: Adopsi: mayoritas tim dev pakai store untuk distribusi dalam 1 bulan.

## 10. Risks & Assumptions

| Risk | Mitigasi |
|---|---|
| Scope melebar (mobile+SSO+scan) | Lock scope v1, backlog untuk v1.1 |
| iOS distribution complex | DoD iOS = metadata + instructions (jujur), path nyata menyusul |
| Local auth jadi hutang | Isolasi auth boundary, rencanakan migrasi OIDC |
| Rilis salah tayang | Publisher whitelist + immutable release + audit |
| SQLite/artifact restore gagal | Storage terpisah, backup off-box, restore drill |
| Expo mobile menambah beban | Timeline pecah per platform, uji dua surface |

**Asumsi**: tim kecil (1 engineer + AI agents); infrastruktur lokal tersedia (host untuk Tailscale); SQLite cukup untuk volume internal; publisher internal terpercaya (scan malware ditunda).

## 11. Scope Boundaries (v1)
- **IN**: Web app + Expo mobile + API, katalog, upload/download, approval-minimal, RBAC, audit, checksum, local auth.
- **BUKAN v1**: SSO (kecuali provider siap), ClamAV, approval workflow formal, request-access workflow, granular RBAC, notifikasi/analytics lanjutan, rating/review (fase lanjutan), public storefront.
- **v1.1 backpack**: SSO/OIDC, ClamAV async scan, rating/review, iOS full install path, MinIO, Postgres, analytics, notifikasi.

## 12. Definition of Done (v1)
Release v1 dianggap selesai & usable jika:
1. User dapat login (invite-only), browse, search, lihat detail, download/install app sesuai hak akses.
2. Publisher dapat upload app + versi, publish/unpublish, dengan immutable release + audit tercatat.
3. Admin dapat mengelola user/role dan approve release.
4. Android install flow berfungsi nyata; iOS minimal (metadata + instructions).
5. Zero critical security issue (JWT, RBAC, download-auth, checksum).
6. Deploy di host Tailscale, backup berjalan, health check aktif.
7. **E2E flow inti jalan**: `upload → publish → visible ke user terotorisasi → download/install/instructions → audit tercatat`.

---

*Dokumen: BRD v1. Berikutnya: ToR (teknis), Tech Stack, Goals & Timeline.*