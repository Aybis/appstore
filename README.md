# MAYA — Enterprise App Store

A private app store for company-built apps. An organization publishes its
Android (APK) and iOS (IPA) builds, and its people install them from the MAYA
mobile app or the web portal.

This repo is the **mobile app** only.

The other sides live in their own repos:

- backend (NestJS API, PostgreSQL, deploy): [Aybis/maya-store-backend](https://github.com/Aybis/maya-store-backend)
- web console and install page: [Aybis/maya-store-web](https://github.com/Aybis/maya-store-web)

## Folder structure

```
appstore/
├── .env.example            env template for the mobile app (copy to .env)
├── package.json            root scripts: pnpm dev:mobile, ...
└── apps/mobile/
    ├── app/                expo-router screens (the "pages" layer)
    └── src/
        ├── components/     atoms → molecules → organisms → templates
        ├── hooks/
        ├── services/       api, auth, install, notifications, storage, ...
        ├── theme/          palettes, tokens, layout constants
        └── utils/
```

See the [mobile README](apps/mobile/README.md) for devices and builds.

`sdk/maya-update/` is the in-app update SDK for apps distributed through MAYA
(check on launch; update through MAYA or in place). See its
[README](sdk/maya-update/README.md).

## Analytics

Firebase (Analytics + Crashlytics) records behaviour once credentials are in
place: screens automatically, the events in `src/services/telemetry`, crashes,
and Firebase's own `first_open`, `session_start`, `app_update` and, on
Android, `app_remove`. The MAYA API records the facts the console shows: the
device list per person (with signed-out / probably-uninstalled state), and the
install funnel, to which MAYA reports its first open
(`src/services/device/funnel.ts`) under the same device key it later signs in
with.

## Quick start

You need Node 22+ and pnpm (`corepack enable`). Run the backend from the
`maya-store-backend` repo first (`pnpm dev:api`, http://localhost:3000), or use
the hosted API (the default).

```bash
pnpm install
cp .env.example .env
pnpm dev:mobile      # Expo / Metro
```

Sign in with `demo@maya.app` / `demo1234`.

Checks:

```bash
pnpm typecheck
pnpm test
```

## Environment

The env file lives at the repo root, is read by `apps/mobile/app.config.js` at
build time, and is gitignored; `.env.example` is the template.

## App IDs

The MAYA app is `com.maya.store`. Apps you publish through it follow the same
pattern and only the last part changes: `com.maya.hrportal`,
`com.maya.expenses`, `com.maya.fieldscanner`.

The id is set in `apps/mobile/app.json` (`ios.bundleIdentifier` and
`android.package`). How to register it with Apple and Google is in the
[mobile README](apps/mobile/README.md#app-id-package-name).
