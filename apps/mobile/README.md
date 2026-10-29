# MAYA Mobile

The MAYA app for Android and iOS: browse the organization's catalog, install
apps, get told about updates. Built with Expo SDK 57, React Native and
expo-router.

## Run locally

Prerequisites on macOS:

| Tool | For |
|---|---|
| JDK 17 (`brew install openjdk@17`) | Android builds |
| Android Studio + an arm64 emulator | Android |
| Xcode (the full app) | iOS |

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home   # put in ~/.zshrc
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

The app needs a native build: Expo Go can't run it, because of the install
permission and the local `modules/installed-apps` module.

```bash
pnpm install                                  # from the repo root

cd apps/mobile
pnpm android                                  # build + run on the emulator / phone
pnpm ios                                      # build + run on the simulator
pnpm start                                    # Metro only, when a build is installed
```

From the repo root, `pnpm dev:mobile` is the same as `pnpm start`.

### Which API does it call?

Set it in the root `.env`, then rebuild (these values are read at build time):

```bash
MAYA_API_URL=http://192.168.1.42:3000   # your LAN IP, NOT localhost
MAYA_USE_MOCK_DATA=false                # true = demo data, no API at all
```

Left empty, the app uses the hosted API from `app.json`
(`https://maya-api.muchtar.dev`). Find your LAN IP with:

```bash
ipconfig getifaddr "$(route -n get default | awk '/interface:/{print $2}')"
```

`localhost` doesn't work: on the Android emulator it means the emulator itself.

After changing `app.json` or the env, run `npx expo prebuild --clean` before
the next `pnpm android` / `pnpm ios`, or the native project keeps the old values.

Sign in with `demo@maya.app` / `demo1234` (from `pnpm db:seed`).

## Structure (atomic design)

```
apps/mobile/
├── app/                    expo-router screens — the "pages" layer
│   ├── _layout.tsx         providers, auth gate, MAYA self-update gate
│   ├── onboarding.tsx
│   ├── (auth)/             login, register
│   ├── (tabs)/             Discover (index), My Apps, Profile
│   └── app/[slug].tsx      app detail + install
├── src/
│   ├── components/
│   │   ├── atoms/          Button, Input, Chip, Badge, Title, icons, ...
│   │   ├── molecules/      SearchBar, FormField, Notice, EmptyState, ...
│   │   ├── organisms/      AppCard, InstallBar, LoginForm, ...
│   │   ├── templates/      ListTemplate, AuthTemplate, AppDetailTemplate, ...
│   │   └── illustrations/  onboarding artwork
│   ├── hooks/              useApps, useAppDetail, useSearch, useInstalledApps
│   ├── motion/             FadeIn, PressableScale, haptics, reduced motion
│   ├── services/
│   │   ├── api/            AppStoreClient: http provider ⇄ mock provider
│   │   ├── auth/           AuthProvider: the only thing screens touch
│   │   ├── install/        download → system installer pipeline
│   │   ├── notifications/  local + push notifications
│   │   ├── storage/        AsyncStorage: session, install log, onboarding
│   │   ├── telemetry/      Sentry, Firebase (optional)
│   │   ├── update/         forces or offers MAYA's own updates
│   │   └── device/
│   ├── theme/              palettes, tokens (spacing, type), layout constants
│   ├── i18n/               strings
│   ├── utils/
│   └── types.ts
├── modules/installed-apps/ local native module: which apps are installed
├── plugins/                Expo config plugins
├── app.json                name, app id, icons, permissions
└── app.config.js           overlays the root .env onto app.json
```

What each layer may know:

| Layer | Knows about | Example |
|---|---|---|
| atoms | theme tokens only | `Button`, `Chip` |
| molecules | atoms + plain props (`string`, `number`), never `App` | `SearchBar`, `InfoTable` |
| organisms | app data (`App`, `Category`) | `AppCard`, `InstallBar` |
| templates | layout regions passed as `ReactNode`, no data fetching | `ListTemplate` |
| pages | hooks, state, routing: the files in `app/` | `app/(tabs)/index.tsx` |

Dependencies point one way: a page uses templates and organisms, an organism
uses molecules and atoms, an atom uses nothing. If a molecule needs an `App`,
it belongs in `organisms/`.

## App ID (package name)

The app id is `com.maya.store`, set in `app.json`:

```json
"ios":     { "bundleIdentifier": "com.maya.store" },
"android": { "package": "com.maya.store" }
```

Apps published through MAYA follow the same pattern and only the last part
changes: `com.maya.hrportal`, `com.maya.expenses`, ...

### Registering it

**Android:** nothing to register while MAYA hands out the APK itself. The
id only has to be unique on the phone. On Google Play, the first build you
upload claims the id. It must be free on Play, and you can never change it
later. EAS creates a signing keystore for the new id on the first build;
keep it, because every update must be signed with the same key.

**iOS:** you need a paid Apple Developer account. The id must be registered as
an App ID. Either:

- let EAS do it: `eas build -p ios --profile preview` signs in to your Apple
  account and registers `com.maya.store` plus a provisioning profile, or
- register it by hand: developer.apple.com → Certificates, IDs & Profiles →
  Identifiers → **+** → App IDs → App → Bundle ID *Explicit* `com.maya.store`.

Ad-hoc installs only work on registered devices: add each iPhone with
`eas device:create`, then rebuild.

Store ids are reverse domain names. Apple and Google only check that an id is
unique, not that you own the domain. If `com.maya.store` turns out to be taken
on Play, use a domain you own, such as `dev.muchtar.maya`.

### After changing the id (from `com.internal.appstore`)

To Android and iOS, a new id is a **new app**:

1. Phones with the old MAYA don't get this as an update. Install the new
   build once by hand and uninstall the old one.
2. EAS counts build numbers per app id. Set the new one above the build that's
   live now, or the API refuses it as "not newer":
   `eas build:version:set -p android`.
3. In the console, set the MAYA app's **Package ID** to `com.maya.store`
   before uploading its first build under the new id.

## EAS builds

```bash
npm install --global eas-cli
eas login
eas build -p android --profile preview    # APK MAYA can distribute
```

| Profile | Android output | Use |
|---|---|---|
| `development` | APK, dev client | loads JS from Metro |
| `preview` | APK, internal distribution | the build MAYA distributes (an AAB can't be installed directly) |
| `production` | AAB | Google Play only |

`appVersionSource: "remote"` keeps build numbers on EAS, so two builds of the
same commit never collide. Remote push needs `eas credentials` (FCM / APNs) and
a physical device.

## Things that will cost you an hour

- **iOS can't install an IPA on a simulator**, ever. It needs a real device,
  HTTPS and an ad-hoc or enterprise-signed IPA.
- **Android asks once per installer**: the first install sends you to
  Settings → "Install unknown apps" → allow MAYA.
- **An arm64 emulator can't run a 32-bit-only APK.** Check with
  `aapt2 dump badging <apk> | grep native-code`.
- **A stale Metro on port 8081** keeps serving the old bundle:
  `lsof -nP -iTCP:8081 -sTCP:LISTEN`, then kill it.
