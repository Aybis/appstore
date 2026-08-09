# Self-Hosted Enterprise App Store — Architecture & Tech Stack

**Scope:** Internal/private store for Android APK + iOS IPA. Self-hosted, Tailscale-private, SQLite-first. Web (React/Vite/TS) + mobile (Expo/RN). Email/password (JWT) + optional SSO. Admin-only upload with approval flow. Greenfield.

---

## 1. Recommended Architecture

**Client–server, single logical service, 3 apps sharing one backend.**

- **Backend** = one NestJS API server that serves both the JSON API **and** the binary downloads (streaming). Keep it monolithic for v1 — no microservices.
- **Web app** = React + Vite + TS SPA, served statically by the same backend (or a reverse proxy). Admin/approval UI + catalog browsing.
- **Mobile app** = Expo/React Native, talks to the same REST API. The mobile app discovers/publishes/downloads apps; it does **not** host binaries.
- **Binary transport** — the backend streams APK/IPA over HTTP(S) with `Range` support (see §3). Entity IDs are UUIDs; user-facing URLs are short slugs.

```
                  ┌─────────────────────────────────────────────┐
  React SPA ─────▶│                                             │
                  │           NestJS API (single process)       │
  Expo/RN app ───▶│   REST /api/*   +   /download/:id/stream    │ │
                  │   Auth (JWT/SSO)  ·  Approval workflow      │─│── SQLite (WAL)
  Admin upload ──▶│   Metadata      ·  Checksum/SCAN           │ │
                  │                                             │─│── Local FS (binaries)
                  └─────────────────────────────────────────────┘
                          ▲  single process, all behind Tailscale
```

### Binary storage & serving
- **Store metadata in SQLite; store binaries on the local filesystem** (content-addressed: `PATH_HASH/sha256[:16]/version.bin`). Don't BLOB them into SQLite.
- **Serve downloads from the backend** via `res.download()` / a streaming controller. Do **not** expose the raw filesystem path.
- **CDN:** NOT needed for v1. The network is a private Tailscale mesh; a CDN adds cost + auth complexity for zero latency benefit. If you later outgrow a single host, add MinIO/S3-on-LAN or a reverse-proxy cache in front of the download route. Keep the download endpoint behind the same auth layer so binaries are not publicly fetchable.

### API design
- **REST, JSON, versioned prefix `/api/v1`.** Conventional resource nouns.
- Stateless JWT auth (bearer token) on every mutating + privileged route; public catalog reads optional.
- **Upload flow:** `POST /api/v1/apps/:id/versions` (multipart) → backend streams to temp, computes SHA-256, stores metadata as `pending` → optional virus scan → admin approves → version becomes `active` and downloadable.
- **Download flow (mobile):** `GET /download/:uuid/stream` → 302 or stream with `Content-Length`, `Content-Type`, `Accept-Ranges`. Mobile app uses native download manager.
- **iOS OTA convenience:** `GET /download/:uuid/ota.plist` serving an inline `manifest.plist` for `itms-services://` installs (name, bundleId, version, URL, icon). This is the standard enterprise IPA install path.
- Key endpoints: `auth/*`, `users`, `roles`, `apps`, `versions`, `downloads`, `reviews`, `approvals`, `search`, `health`.

---

## 2. Tech Stack by Layer

### Frontend — **React + Vite + TypeScript** ✅
- **Rationale:** Vite = fast dev/HMR + TS-first; React = largest ecosystem, trivial to hire for. Pair with TanStack Query (data fetching/cache) + React Router.
- Optional: Tailwind for rapid internal-tool UI; shadcn/ui components for a polished storefront quickly. Keep it one SPA, statically served.

### Mobile — **Expo / React Native** ✅
- **Rationale:** One codebase for iOS+Android; Expo covers the hard parts (provisioning, OTA, `expo-device`, `expo-media-library`/file-system for downloads, app links). EAS Build keeps CI signing manageable.
- Note: the store app itself is an internal tool; if employees already have an MDM (Intune/Workspace One), the **download/install** of the target apps can be delegated to MDM and this app becomes the catalog + approval UI. Expo is still the right pick for the catalog client.

### Backend — **NestJS** (over Express) ✅
- **Rationale:** Structured, module-based, DI, TypeScript-first, built-in Guards/Interceptors/Pipes — ideal for an admin/approval workflow with distinct modules (auth, apps, versions, approvals, downloads). Opinionated structure pays off as the app grows. NestJS actually runs on Express under the hood, so you keep Express streaming/`res` API.
- **Express alone** is fine for a tiny hack; pick it only if you want zero structure and will hand-roll validation/DI. For an enterprise internal tool with RBAC + audit, **NestJS wins**.
- Supporting libs: `class-validator`/`class-transformer` (DTO validation), `typeorm` or `drizzle-orm` for SQLite, `multer` for uploads, `bcrypt`/`argon2` for password hashing.

