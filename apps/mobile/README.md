# Mobile — Internal Enterprise App Store

Expo (SDK 57) / React Native 0.86 / TypeScript client for the internal app store.
Covers **P1 — Katalog & Discovery** (browse, search, categories, filter/sort,
featured, app detail) and the browse → detail → download/install flow.

The NestJS API (`apps/api`) does not exist yet, so the app runs against an
in-memory **MockAppProvider**. All data access goes through one interface
(`AppStoreClient`), so switching to the real API is a config change — no screen
or component is aware of where the data comes from.

## Run

```bash
cd apps/mobile
npm install

npm start          # Metro / Expo Go
npm run android    # expo run:android — native debug build
npm run ios        # expo run:ios

npm run typecheck  # tsc --noEmit
npm run doctor     # expo-doctor
```

## Structure

```
apps/mobile/
├── app/                          # expo-router file-based routes
│   ├── _layout.tsx               # Stack + theme, "About" header action
│   ├── index.tsx                 # Catalog: search, categories, sort, featured, list
│   ├── about.tsx                 # About/settings: shows active data source
│   └── app/[slug].tsx            # App detail + install bar
├── src/
│   ├── api/
│   │   ├── client.ts             # AppStoreClient interface + ApiError + toErrorMessage
│   │   ├── config.ts             # base URL, prefixes, useMockData (from expo.extra)
│   │   ├── mock-data.ts          # 8 realistic internal apps across HR/Finance/Tools/Sales/Ops
│   │   ├── mock-provider.ts      # MockAppProvider — in-memory, simulated latency
│   │   ├── http-provider.ts      # HttpAppProvider — REST against apps/api
│   │   └── index.ts              # getClient() / setClient() — the single seam
│   ├── components/
│   │   ├── AppCard.tsx  FeaturedCard.tsx  IconPlaceholder.tsx  Screenshot.tsx
│   │   ├── Button.tsx   CategoryChip.tsx  SearchBar.tsx  RatingStars.tsx
│   │   ├── StatusPill.tsx        # available / restricted / unsupported (FR-4.4)
│   │   └── StateViews.tsx        # LoadingState / ErrorState / EmptyState
│   ├── hooks/
│   │   ├── useAsync.ts           # request-state primitive (stale-run safe)
│   │   ├── useApps.ts            # useApps, useFeaturedApps
│   │   ├── useAppDetail.ts       # detail by slug
│   │   ├── useSearch.ts          # debounced search + useDebounced
│   │   └── useDownload.ts        # download ticket → Android open / iOS instructions
│   ├── constants/theme.ts        # colors, spacing, radius, typography, shadow
│   ├── utils/format.ts           # bytes, dates, ratings, placeholder palettes
│   └── types.ts                  # App, DownloadTicket, Category, AccessStatus, …
└── assets/
```

### Screens

| Route | What it does |
|---|---|
| `/` | Catalog. Debounced search over name/description/publisher, category chips (All + HR/Finance/Tools/Sales/Ops), sort (A–Z / recently updated / top rated), horizontal featured rail, pull-to-refresh, loading/error/empty states. |
| `/app/[slug]` | Detail. Icon, name, publisher, rating, access status, spec strip (version / size / category / min OS), screenshot carousel, description, release notes, information table, and a sticky Install bar. |
| `/about` | Which backend is active, API base URL, and how to leave mock mode. |

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
