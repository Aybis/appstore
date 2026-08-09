# Timeline & Gantt — Internal Enterprise App Store

> Phased schedule + Gantt. Status: v1. Tim: 1 engineer utama + AI agents.

---

## 1. Phases & Milestones (5 minggu)

```
M1 ██████████░░░░░░░░░░  P0+P1: monorepo, backend core (auth/RBAC/schema/upload)
M2 ░░░░░░░░████████░░░░  P1+P2: approval-min, publish flow, immutable release
M3 ░░░░░░░░░░░░░░██████  P3: web catalog + admin UI
M4 ██████████░░░░░░░░░░  P4: mobile app (Expo) — browse/detail/download
M5 ░░░░░░░░░░░░░░░░████  P5: hardening, tests, deploy, backup → RILIS
```

`▓` active · `░` buffer/no-work · milestone ◆

## 2. Week-by-Week Breakdown

### Minggu 1 — Foundation + Backend Core
- [ ] Monorepo setup (apps/api, apps/web, packages/shared), Drizzle schema
- [ ] NestJS boilerplate, SQLite WAL, migrations
- [ ] Auth: JWT login/refresh, argon2, RBAC, @RolesGuard
- [ ] Users CRUD + invite-only (admin)
- **◆ Milestone**: backend bisa login + manage user/role

### Minggu 2 — Upload, Publish, Audit
- [ ] Upload binary (multer streamed, size cap, checksum SHA-256)
- [ ] App & version CRUD, metadata terpisah dari binary
- [ ] Release lifecycle (draft/published/archived), immutable release
- [ ] Publisher gate + audit log (approvals, downloads, login)
- **◆ Milestone**: upload→publish→visible→download E2E (API level)

### Minggu 3 — Web Catalog + Admin
- [ ] React SPA: browse grid, search/FTS5, filter/sort, app detail
- [ ] Admin UI: upload form, publish, manage users/roles
- [ ] Katalog responsif, empty/loading/error states
- **◆ Milestone**: web usable end-to-end

### Minggu 4 — Mobile App (Expo)
- [ ] Expo app setup, login, katalog, detail, download
- [ ] Android download/install path (expo-file-system)
- [ ] iOS minimal (link/instructions)
- **◆ Milestone**: mobile browse + download jalan

### Minggu 5 — Hardening, Deploy, UAT
- [ ] Tests: unit/integration/negative/concurrency, E2E (Playwright)
- [ ] Security review, Docker Compose, Caddy TLS via MagicDNS
- [ ] Deploy host Tailscale, backup + restore drill, health checks
- [ ] UAT internal → rilis
- **◆ MILESTONE RILIS v1**

## 3. Critical Path
`Setup → Auth/RBAC → Upload/Checksum → Publish/Immutable → Web → Mobile → Deploy → Rilis`
- Auth & upload/publish adalah tulang punggung — blocker jika molor di M1-2.
- Mobile (Expo) di M4 punya buffer; hardening M5 serap slippage.

## 4. Resource Loading
| Resource | Beban |
|---|---|
| 1 backend dev | M1-2 pekat (core), M3-5 ringan (support) |
| 1 web dev | M3 pekat, M5 UAT |
| 1 mobile dev | M4 pekat |
| AI agents | code gen/review/QA sepanjang siklus |

## 5. Risk on Timeline
| Risk | Impact | Mitigasi |
|---|---|---|
| Expo mobile slip | +1-2 minggu | M4 buffer, ekspo minimal (browse+download) |
| iOS distribution | +1 minggu | DoD iOS = metadata+instructions (jujur) |
| Auth/upload core molor | critical path | Pisahkan task, jangan scope-creep |
| Setup SSO/ClamAV | +mol | Sudah ditunda dari v1 |

---

*Dokumen: Timeline v1.*