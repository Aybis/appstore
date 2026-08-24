# Backlog

Raised 2026-08-24. What is here is deliberately *not* built yet, with the
reason — a backlog whose entries do not say why they are waiting turns into a
list nobody trusts.

---

## Ratings — explicitly parked

Requested as "put as a backlog feature even useful or not".

`apps` already carries `rating` and `rating_count` as denormalised aggregates,
and they stay `0` because **there is no source of truth**. A reviews table
without moderation is a liability in an internal store rather than an asset:
the reviewer is identifiable to their own colleagues, which changes what people
are willing to write and makes a one-star review a workplace event.

If it is built, the honest minimum is: one rating per person per app, editable,
tied to a *version* so a fixed bug does not carry its old score forever, and an
explicit decision about whether publishers can see who left what.

---

## Dashboard — blocked on data that is not collected

Asked for: registered users, logins, installs per app, versions installed,
publisher update counts, good/bad ratings.

Of those, **three are countable today** — members, releases per app per period,
and testers. The rest are not, and the difference matters:

| Wanted | Status |
|---|---|
| Users registered | `memberships` — countable |
| Publisher updates | `releases` + `audit_events` — countable |
| Apps with testers | `app_testers` — countable |
| Logins | Only `sessions` rows exist. A session is not a login: refresh rotates it, so counting rows over-reports badly |
| Installs per app | **Not tracked.** `audit_events` records that a download ticket was *issued*, not that an install succeeded — that happens on the device after the bytes leave |
| Versions installed by users | **Not tracked.** The app knows locally; the server has nowhere to put it |
| Ratings | No source of truth — see above |

A dashboard built now would show three real numbers and four invented ones.
The blocker is `devices` + `install_events` from the ERD, plus the app
reporting an install result. That is the piece to build first; the dashboard
is the easy half.

---

## Package id collision check against public stores

Asked: when platform is both, check Apple and Google so no two apps share a
package id.

Locally this is already enforced — migration 0013 adds
`UNIQUE (org_id, platform, package_id)`.

Against the public stores it is uneven, and worth saying plainly:

- **Apple** publishes a lookup endpoint (`itunes.apple.com/lookup?bundleId=`),
  so an iOS bundle id can be checked properly.
- **Google Play has no equivalent public API.** The only ways are scraping a
  store page or the Play Developer API, which only covers apps *you already
  own*. Scraping breaks silently and is against their terms.

So the check would be reliable for iOS and unreliable for Android, which is
worse than no check if it is presented as one. Recommendation: run the Apple
lookup as an **advisory warning at app-creation time** — "an App Store app
already uses this id, is that intended?" — and never block on it. An internal
store legitimately hosts builds whose id matches a public app.

---

## Both-platform uploads

When an app is `both`, the upload form should accept an IPA *and* an APK.

The API already supports this — releases carry a `platform`, and two releases
of the same version on different platforms do not collide. What is missing is
purely the console form, which sends one file. Straightforward; not done yet.

---

## Icon compression and cropping

Uploads are validated by magic bytes and capped at 1 MB, but they are stored
exactly as supplied. Wanted: client-side crop to a square, resize, and
compress.

Target sizes worth encoding when this is built: **512×512** is the figure both
platforms converge on (Play's listing icon, and the largest iOS App Store
asset), so one 512 PNG serves both and scales down cleanly. Anything larger is
wasted bytes on a phone.

---

## Invitations with email verification

Wanted: invite somebody who is not yet a member; they verify by email.

`invitations` is designed in the ERD and not built. The real blocker is not the
table — it is that **there is no mail transport configured at all**. Adding one
means an SMTP or API provider, a sending domain with SPF/DKIM, bounce handling,
and a token whose expiry and single-use are enforced in the database rather
than in a service. It is a genuine piece of work, not a form.

Until then, `POST /v1/members` grants a role to somebody who already has an
account, and the person signs up themselves first.

---

## Role-aware navigation on mobile

The console hides what a role cannot reach. The app does not have an equivalent
because it has no privileged screens yet — every tab is catalog, installs or
profile. When publishing moves onto the phone, this becomes real.

---

## Beta testing on the mobile side

Raised as "beta testing on mobile side dont have adjustment?" — correct, and
deliberate so far. The app *consumes* track visibility: an enrolled tester sees
beta builds because the API decides that per request, and nothing in the app
chooses it.

What is genuinely missing on the device is **visibility**: a tester cannot see
that a build they are looking at is a beta rather than a release, and cannot
leave a testing programme they did not ask to join. Both are small, and both
are about honesty rather than control.
