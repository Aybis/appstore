# MAYA — Mobile

Expo (SDK 57) / React Native 0.86 / TypeScript client for the internal app store.
Covers **P1 — Katalog & Discovery** (browse, search, categories, filter/sort,
featured, app detail) and the browse → detail → download/install flow, behind a
three-tab shell: **Discover · My Apps · Profile**.

The NestJS API (`apps/api`) does not exist yet, so the app runs against an
in-memory **MockAppProvider**. All data access goes through one interface
(`AppStoreClient`), so switching to the real API is a config change — no screen
or component is aware of where the data comes from.

## Run

This is a pnpm workspace package — install from the repo root, not from here.

```bash
pnpm install                        # from the repo root

cd apps/mobile
pnpm start                          # Metro
pnpm android                        # expo run:android — native debug build
pnpm ios                            # expo run:ios

pnpm typecheck                      # tsc --noEmit
pnpm doctor                         # expo-doctor
```

**Toolchain prerequisites on macOS.** `expo run:ios` needs the full Xcode
selected, and `expo run:android` needs a JDK on `JAVA_HOME`:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

The root `.npmrc` pins `node-linker=hoisted`. React Native's autolinking and a
few Expo runtime imports assume a flat `node_modules`; pnpm's default isolated
layout breaks Metro resolution. Do not remove it without re-testing a bundle.

## Structure

```
apps/mobile/
├── app/                          # expo-router file-based routes
│   ├── _layout.tsx               # AuthProvider + gate; root Stack, deep-link anchor
│   ├── onboarding.tsx            # signed-out landing (3-slide carousel)
│   ├── (auth)/
│   │   ├── _layout.tsx           # auth stack
│   │   ├── login.tsx             # sign in
│   │   └── register.tsx          # create account
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Bottom tab bar
│   │   ├── index.tsx             # Discover: search, categories, sort, featured, list
│   │   ├── my-apps.tsx           # Installed apps + update status
│   │   └── profile.tsx           # Account state + active data source
│   └── app/[slug].tsx            # App detail + install bar (pushed over the tabs)
├── src/
│   ├── api/
│   │   ├── client.ts             # AppStoreClient interface + ApiError + toErrorMessage
│   │   ├── config.ts             # base URL, prefixes, useMockData (from expo.extra)
│   │   ├── mock-data.ts          # 8 realistic internal apps across HR/Finance/Tools/Sales/Ops
│   │   ├── mock-provider.ts      # MockAppProvider — in-memory, simulated latency
│   │   ├── http-provider.ts      # HttpAppProvider — REST against apps/api
│   │   └── index.ts              # getClient() / setClient() — the single seam
│   ├── components/               # atomic design — see "Component layers" below
│   │   ├── atoms/                # Badge Button Caption Chip IconPlaceholder
│   │   │                         # Paragraph SearchGlyph SectionTitle StatusPill
│   │   │                         # TabIcons Title
│   │   ├── molecules/            # ChipRow SearchBar RatingStars Screenshot Section
│   │   │                         # SpecStrip InfoTable Notice StateMessage
│   │   │                         # LoadingState ErrorState EmptyState
│   │   ├── organisms/            # AppCard FeaturedCard FeaturedRail CatalogHeader
│   │   │                         # AppHero ScreenshotCarousel InstallBar
│   │   │                         # InstalledAppCard ProfileIdentity
│   │   └── templates/            # ListTemplate AppDetailTemplate
│   │                             # ScrollTemplate CenteredTemplate
│   ├── auth/AuthProvider.tsx     # session context — the seam over storage/auth
│   ├── storage/
│   │   ├── installs.ts           # local install log backing "My Apps"
│   │   └── auth.ts               # local accounts + session (mock, see warning)
│   ├── hooks/
│   │   ├── useAsync.ts           # request-state primitive (stale-run safe)
│   │   ├── useApps.ts            # useApps, useFeaturedApps
│   │   ├── useAppDetail.ts       # detail by slug
│   │   ├── useSearch.ts          # debounced search + useDebounced
│   │   └── useDownload.ts        # download ticket → Android open / iOS instructions
│   ├── constants/theme.ts        # colors, spacing, radius, typography, shadow
│   ├── utils/
│   │   ├── format.ts             # bytes, dates, ratings, placeholder palettes
│   │   └── sort.ts               # SortKey, SORT_OPTIONS, sortApps
│   └── types.ts                  # App, DownloadTicket, Category, AccessStatus, …
└── assets/
```

### Component layers

