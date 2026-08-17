# Local setup — bringing the whole stack up on a new machine

Everything needed to go from a fresh clone to the mobile app showing the real
catalog. Each step lists the failure it prevents, because most of these fail in
ways that point somewhere else.

---

## 0. Prerequisites

| Tool | Why | Check |
|---|---|---|
| Node ≥ 22 | workspace engines field | `node -v` |
| pnpm 9+ | monorepo package manager | `pnpm -v` |
| PostgreSQL **17** | matches Supabase's major version | `brew install postgresql@17` |
| JDK **17** | Android Gradle build | `brew install openjdk@17` |
| Xcode (full) | iOS build — CLT alone is not enough | `xcode-select -p` |
| Android SDK + an **arm64** AVD | Android build/run | Android Studio |

```bash
pnpm install          # from the repo root
```

> The root `.npmrc` pins `node-linker=hoisted`. React Native's autolinking and
> several Expo runtime imports assume a flat `node_modules`; pnpm's default
> isolated layout makes Metro fail to resolve them. Do not remove it.

---

## 1. PostgreSQL 17 on port **5433**

Homebrew's `postgresql@17` listens on 5432 by default, which usually collides
with another cluster. This project standardises on **5433**, and every URL in
`.env.example` assumes it.

```bash
# one-time: point the 17 cluster at 5433
sed -i '' 's/^#port = 5432.*/port = 5433/' /opt/homebrew/var/postgresql@17/postgresql.conf
brew services start postgresql@17

/opt/homebrew/opt/postgresql@17/bin/pg_isready -h localhost -p 5433   # expect "accepting connections"
```

**Skipping this** ⇒ `infra/local/setup.sh` aborts with "cannot connect to
postgres at localhost:5433".

---

## 2. Roles, databases, grants

```bash
./infra/local/setup.sh
```

Creates `appstore` + `appstore_test`, the `app_runtime` login role (no CREATE
privilege, no BYPASSRLS), and the schema grants. Safe to re-run.

---

## 3. Environment

```bash
cp .env.example .env
```

`.env.example` is already correct for the URLs above. Note `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` ship with `dev-unused` — artifacts are written to
`./store`, not S3, but `env.ts` requires them non-empty.

**Leaving them blank** ⇒ the API refuses to boot with a zod error naming S3,
which looks unrelated to whatever you were doing.

---

## 4. Migrations

Run them as the **schema owner**, not as `app_runtime` (which deliberately has
no CREATE privilege):

```bash
cd apps/api
DATABASE_URL="postgres://localhost:5433/appstore"      npx drizzle-kit migrate
DATABASE_URL="postgres://localhost:5433/appstore_test" npx drizzle-kit migrate
```

**Using the `.env` DATABASE_URL** (which points at `app_runtime`) ⇒ drizzle-kit
reports success having created nothing.

> Historical note: `0002_rls.sql` used to spell the statement-breakpoint marker
> inside its own header comment. drizzle-orm splits the raw file on that literal
> with no comment awareness, so the migration silently no-op'd. Fixed — but if
> you ever add that marker to prose in a migration, this returns.

---

## 5. Load the catalog

```bash
# from apps/api
MIGRATION_DATABASE_URL="postgres://localhost:5433/appstore" \
  npx tsx scripts/ingest-binaries.ts "/path/to/your/apk-ipa-folder" --org maya
```

Extracts real metadata (aapt2 for APKs, `Info.plist` for IPAs), copies each
binary into the content-addressed `./store`, and writes app/release/artifact
rows. Re-runnable — a second run is a no-op.

Then create a login for that org:

```bash
MIGRATION_DATABASE_URL="postgres://localhost:5433/appstore" \
  npx tsx scripts/seed-member.ts maya demo@maya.app demo1234 owner
```

`POST /v1/auth/signup` creates an org **and** its first owner together; this
script covers the other case — an org created by ingestion that has no members.

---

## 6. Run the API

```bash
cd apps/api
set -a && . ../../.env && set +a
npx nest start
```

**Must be the Nest CLI, not `tsx`.** tsx uses esbuild, which does not implement
`emitDecoratorMetadata`, so Nest's type-based DI breaks with
`Nest can't resolve dependencies of the RolesGuard`. The `scripts/*.ts` helpers
run fine under tsx because they use no DI.

Verify: `curl localhost:3000/health` → `{"status":"ok"}`

---

## 7. Point the app at *this* machine

Neither simulator reaches the host via `localhost` — on the Android emulator,
localhost is the emulator. Use the machine's LAN IP:

```bash
# en0 is not always the active interface — ask the routing table which is
ipconfig getifaddr "$(route -n get default | awk '/interface:/{print $2}')"      # e.g. 192.168.1.42
```

```bash
cd apps/mobile
MAYA_API_URL="http://192.168.1.42:3000" npx expo run:android
MAYA_API_URL="http://192.168.1.42:3000" npx expo run:ios
```

`app.config.js` overlays `MAYA_API_URL` (also `MAYA_ORG_SLUG`,
`MAYA_USE_MOCK_DATA`) onto `app.json`, so no committed file needs editing per
machine.

**`extra` is read at build time**, so changing the URL needs a rebuild — a
Metro reload is not enough.

Toolchain env for the builds:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Sign in with `demo@maya.app` / `demo1234`.

---

## 8. Android install permission

The store hands APKs to the system package installer, which Android gates
per-app. The manifest permission is declared, but the user still grants it once:

first install attempt → **Settings** → allow "install unknown apps" for MAYA.

---

## Gotchas that cost real time

- **An arm64-only emulator cannot run 32-bit-only APKs.** `armeabi-v7a`-only
  builds fail with "app isn't compatible with your phone" — correctly. Check
  with `aapt2 dump badging <apk> | grep native-code`.
- **iOS install cannot be tested on a simulator, ever.** Simulators run
  simulator-architecture bundles; an IPA holds device ARM binaries. Real iOS
  install needs an `itms-services://` manifest over HTTPS, an IPA signed with
  your ad-hoc/enterprise cert, and a physical device.
- **App Store IPAs are FairPlay-encrypted** and will not install anywhere,
  however they are signed.
- **A stale Metro on 8081** silently serves the old bundle while a new instance
  fails to bind. `lsof -nP -iTCP:8081 -sTCP:LISTEN` and kill it.
- **Push tokens need a physical device** plus APNs/FCM credentials via EAS.
  `registerForPushToken()` returns `null` on simulators by design; local
  notifications work everywhere.
