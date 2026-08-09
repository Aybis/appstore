# ToR — Technical Specification

> Technical spec for Internal Enterprise App Store. Companion to BRD. Status: DRAFT v1.

---

## 1. Architecture Overview

**Monolothic NestJS backend** serving JSON API + binary streaming. Two clients: React SPA (web) + Expo/RN (mobile). Single process, all behind Tailscale. No CDN (private mesh = no gain).

```
                    ┌──────────────────────────────────────────────┐
  React SPA (web) ─▶│                                              │
                    │          NestJS API (single process)         │
  Expo/RN (mobile)─▶│  REST /api/v1/*  +  /download/:id/stream     │
                    │  Auth (JWT local) · RBAC · Checksum          │── SQLite (WAL)
  Admin/publisher ─▶│  Approval-min · Audit · Metadata             │
                    │                                              │── Local FS (binaries)
                    └──────────────────────────────────────────────┘
                       ▲ single host, seluruhnya di belakang Tailscale
```

### Client breakdown
- **Web (React + Vite + TS)**: SPA untuk katalog browsing + panel admin/upload. Disajikan statis oleh backend/reverse proxy.
- **Mobile (Expo/React Native)**: katalog + detail + download/install experience on-device. Sama-sama panggil REST API. Tidak host binary.
- **Backend (NestJS)**: source of truth — API, auth, RBAC, approval, audit, streaming binary.

### Binary storage & serving
- **Metadata di SQLite; binary di local filesystem** (content-addressed: `store/<sha256[:16]>/<version>.bin`). Jangan BLOB ke DB.
- Serve via streaming controller (`res.download` / `StreamableFile`), dukung `Range`/resumable. Jangan expose path raw.
- Download butuh valid token/signed URL. Store dir **di luar webroot**.
- Growth path: MinIO/S3 di balik interface `BlobStore`.

### API
- REST, JSON, versi prefix `/api/v1`.
- Stateless JWT (bearer) pada semua route mutating + privileged; reads publik optional.
- Upload: `POST /api/v1/apps/:id/versions` (multipart) → stream ke temp → SHA-256 → metadata `draft` → publish gate → `published`.
- Download (mobile): `GET /download/:uuid/stream` → stream dgn `Content-Length`, `Content-Type`, `Accept-Ranges`, `Range` support.
- iOS OTA convenience: `GET /download/:uuid/ota.plist` → `manifest.plist` untuk `itms-services://`.

## 2. Data Model

```sql
users            id (uuid), email UNIQUE, password_hash, display_name, created_at, updated_at
roles            id, name UNIQUE ('admin','publisher','viewer'), description
user_roles       user_id FK, role_id FK

apps             id (uuid), name, slug UNIQUE, description, category, icon_path,
                 platform ('android'|'ios'|'both'), featured (bool), created_by FK, created_at, updated_at

app_versions     id (uuid), app_id FK, version, build_number, changelog,
                 file_path, file_size, sha256,
                 status ('draft'|'published'|'archived'),   -- immutable once published
                 bundle_id, min_os, uploaded_by FK, created_at

downloads        id, app_version_id FK, user_id FK, platform, ip/ua, downloaded_at

approvals        id, app_version_id FK, action ('submit'|'publish'|'archive'|'reject'),
                 actor_id FK, comment, created_at   -- audit trail for publish lifecycle

reviews          id, app_version_id FK, user_id FK, rating (1-5), comment, created_at  -- lanjutan

tokens           id, user_id FK, token_hash, expires_at, revoked

-- Search
app_fts          FTS5 virtual table over name, description, category
```

**Integrity**: FK on (`PRAGMA foreign_keys=ON`), UUID strings. Indexes: apps(slug), app_versions(app_id,status), downloads(app_version_id), users(email).

**Immutable release**: setelah `published`, `status` tidak bisa kembali ke `draft`; konten file tidak bisa di-overwrite; versi baru = row baru.

## 3. Process Flows

### A. Upload → Publish (admin/publisher)
```
Login → Panel admin → Upload App
  → isi metadata (nama, package/bundle id, kategori, deskripsi, min OS, screenshots, icon)
  → upload binary (APK/IPA) + release notes
  → sistem: stream ke temp → hitung SHA-256, size → validasi tipe/ukuran → simpan metadata status=draft
  → kumpulkan → Publish (gate: publisher whitelist) → status=published (immutable)
  → audit: approvals row (publish, actor)
  → notif/visible ke user sesuai RBAC
```

### B. Update versi
```
Upload binary baru + release notes → row app_versions baru (status=draft) → publish
  → versi lama tetap tersimpan (status retains / archived opsional) → user dapat "update tersedia"
```

### C. User browse → download/install
```
Login viewer → Home (featured + notif update) → browse kategori / search
  → detail app (ikon, versi, size, deskripsi, screenshots, release notes, min OS, rating)
  → Download/Install
  → Android: stream APK → install (download manager / web)
  → iOS: link/instructions (itms-services:// atau MDM path)
  → audit: downloads row
```

## 4. REST API Design

| Method | Path | Desc | Auth |
|---|---|---|---|
| POST | /api/v1/auth/login | Login (email/password) → JWT | - |
| POST | /api/v1/auth/refresh | Refresh token | refresh |
| GET | /api/v1/apps | List apps (filter/sort/search) | viewer+ |
| GET | /api/v1/apps/:slug | Detail app + versions | viewer+ |
| GET | /api/v1/apps/:slug/versions | Versions app | viewer+ |
| POST | /api/v1/apps | Create app (metadata) | publisher+ |
| PATCH | /api/v1/apps/:id | Edit metadata | publisher+ |
| POST | /api/v1/apps/:id/versions | Upload binary + metadata | publisher+ |
| POST | /api/v1/versions/:id/publish | Publish release | publisher+ |
| POST | /api/v1/versions/:id/archive | Archive release | admin |
| GET | /download/:id/stream | Stream binary (Range) | token |
| GET | /download/:id/ota.plist | iOS manifest | token |
| GET | /api/v1/search | Search (FTS5) | viewer+ |
| GET/POST | /api/v1/users, /api/v1/users/:id/roles | Manage users/roles | admin |
| GET | /api/v1/audit | Audit log | admin |

## 5. AI Service Contracts (tidak ada AI runtime di v1)
v1 tidak punya AI service runtime. AI (agents) dipakai di fase DEVELOPMENT saja (code gen, review, QA). Tidak ada endpoint AI di production v1.

## 6. Security & Compliance
- Password: argon2/bcrypt, no plaintext.
- JWT short-lived + refresh token (revocable).
- RBAC via RolesGuard + @Roles() decorator.
- Download route: valid token/signed URL; store dir luar webroot.
- Input validation: class-validator DTO; file: tipe/ekstensi/size cap 2GB.
- Checksum SHA-256 + X-Checksum-Sha256 header.
- Audit trail: approvals + downloads + login attempts.
- No public exposure — Tailscale ACL.

## 7. Testing Strategy
- Unit: auth, RBAC, state transitions (draft→published→archived), checksum.
- Integration: upload→publish→download, approval-min, search.
- Negative: file rusak, metadata kosong, version conflict, token expired, oversized upload.
- E2E (intensif di fase hardening): full flow user & admin.
- Concurrency: dua upload versi sama, dua publish bersamaan.

---

*Dokumen: ToR v1. Berikutnya: Tech Stack.*