### Database — **SQLite (WAL mode)** ✅ for v1; Postgres as the escape hatch
- **Rationale:** Single host, private Tailscale, low write volume → SQLite is simpler (zero ops, one file, easy backup). Enable `PRAGMA journal_mode=WAL` + `busy_timeout=5000`.
- **Concurrent writes:** SQLite is single-writer (WAL gives concurrent readers + one writer). With a small team this is a non-issue. To stay safe:
  - Use a **single write connection** (e.g. `better-sqlite3` synchronous driver, or a small write-queue in TypeORM/Drizzle) so you never hit SQLITE_BUSY in practice.
  - Set `busy_timeout` and **retry transient `SQLITE_BUSY`**; keep write transactions short (never hold a write txn across a network call or file stream).
  - Reads go anywhere (WAL readers don't block the writer).
- **When to go Postgres:** if you later scale to multiple backend replicas, need live replication, or heavy concurrent analytics. It's a clean swap if you use an ORM (Drizzle/TypeORM) from day one. **Recommend Drizzle ORM** — SQLite-first, typed, and migrates to PG later.

### Object storage for binaries — **Local filesystem** ✅ for v1; MinIO/S3 as growth path
- **Rationale:** Minimal ops, fast local reads, no infra. Content-address by SHA-256.
- **MinIO / S3-compatible:** add when you outgrow one disk, want object versioning/lifecycle, or run multiple app servers. Use the S3 SDK behind a small `BlobStore` interface so swapping later is trivial.
- Avoid storing binaries in the DB. Keep them on disk, reference by hash.

### Search — **SQLite FTS5** ✅
- **Rationale:** Store is small (tens–hundreds of apps). FTS5 (`app_fts` table over name/description/version) gives BM25 relevance, no extra daemon, single file. Fast enough and zero ops.
- **Meilisearch** only if you need typo-tolerance, faceting, or large-scale search. It's 6–10× the storage and a separate process — overkill for an internal catalog. FTS5 with a few columns is plenty.

### Auth — **JWT + Passport** (local email/password) ✅, SSO via OIDC add-on
- **Core:** `@nestjs/passport` + `passport-jwt` for stateless auth; `bcrypt`/`argon2` hash; short-lived access token (15m) + long-lived refresh token, or a single longer-lived JWT for internal tool simplicity.
- **RBAC:** NestJS `RolesGuard` + `@Roles()` decorator; a `roles` table + join table.
- **SSO integration (optional, incremental):**
  - **Self-hosted IdP:** **Keycloak** (full-featured OIDC/SAML/LDAP/SCIM, enterprise-proven) — best if you already run one. **Authentik** (lighter, modern, OIDC/SAML/LDAP) is a strong simpler alternative. **Authelia** is forward-auth/"lightweight" — fine for a couple apps, underpowered for real enterprise IAM.
  - **SaaS IdP:** **Auth0** or **Microsoft Entra ID (Azure AD)** — pick if you already have an Entra/Microsoft tenant (most enterprises do). Integrate by adding an **OIDC `passport-oidc` strategy**; keep local accounts as fallback. JWT is issued by the store after IdP exchange (hybrid), or validate IdP tokens directly.

---

## 3. Safely Storing & Serving APK / IPA

- **Streaming:** Serve via `res.writeHead(200, { 'Content-Length': size, 'Content-Type': 'application/vnd.android.package-archive' | 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Disposition': 'attachment; filename="app.apk"' })` and `fs.createReadStream(path).pipe(res)`. Support **Range requests** (`If-Range`/`Range` header parse) so mobile download managers can resume — important for large binaries over flaky mobile networks.
- **Resumability:** handle `206 Partial Content`. Libraries: NestJS `StreamableFile` + manual Range handling, or `res.sendFile` with range support.
- **Integrity / checksum:** On upload, stream the file to compute **SHA-256**; store it. On download, recommend the client verify the hash; expose it in the metadata API (`GET /api/v1/apps/:id` → `versions[].sha256`). Optionally serve `X-Checksum-Sha256` header. This catches corruption/tampering over the wire.
- **Signature trust:** APKs are signed (APK Signature Scheme v2/3) and IPAs are code-signed. Beyond SHA-256, **verify the signing cert** against a trusted list to guarantee provenance (optional but recommended for enterprise). Play Integrity / App Attest are for *runtime* integrity of the installed app, not upload-time — not needed v1.
- **Virus scan consideration:** For an internal, admin-only upload store, a full AV pipeline is optional. Lightweight wins:
  - **ClamAV** (open source) run as a scan step after upload, before approval. Offload to a queue so uploads aren't blocked.
  - Compare against a **known-bad hash list** as a cheap first pass.
  - If compliance requires it, hook into your existing EDR/AV (e.g. Microsoft Defender / CrowdStrike scanning API).
  - Fail-closed: a version with scan status `quarantined`/`failed` is never set `active`.
- **Size limits:** Enforce hard caps at the controller (e.g. **max 2 GB** per binary; typical APK 20–200 MB, IPA 50–500 MB). Use `multer` `limits.fileSize` + streamed temp write (don't buffer in memory). Reject oversized uploads early with a clear 413.
- **Storage layout:** temp dir → hash-confirmed → move into content-addressed store; never trust client filename (store safe slug + original name in DB, sanitize).
- **Access control:** download route requires a valid token (or a short-lived signed download URL) so binaries aren't world-readable. Keep the store dir **outside** the web root.

---

## 4. Data Model Sketch (SQLite)

```
users            id, email UNIQUE, password_hash, display_name, created_at, updated_at
roles            id, name UNIQUE ('admin','approver','publisher','viewer'), description
user_roles       user_id FK, role_id FK        (many-to-many)

apps             id (uuid), name, slug UNIQUE, description, category, icon_path,
                 platform ('android'|'ios'|'both'), created_by FK, created_at, updated_at
app_versions     id (uuid), app_id FK, version, build_number, changelog, file_path,
                 file_size, sha256, status ('pending'|'active'|'rejected'|'archived'),
                 scan_status ('clean'|'failed'|'skipped'), bundle_id, min_os,
                 uploaded_by FK, created_at

downloads        id, app_version_id FK, user_id FK, platform, ip/ua, downloaded_at
                 (index on app_version_id, user_id; used for analytics)

reviews          id, app_version_id FK, user_id FK, rating (1-5), comment, created_at

approvals        id, app_version_id FK, action ('submit'|'approve'|'reject'),
                 reviewer_id FK, comment, created_at        (audit trail)

tokens           id, user_id FK, token_hash, expires_at, revoked      (refresh tokens)

-- Search
app_fts          FTS5 virtual table over name, description, category, version
```

- **Integrity:** FKs on; `PRAGMA foreign_keys=ON`. UUID strings for ids (avoids enumeration). Indexes: `apps(slug)`, `app_versions(app_id, status)`, `downloads(app_version_id)`, `users(email)`.
- **Soft-delete / audit** via `approvals` + `updated_at`; consider a trigger or service-level audit log for admin actions.

---

## 5. Deployment Topology — Local / Private Tailscale

- **Single host** (home server / mini PC / VM) running backend + SQLite + local binaries, all inside the Tailscale network — no public exposure required.
- **Stack on the host:**
  - **Docker Compose** for the app (multi-stage build: Node image for API, `nginx` or serve-static for the SPA) + optional **ClamAV** container + optional **Caddy/Traefik** reverse proxy for TLS on the Tailscale IP/hostname.
  - **Tailscale** on the host gives a stable private IP + MagicDNS hostname (e.g. `https://appstore.tailnet-name.ts.net`). Enable **HTTPS certs** (Tailscale HTTPS or Caddy) even internally — mobile install flows and keychain trust behave better over TLS.
- **Clients:** employees' laptops (web) + phones (Expo app) join the same **Tailnet**; they reach the store via MagicDNS name. ACLs in Tailscale can restrict which nodes may reach the store port.
- **Backups:** nightly `sqlite3 .backup` (safe under WAL) + rsync/restic of the binary store to a second disk or offsite Tailscale node.
- **Mobile install specifics:**
  - **Android:** sideload APK from the in-app download URL (allow unknown sources via MDM policy, or use Managed Google Play if you have it).
  - **iOS:** enterprise/adhoc IPA install via the `itms-services://` manifest over HTTPS (must be valid HTTPS + trusted cert). For large fleets, **MDM (Intune/Workspace One)** remains the reliable install path; the store handles catalog + approvals + serving.
- **Scaling path (if ever needed):** split SPA to CDN/Cache, add MinIO for binaries, move SQLite→Postgres, run 2+ Nest replicas behind the proxy. Not needed for v1.

---

## Summary of Key Decisions
| Layer | Choice | Why |
|---|---|---|
| Backend | **NestJS** | Structured, TS-first, DI/Guards, Express underneath |
| DB | **SQLite WAL** (Drizzle ORM) | Zero ops for single host; swap to PG later |
| Binaries | **Local FS, content-addressed** | Simple; MinIO/S3 behind interface for growth |
| Search | **SQLite FTS5** | Enough for small catalog; Meilisearch overkill |
| Auth | **JWT + Passport**, OIDC SSO add-on | Stateless; Keycloak/Authentik/Entra when needed |
| Frontend | **React + Vite + TS** | Fast, TS-native, huge ecosystem |
| Mobile | **Expo/RN** | Cross-platform, EAS signing, download APIs |
| CDN | **None in v1** | Private Tailscale = no latency/CDN gain |
| Deploy | **Docker Compose on one Tailscale host** | Simple, private, TLS via MagicDNS |