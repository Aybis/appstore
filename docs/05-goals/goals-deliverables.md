# Goals & Deliverables — Internal Enterprise App Store

> SMART goals, deliverables per phase, Definition of Done. Status: v1.

---

## 1. SMART Goals

| Goal | Ukuran |
|---|---|
| **G1** | Dalam 5 minggu, tim internal bisa publish build app < 5 menit via store (vs manual sharing). |
| **G2** | Dalam 1 bulan go-live, 100% app internal terpusat; 0 kasus salah-version/keliru-tampil. |
| **G3** | Zero eksposur publik — 100% traffic via Tailscale. |
| **G4** | E2E flow inti (upload→publish→visible→download→audit) divalidasi penuh sebelum rilis. |
| **G5** | Web + Expo mobile berfungsi; Android install path nyata; iOS minimal (metadata+instructions). |

## 2. Deliverables by Phase

| Phase | Deliverables | Owner | Done when |
|---|---|---|---|
| **P0 — Foundation (M1)** | Monorepo setup, shared types | API dev | Bisa setup workspace, tsc clean |
| **P1 — Backend Core (M1-2)** | NestJS API, SQLite schema, auth JWT, RBAC, upload/download, checksum, audit | API dev | API CRUD + auth + upload berfungsi |
| **P2 — Approval-min & Publish (M2)** | Release lifecycle (draft/published/archived), publisher gate, immutable release | API dev | Publish flow E2E + audit tercatat |
| **P3 — Web Catalog+Admin (M3)** | React SPA: browse/search/detail/admin UI | Web dev | Web usable, stlc |
| **P4 — Mobile App (M3-4)** | Expo app: katalog + detail + download | Mobile dev | Mobile browse+download jalan |
| **P5 — Hardening & Deploy (M4-5)** | Tests, security, Docker Compose, Tailscale, backup, restore drill | Infra/QA | Deploy di host, backup aktif, E2E pass |

## 3. Definition of Done (v1) — per platform
- **Android**: upload → publish → visible → download/install path nyata → audit ✓
- **iOS**: metadata + distribution instructions/link (path jujur sesuai proses tersedia) ✓
- **Web**: full admin + catalog usable ✓
- **Mobile (Expo)**: browse + detail + download ✓
- **Sec**: JWT, RBAC, download-auth, checksum, no public exposure ✓
- **Ops**: deploy Tailscale, backup, health check, restore test ✓

## 4. Non-goals (v1)
- Tidak: SSO, ClamAV, approval workflow formal, request-access workflow, rating/review (live), analytics, notifikasi, public storefront. → v1.1+.

---

*Dokumen: Goals & Deliverables v1.*