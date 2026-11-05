# Employee-side screens: plan

Spans three repos: `maya-store-backend` (API + Postgres), `maya-store-web`
(admin console) and this repo (mobile). Order matters: backend first, then
the console to create the data, then mobile to show it.

## Why

Today MAYA is a catalog. An employee opens it only when they already know what
to install. A company wants the opposite: *tell me what I must install, what
changed, and who to ask*. "Required apps" is the main reason a person opens an
internal store; the rest supports it.

## Goals / non-goals

Goals
- A person sees what they **must** install or update, and by when.
- Admins publish short announcements; people see unread ones.
- A person can ask for an app they can't see, and ask for help.

Non-goals (for now)
- Device compliance / MDM checks (needs an agent; separate project).
- Chat or comments. Ratings stay as they are.
- iOS install-state detection (still log-based; unchanged).

## Data (backend, new migration `0019_employee_home.sql`)

| Table | Columns | Notes |
|---|---|---|
| `required_apps` | id, org_id, app_id, audience (`all` or `group`), group_id null, due_at null, created_by | One row per app per audience. Deadline optional. |
| `announcements` | id, org_id, title, body, level (`info`/`important`), app_id null, published_at, expires_at null, created_by | Optional link to an app. |
| `announcement_reads` | announcement_id, user_id, read_at | Primary key on both ids. |
| `app_requests` | id, org_id, app_id, user_id, note, status (`open`/`approved`/`declined`), decided_by, decided_at | Backs "Request access". |
| `app_owners` (columns on `apps`) | `owner_name`, `support_url` | Two text columns, default ''. |

All tables get the same RLS + `withTenant` treatment as `apps` and are covered
by `rls-invariants.spec.ts`. "Group" reuses what `userAppAccess` /
`appTesters` already model; if that does not fit, v1 ships `audience = all`
only and groups follow.

## API (backend)

Mobile (`/v1`, member auth):
- `GET /me/home` : required apps with the caller's state computed server-side
  (missing, outdated, ok, overdue), unread announcement count, open requests.
- `GET /announcements`, `POST /announcements/:id/read`
- `POST /apps/:slug/request-access`, `GET /me/requests`

Console (`/v1`, admin/publisher):
- CRUD for `required_apps` and `announcements`; list and decide `app_requests`.
- Every write goes to `audit_events`.

Push: creating an `important` announcement, or a required app with a deadline,
sends one FCM message through the existing `push` module (same
`release_announcements`-style dedupe table so nobody is told twice).

## Mobile (this repo)

A new first tab, **Home** (replaces "Discover" as the landing tab; Discover
stays as "Browse"):

1. **Required** card stack at the top: app icon, "Install" / "Update" /
   "Overdue" state, due date. Uses the existing install flow and `AppIcon`.
2. **Announcements** strip: latest 3, unread dot, tap opens a full inbox screen.
3. **Help** row: app owner + support link (from `apps.owner_name/support_url`),
   plus "Request access" on restricted apps in the detail screen.

New files, following the current layers:
- `src/services/api`: `home`, `announcements`, `requests` methods on both the
  HTTP and mock providers (mock keeps the app runnable without the API).
- `src/hooks/useHome.ts`, `useAnnouncements.ts`
- `src/components/organisms/RequiredAppCard.tsx`, `AnnouncementRow.tsx`
- `app/(tabs)/home.tsx`, `app/announcements.tsx`
- strings in `i18n/strings.ts` (English and Indonesian together, as required)
- analytics events: `required_viewed`, `required_install_started`,
  `announcement_opened`, `access_requested`

## Console (maya-store-web)

Pages: **Required apps** (pick app, audience, due date), **Announcements**
(compose, level, link to app, expiry) and **Requests** (approve/decline).

## Phases

1. Backend: migration, tables, RLS tests, `GET /me/home` and the required-apps
   endpoints. Done when `yarn test` passes and the endpoint returns state for a
   seeded user.
2. Console: Required apps page, so there is data to show.
3. Mobile: Home tab with Required cards; announcements inbox next.
4. Announcements end to end, with push.
5. Request access + owner/support info.

Each phase ships on its own and leaves the app working.

## Calls I made (change any)

- Home becomes the landing tab; Discover is renamed Browse.
- v1 audience is "everyone"; groups come only if the existing access tables
  map cleanly.
- State (missing/outdated/overdue) is computed on the server so iOS and
  Android agree and the client stays thin.
- No new push infrastructure; reuse the existing FCM sender and its dedupe.

## Risks

- Push delivery is still unconfirmed end to end (the Firebase test message
  never arrived). Phase 4 should not start until that is explained.
- Install state on iOS stays approximate, so "overdue" on iOS means "not in the
  install log", not "verified missing".