Components follow [atomic design](https://atomicdesign.bradfrost.com/chapter-2/).
The rule that keeps the layers honest is **what a component is allowed to know**:

| Layer | Knows about | Example |
|---|---|---|
| **atoms** | theme tokens only | `Button`, `Chip`, `StatusPill` |
| **molecules** | atoms + primitive props (`string`, `number`) — never `App` | `SearchBar`, `ChipRow`, `InfoTable` |
| **organisms** | domain objects (`App`, `Category`) | `AppCard`, `CatalogHeader`, `InstallBar` |
| **templates** | layout regions, passed as `ReactNode` — no data fetching | `CatalogTemplate` |
| **pages** | hooks, state, routing — the files in `app/` | `app/index.tsx` |

Dependencies point one way only: a page composes templates and organisms, an
organism composes molecules and atoms, an atom composes nothing. If a molecule
needs an `App`, it belongs in `organisms/`.

Each layer has a barrel (`atoms/index.ts`, …). Import from the specific layer
(`../src/components/organisms`) so the boundary is visible at the call site;
`components/index.ts` re-exports everything for pages that span several layers.

### Screens

| Route | What it does |
|---|---|
| `/` (Discover) | Catalog. Debounced search over name/description/publisher, category chips (All + HR/Finance/Tools/Sales/Ops), sort (A–Z / recently updated / top rated), horizontal featured rail, pull-to-refresh, loading/error/empty states. |
| `/my-apps` | Apps installed through MAYA, with installed version, install date, and an UPDATE badge when the catalog has moved ahead. |
| `/onboarding` | Signed-out landing. Three-slide carousel, then Sign in / Create account. |
| `/login`, `/register` | Local-account auth. Register validates name, email format, and an 8-character minimum. |
| `/profile` | Signed-in account, sign out, plus which backend is active, API base URL, and how to leave mock mode. |
| `/app/[slug]` | Detail. Icon, name, publisher, rating, access status, spec strip (version / size / category / min OS), screenshot carousel, description, release notes, information table, and a sticky Install bar. Pushes over the tab bar. |

### Auth (mock)

The app is **gated**: `AuthGate` in `app/_layout.tsx` sends signed-out users to
`/onboarding` and bounces signed-in users out of the auth screens, keyed off
`useSegments()`.

A demo account is seeded on first run so a fresh install can sign in immediately:

```
demo@maya.app / demo1234
```

> ⚠️ `src/storage/auth.ts` keeps passwords **in plain text** in AsyncStorage.
> That is acceptable only because these are dummy accounts with nothing behind
> them. It is replaced wholesale by the API's argon2 + org-scoped JWT flow —
> screens never touch storage directly, only `AuthProvider`.

### Why "My Apps" is not a device scan

Neither platform lets an app enumerate what else is installed — iOS exposes no
API at all, and Android gates it behind the Play-restricted
`QUERY_ALL_PACKAGES`. So `src/storage/installs.ts` keeps a local log of installs
initiated **through this app**, written by `useDownload` at handoff time (not at
OS-confirmed install, which is never reported back). When the API grows a
per-user install record, this becomes a cache in front of it — the shape is
already the same.

## Design

White, minimal, premium: white surfaces, hairline `#e8eaef` borders instead of
heavy shadows, one blue accent `#4a6cf7`. Tokens live in
`src/constants/theme.ts` — components never hardcode hex values.

App icons and screenshots are **not** network images. `IconPlaceholder` and
`Screenshot` derive a deterministic two-tone palette from the app slug, so the
UI is fully populated offline. `Screenshot` renders an `<Image>` as soon as the
URL starts with `http`, so real assets from the API drop in with no code change.

## Swapping the mock provider for the real API

Everything routes through `getClient()` in `src/api/index.ts`; there are no
`fetch` calls in screens, components, or hooks.

1. **Point at the API** — in `app.json`:

   ```json
   "extra": {
     "apiBaseUrl": "https://appstore.your-tailnet.ts.net",
     "useMockData": false
   }
   ```

   `getClient()` then returns `HttpAppProvider` instead of `MockAppProvider`.

2. **Wire the auth token** — downloads and API reads require a JWT (ToR §Security).
   Pass a token getter when constructing the provider:

   ```ts
   import { HttpAppProvider, setClient } from './src/api';
   setClient(new HttpAppProvider(() => authStore.accessToken));
   ```

3. **Confirm the endpoints** match `HttpAppProvider`:

   | Method | Endpoint |
   |---|---|
   | `listApps` | `GET /api/v1/apps?category=&featured=&sort=` |
   | `getAppDetail` | `GET /api/v1/apps/:slug` |
   | `searchApps` | `GET /api/v1/apps/search?q=&category=` |
   | `downloadApp` | `GET /api/v1/apps/:slug/download` → `DownloadTicket` |

   The ticket's `url` points at `GET /download/:id/stream`. Adjust
   `http-provider.ts` if the API settles on different paths — that file is the
   only place URLs are built.

4. **Response shape** — the API should return objects matching `App` in
   `src/types.ts`. Add a mapping layer inside `HttpAppProvider` if the wire
   format diverges; nothing above the provider should change.

Once `packages/shared` exists, move `src/types.ts` there so the API and both
clients share one definition.

## Notes / next steps

- Auth (invite-only JWT login) is not implemented yet — the app assumes an
  authenticated session. `HttpAppProvider` already accepts a token getter.
- Android install currently hands the stream URL to the system via `Linking`.
  Switching to `expo-file-system` + a resumable download is the follow-up for
  FR-2.4; iOS shows distribution instructions per FR-2.5.
- Ratings are read-only (FR-5.x is a later phase).
