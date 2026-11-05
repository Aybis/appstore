# @maya/update-sdk

In-app updates for apps distributed through MAYA, in the spirit of Google
Play's in-app updates: the app checks on launch, and either blocks until it is
updated (**immediate**) or offers it with a "Later" (**flexible**).

For Expo / React Native apps. Lives in this repo, outside the pnpm workspace,
so it does not touch the MAYA app's lockfile.

## The rule

MAYA decides, not the SDK. For a version `X.Y.Z`:

| Change | Flow | Can be postponed |
|---|---|---|
| `X` or `Y` | `immediate` | no |
| `Z` only | `flexible` | yes |
| below the app's minimum version (set in the console) | `immediate` | no |

## Two ways to update

| Mode | What happens | Needs |
|---|---|---|
| `maya` (default) | Opens the app's page in MAYA (`maya://app/<slug>`). MAYA installs with the person's own sign-in. | MAYA on the phone. Pass `mayaLandingUrl` to send people without it to the landing page. |
| `in-place` | Android: downloads the APK and opens the system installer. iOS: opens the signed itms-services link and iOS installs it. | An admin turned on **In-app updates** on the app's page in the console. Android: `REQUEST_INSTALL_PACKAGES`, `expo-file-system`, `expo-intent-launcher`. |
| `auto` | In place when allowed, else MAYA; falls back to MAYA if in place fails. | |

In place hands out a signed download link valid for 15 minutes to anyone who
knows the org and package id. Leave it off for apps whose binary is itself
sensitive.

## Install

Copy `sdk/maya-update` into the app, or depend on it from git, then:

```tsx
import Constants from 'expo-constants';
import { useMayaUpdate } from '@maya/update-sdk';
import analytics from '@react-native-firebase/analytics';

export const UpdatePrompt = () => {
  const update = useMayaUpdate({
    apiBaseUrl: 'https://maya-api.example.com',
    org: 'maya',
    packageId: 'com.maya.hrportal',
    currentVersion: Constants.expoConfig?.version ?? '0.0.0',
    mode: 'auto',
    mayaLandingUrl: 'https://maya.example.com',
    // Into the app's own Firebase, so updates show up next to everything else.
    onEvent: (event) => void analytics().logEvent(event.type, { ...event }),
  });

  if (!update.visible || !update.update) return null;
  const required = update.update.flow === 'immediate';
  // Draw it in the app's own design. For `immediate`: no close button, no
  // scrim tap, and swallow Android's back button (BackHandler) while shown.
  return (
    <MyModal
      title={required ? 'Update required' : 'Update available'}
      version={update.update.latestVersion}
      notes={update.update.releaseNotes}
      progress={update.progress?.fraction ?? null}
      onUpdate={update.start}
      onLater={required ? undefined : update.dismiss}
    />
  );
};
```

Lower level, without React: `checkForUpdate(options)` and
`startUpdate(info, options)`.

## Behaviour worth knowing

- **A failed check returns `null`.** A forced update that fires because the
  network was down would lock people out of an app that works.
- **It checks again on returning to the foreground**, so someone who updated
  in MAYA is let back in instead of meeting a stale prompt.
- **`installKey`** is optional: a random id the app keeps for itself, so the
  console counts installs per day, not launches. Never a hardware id.
- **The APK is not re-hashed on the phone.** It is named after the server's
  sha256 and its size is checked; Android itself refuses an update signed with
  a different key than the installed app.

```bash
pnpm install            # at the repo root, once
cd sdk/maya-update
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/vitest run
```
