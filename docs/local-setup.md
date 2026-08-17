# Local setup — clone to running app

Ordered steps for a machine that has never seen this project. Each one names
the failure it prevents, because most of these fail while pointing somewhere
else.

About 15 minutes, most of it the first native build.

---

## Step 0 — Prerequisites

| Tool | Why | Install |
|---|---|---|
| Node ≥ 22 | workspace `engines` | `brew install node` |
| pnpm ≥ 9 | monorepo package manager | `corepack enable` |
| PostgreSQL **17** | matches Supabase's major version | `brew install postgresql@17` |
| JDK **17** | Android Gradle build | `brew install openjdk@17` |
| Xcode (full app) | iOS build — Command Line Tools alone is **not** enough | Mac App Store |
| Android Studio + an **arm64** AVD | Android build/run | developer.android.com |

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Put the `JAVA_HOME` line in `~/.zshrc` — Gradle needs it every build.

---

## Step 1 — Install dependencies

```bash
git clone https://github.com/Aybis/appstore.git
cd appstore
pnpm install
```

> The root `.npmrc` pins `node-linker=hoisted`. React Native's autolinking and
> several Expo runtime imports assume a flat `node_modules`; pnpm's default
> isolated layout makes Metro fail to resolve them. **Do not remove it.**

---

## Step 2 — PostgreSQL 17 on port 5433

Homebrew's `postgresql@17` listens on 5432, which usually collides with another
cluster. This project standardises on **5433** and every URL assumes it.

```bash
sed -i '' 's/^#port = 5432.*/port = 5433/' /opt/homebrew/var/postgresql@17/postgresql.conf
brew services start postgresql@17

/opt/homebrew/opt/postgresql@17/bin/pg_isready -h localhost -p 5433
# expect: accepting connections
```

**Skip this** ⇒ Step 3 aborts with "cannot connect to postgres at localhost:5433".

---

## Step 3 — Roles, databases, grants

```bash
./infra/local/setup.sh
```

Creates `appstore` + `appstore_test`, the `app_runtime` login role (no CREATE
privilege, no BYPASSRLS), and the schema grants. Safe to re-run.

---

## Step 4 — Environment

```bash
cp .env.example .env
```

Already correct for the URLs above. `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`
ship as `dev-unused` — artifacts go to `./store`, not S3, but `env.ts` requires
them non-empty.

**Blanking them** ⇒ the API refuses to boot with a zod error naming S3, which
looks unrelated to whatever you were doing.

---

## Step 5 — Migrations

Run as the **schema owner**, not as `app_runtime`:

```bash
cd apps/api
DATABASE_URL="postgres://localhost:5433/appstore"      npx drizzle-kit migrate
DATABASE_URL="postgres://localhost:5433/appstore_test" npx drizzle-kit migrate
```

**Using `.env`'s `DATABASE_URL`** (which points at `app_runtime`, deliberately
without CREATE) ⇒ drizzle-kit reports success having created nothing.

---

## Step 6 — Seed the database

```bash
# still in apps/api
MIGRATION_DATABASE_URL="postgres://localhost:5433/appstore" pnpm seed
```

Creates the organization, an owner login, and 4 apps with 6 published releases
across both platforms, plus placeholder artifacts in `./store`:

```
org       maya
login     demo@maya.app / demo1234
catalog   4 apps, 6 new releases
```

Everything works against this data — catalog, search, detail, download ticket,
signed stream, and version-check, including a **forced update**, because HR
Portal carries `minimum_version = 3.0.0`.

The artifacts are a few KB of filler. **They are not installable packages** —
the download path resolves, but the OS will refuse to install one. That is
correct behaviour, not a bug. See Step 11 for real binaries.

Options: `pnpm seed -- --org acme --email me@acme.test --password something`.
Idempotent — re-running updates in place rather than duplicating.

---

## Step 7 — Run the API

```bash
# in apps/api
set -a && . ../../.env && set +a
npx nest start
```

**Must be the Nest CLI, never `tsx`.** tsx uses esbuild, which does not
implement `emitDecoratorMetadata`, so Nest's type-based DI dies with
`Nest can't resolve dependencies of the RolesGuard`. The `scripts/*.ts` helpers
run fine under tsx — they use no DI.

```bash
curl localhost:3000/health      # {"status":"ok"}
```

---

## Step 8 — Point the app at *this* machine

Neither simulator reaches the host via `localhost` — on the Android emulator,
localhost **is** the emulator. Use the machine's LAN IP:

```bash
cd apps/mobile
LAN_IP=$(ipconfig getifaddr "$(route -n get default | awk '/interface:/{print $2}')")
echo "$LAN_IP"        # e.g. 192.168.1.42
```

> `ipconfig getifaddr en0` returns empty whenever en0 is not the active
> interface, hence asking the routing table which one is.

