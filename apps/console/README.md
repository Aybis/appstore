# MAYA Console

The web side of MAYA, in one React app:

- a public landing page and per-app install page (`/`, `/app/:slug`),
- sign in and register,
- the console for publishers and admins: apps, builds, testers, people, API
  keys, audit log, dashboard and settings.

## Run locally

From the **repo root**, with the API running (see the [API README](../api/README.md)):

```bash
pnpm dev:console      # http://localhost:5173
```

The console calls the API on the same host at port 3000, which works for
`localhost` and for a phone on your LAN. To use the hosted API instead, set
these in the root `.env`:

```bash
DEV_API_PROXY=https://maya-api.muchtar.dev
VITE_API_BASE_URL=/
```

```bash
pnpm --filter @appstore/console typecheck
pnpm --filter @appstore/console build      # output in apps/console/dist
```

## Structure (atomic design)

```
src/
├── main.tsx              entry: Sentry, global CSS, <App />
├── App.tsx               routes and the signed-in / signed-out gates
├── config.ts             API URL and org, from VITE_* env
├── types.ts              API response types
├── components/
│   ├── atoms/            Button, ButtonLink, Pill, TrackPill, AppIcon, Card,
│   │                     Spinner, MayaMark, icons
│   ├── molecules/        Field, Message, PageHeader, Loading / Empty / Failed
│   ├── organisms/        ConfirmDialog (useConfirm), Sidebar
│   ├── templates/        ShellTemplate (signed-in layout), AuthTemplate
│   └── index.ts          one import for everything: '../components'
├── pages/                one file per route: Catalog, AppDetail, Members, ...
├── services/             api.ts (fetch + token refresh), auth.tsx (session)
├── styles/               theme.css (design tokens), components.css
└── utils/                platform detection, icon images, theme preference
```

What each layer may know:

| Layer | Knows about | Example |
|---|---|---|
| atoms | design tokens only | `Button`, `Pill` |
| molecules | atoms + plain props | `Field`, `PageHeader` |
| organisms | app data and context | `Sidebar`, `ConfirmDialog` |
| templates | page layout, no data fetching | `ShellTemplate`, `AuthTemplate` |
| pages | data loading, state, routing | `pages/Catalog.tsx` |

Dependencies point one way: pages use templates and organisms, organisms use
molecules and atoms, atoms use nothing.

Styling is plain CSS. Tokens (colours, spacing, motion) are custom properties
in `styles/theme.css`, and components use the shared classes in
`styles/components.css` (`btn`, `field`, `page-head`, …).

## Deploy

Vercel builds it with `apps/console/vercel.json`. See [deploy/README.md](../../deploy/README.md).
