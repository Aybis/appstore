# MAYA — Enterprise App Store

A private app store for company-built apps. An organization publishes its
Android (APK) and iOS (IPA) builds, and its people install them from the MAYA
mobile app or the web portal.

The backend (NestJS API, PostgreSQL, deploy) lives in its own repo:
[Aybis/maya-store-backend](https://github.com/Aybis/maya-store-backend).

| Side | Folder | Stack | README |
|---|---|---|---|
| Web console | `apps/console` | React 19, Vite, React Router | [apps/console](apps/console/README.md) |
| Mobile app | `apps/mobile` | Expo SDK 57, React Native, expo-router | [apps/mobile](apps/mobile/README.md) |
| Shared types | `packages/shared` | Zod contracts used by the console and mobile app | — |

## Folder structure

```
appstore/
├── .env.example            one env file for every side (copy to .env)
├── package.json            root scripts: pnpm dev:console, ...
├── apps/
│   ├── console/
│   │   └── src/
│   │       ├── components/ atoms → molecules → organisms → templates
│   │       ├── pages/      one file per route
│   │       ├── services/   API client + auth session
│   │       ├── styles/     design tokens + shared CSS
│   │       └── utils/
│   └── mobile/
│       ├── app/            expo-router screens (the "pages" layer)
│       └── src/
│           ├── components/ atoms → molecules → organisms → templates
│           ├── hooks/
│           ├── services/   api, auth, install, notifications, storage, ...
│           ├── theme/      palettes, tokens, layout constants
│           └── utils/
└── packages/shared/        Zod contracts (also vendored by the backend repo)
```

## Quick start (everything on your machine)

You need Node 22+ and pnpm (`corepack enable`). Run the backend from the
`maya-store-backend` repo first (`pnpm dev:api`, http://localhost:3000), or point
the console at a hosted API with `DEV_API_PROXY`.

```bash
pnpm install
cp .env.example .env

pnpm dev:console     # http://localhost:5173
pnpm dev:mobile      # Expo / Metro (see the mobile README for devices)
```

Sign in with `demo@maya.app` / `demo1234`.

Checks for the whole repo:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Environment

The env file lives at the repo root and both sides read it:

- the console reads it through Vite (`envDir`), and only `VITE_*` values reach the browser,
- the mobile app reads it in `app.config.js` at build time.

It is gitignored; `.env.example` is the template.

## App IDs

The MAYA app is `com.maya.store`. Apps you publish through it follow the same
pattern and only the last part changes: `com.maya.hrportal`,
`com.maya.expenses`, `com.maya.fieldscanner`.

The id is set in `apps/mobile/app.json` (`ios.bundleIdentifier` and
`android.package`). How to register it with Apple and Google is in the
[mobile README](apps/mobile/README.md#app-id-package-name).