```bash
MAYA_API_URL="http://$LAN_IP:3000" npx expo run:android
MAYA_API_URL="http://$LAN_IP:3000" npx expo run:ios
```

`app.config.js` overlays `MAYA_API_URL`, `MAYA_ORG_SLUG` and
`MAYA_USE_MOCK_DATA` onto `app.json`, so no committed file is edited per machine.

Sign in with **`demo@maya.app` / `demo1234`**.

> **`extra` is read at build time.** Changing the API URL, app name or icon
> needs a rebuild — a Metro reload keeps serving the old values. And
> `expo run:*` does **not** re-sync native config when `android/`/`ios/` already
> exist: run `npx expo prebuild -p <platform>` first.

---

## Step 9 — EAS project (only for push or cloud builds)

The project is already linked in `app.json`:

```json
"extra": { "eas": { "projectId": "486e26e3-cf99-4fd4-8e75-566f2df737fe" } }
```

That id is all `getExpoPushTokenAsync` needs. **Steps 1–8 work without touching
EAS at all** — local notifications (install finished, update available) need no
credentials.

EAS is required only for **remote push** or **cloud builds**:

```bash
npm install --global eas-cli
export PATH="$(npm config get prefix)/bin:$PATH"

eas login                                             # your Expo account
eas init --id 486e26e3-cf99-4fd4-8e75-566f2df737fe    # confirms the link
eas credentials                                       # APNs key (iOS) / FCM (Android)
```

Then rebuild — `extra` is build-time.

**Push tokens require a physical device.** `registerForPushToken()` returns
`null` on any simulator by design, and the API has no device-registration
endpoint yet, so nothing is sent anywhere until both exist.

---

## Step 10 — Android install permission

The store hands APKs to the system package installer, which Android gates
per-app. The manifest permission is declared, but the user grants it once:

first install attempt → **Settings** → allow "install unknown apps" for MAYA.

---

## Step 11 — Real binaries (optional)

Step 6's placeholders exercise every code path but cannot be installed. To load
actual builds from a folder of `.apk` / `.ipa` files:

```bash
# in apps/api
MIGRATION_DATABASE_URL="postgres://localhost:5433/appstore" \
  pnpm ingest -- "/path/to/your/apk-ipa-folder" --org maya
```

Extracts real metadata (`aapt2` for APKs, `Info.plist` for IPAs), copies each
binary into the content-addressed store, and writes app/release/artifact rows.
Re-runnable — a second run is a no-op.

Or upload through the API, which is how it works in production:

```bash
TOKEN=$(curl -s -X POST localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"orgSlug":"maya","email":"demo@maya.app","password":"demo1234"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')

curl -X POST localhost:3000/v1/apps/field-scanner/releases \
  -H "Authorization: Bearer $TOKEN" \
  -F version=2.2.0 -F platform=android -F packageId=com.internal.fieldscanner \
  -F publish=true -F file=@./field-scanner.apk
```

---

## Housekeeping

The artifact store is append-only — nothing removes an object while its release
exists, which is correct, but deleting an app would otherwise strand the bytes.

```bash
pnpm --filter @appstore/api prune              # report orphans
pnpm --filter @appstore/api prune -- --delete  # reclaim them
```

Orphans are found by difference against `artifacts`, never by age, so there is
no race with a fresh upload.

Everything else that grows is a regenerable cache:

| Path | Rebuilt by |
|---|---|
| `~/Library/Developer/Xcode/DerivedData` | next iOS build |
| `apps/mobile/android/app/build`, `.gradle` | next Android build |
| `apps/mobile/ios/Pods` | `pod install` |
| `node_modules` | `pnpm install` |

`ingest-binaries.ts` copies with `cp -c`, so on APFS the store shares blocks
with the source folder — a 468 MB clone costs about 1 MB of real disk. `du` and
Finder still report full size. Deleting the originals does **not** reclaim that
space; the clone keeps the blocks alive.

---

## Gotchas that cost real time

- **An arm64-only emulator cannot run 32-bit-only APKs.** `armeabi-v7a`-only
  builds fail with "app isn't compatible with your phone" — correctly. Check
  with `aapt2 dump badging <apk> | grep native-code`.
- **iOS install cannot be tested on a simulator, ever.** Simulators run
  simulator-architecture bundles; an IPA holds device ARM binaries. Real iOS
  install needs an `itms-services://` manifest over **HTTPS**, an IPA signed
  ad-hoc or enterprise, and a physical device.
- **App Store IPAs are FairPlay-encrypted** and will not install anywhere,
  however they are signed.
- **A stale Metro on 8081** silently serves the old bundle while a new instance
  fails to bind. `lsof -nP -iTCP:8081 -sTCP:LISTEN`, then kill it.
- **Access tokens last 15 minutes.** The client refreshes automatically; if you
  are calling the API by hand, re-login rather than debugging a "no access" error.
