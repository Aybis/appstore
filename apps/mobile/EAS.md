# EAS build profiles

EAS validates `eas.json` against a strict schema and rejects unknown keys, so
the reasoning that would normally live in a `"//"` comment lives here instead.

| Profile | Android output | Why |
|---|---|---|
| `development` | APK, dev client | Loads JS from Metro. Expo Go cannot carry `REQUEST_INSTALL_PACKAGES` or the local `installed-apps` module, so a dev client is the only way to run this app at all. |
| `preview` | **APK**, internal distribution | Deliberately not an AAB. This profile exists to produce a build **MAYA itself distributes**, and MAYA hands the file to Android's package installer — an AAB is a publishing format Play unpacks, and cannot be installed directly. |
| `production` | AAB | For a public store submission, which is the one case where Play does the unpacking. Not the path this product normally takes. |

`appVersionSource: "remote"` puts the build number on EAS rather than in the
repo, so two builds of the same commit never collide on `versionCode`.

## The native module

`modules/installed-apps` is a **local** Expo module, autolinked from
`modules/`. It needs no extra EAS configuration, but it does mean every build
is a native build: a JS-only update cannot ship a change to it.
