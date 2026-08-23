# Security review — before the portal & CMS ship

Scope: the existing NestJS API as it stands on 2026-08-23, read against what a
**browser-facing** portal and an APK-upload CMS will add. Browser clients change
the threat model — a token in a browser is far easier to steal than one in a
device keychain, and a CMS invites untrusted binaries in on purpose.

Every finding below was **reproduced against the running API**, not inferred from
reading code. Each one names the command that demonstrates it.

---

## What is already right

Worth stating plainly, because these are the expensive things to retrofit and
they are already done:

| Control | Where |
|---|---|
| Tenant isolation in the **database**, not the service layer | RLS `ENABLE`+`FORCE`+policy on every `org_id` table |
| Runtime role cannot bypass RLS | `app_runtime` has no `BYPASSRLS`; `withTenant()` is the only path |
| Catalog-driven invariant test | `rls-invariants.spec.ts` — a new tenant table is covered automatically |
| Passwords hashed with argon2id | `PasswordService` |
| JWT algorithm pinned on **sign and verify** | `TokenService`, blocks algorithm confusion |
| Access/refresh token confusion blocked | `typ` claim checked on both paths |
| Authority re-read per request | `RolesGuard` queries `memberships`, never trusts the token's `role` |
| Deny-by-default routing | global guards; `@Public()` is the explicit, auditable opt-out |
| Published releases immutable | database trigger, migration 0006 |
| Artifacts never deduped across orgs | `UNIQUE (org_id, sha256)` |
| Audit log append-only by **privilege** | `REVOKE UPDATE, DELETE`, migration 0007 |
| Download URLs are signed capabilities | HMAC + 15-min expiry, bound to one org |
| Digest computed server-side from bytes | client-supplied `sha256` is ignored |
| Storage key derived from digest, path re-checked | no traversal via filename |

---

## Findings

### S-1 · HIGH · A removed member can renew credentials for 30 days

`POST /v1/auth/refresh` is `@Public()` and stateless: it verifies the refresh
JWT's signature and `typ`, then mints a fresh pair. It never checks that the
subject still belongs to the org.

**Reproduced.** Sign up, delete the `memberships` row, then:

```
1. GET /v1/apps with access token, before removal   → 200
2. DELETE FROM memberships …                        (offboard the user)
3. GET /v1/apps with the SAME access token          → 403   ✅ correctly denied
4. POST /v1/auth/refresh with their refresh token   → 200 + a brand new token pair
```

Step 4 keeps working for the full 30-day refresh TTL.

**Why it is not (yet) a breach:** every data path goes through `RolesGuard`,
which re-reads `memberships` and denies. The renewed tokens open no doors today.

**Why it must still be fixed before the portal:**
- an offboarded employee holds a live, self-renewing credential for a month;
- **"sign out" cannot invalidate anything** — there is nothing to invalidate;
- a stolen refresh token can never be cut off, on any device;
- the first endpoint that trusts JWT claims without re-reading membership turns
  this into a real breach, and that is an easy mistake for a future author to
  make precisely because the claims look authoritative.

**Fix:** the `sessions` table in [`erd.md`](erd.md). Store SHA-256 of the refresh
token; refresh = look up → reject if missing/expired/revoked → **rotate** →
issue. `rotated_from` gives reuse detection: a token presented after rotation
means replay, so revoke the whole chain. Revoke all sessions when a membership
is deleted or a password changes.

---

### S-2 · HIGH · Any bytes can be published as an Android package

`PublishController` validates the **filename extension only**
(`ALLOWED_EXTENSIONS = {.apk, .ipa}`). Content is never inspected.

**Reproduced.** Both of these were accepted and reached `status: published`:

```
printf '\x7fELF\x02\x01…'            > evil.apk   → 201 Created, published
printf '<html><script>…</script>'    > evil2.apk  → 201 Created, published
```

The stored `content_type` is then set from that same extension map, so an HTML
file is served as `application/vnd.android.package-archive`.

**Impact.** A publisher — or a stolen publisher session, or (once they exist) a
CI API key — can put arbitrary content into the catalog under a name devices
trust. Android refuses to install it, so this is not remote code execution; it is
an **integrity failure in a distribution system**, which is the one property a
store exists to provide. It also wastes the 2 GiB upload budget on arbitrary
uploads.

**Fix, in order of value:**
1. **Magic-byte check.** APK and IPA are both ZIP: first bytes must be
   `50 4B 03 04`. Reject otherwise. Cheap, catches every case above.
2. **Structural check.** APK must contain `AndroidManifest.xml`; IPA must contain
   `Payload/*.app/Info.plist`. The IPA path already parses the bundle id at
   ingest, so half of this exists.
3. Keep `content_type` derived from the **verified** type, not the filename.
4. Malware scanning stays deferred (war-room decision), but it should be deferred
   *knowingly* — record it as accepted risk, not as an oversight.

---

### S-3 · MEDIUM · Unlimited credential-stuffing against `/v1/auth/login`

No rate limiting anywhere in the app. `@nestjs/throttler` is not installed.

**Reproduced.** Eight consecutive failed logins with a well-formed payload
returned `401 401 401 401 401 401 401 401` — never a `429`.

Today the attack surface is a device app. A public web portal turns this into a
trivially scriptable target, and argon2id's cost makes each attempt *expensive
for the server* — so this is a denial-of-service vector as much as an account
one.

**Fix:** `@nestjs/throttler`, strictest on `/auth/*` (login, signup, refresh,
password reset). Key by IP **and** by `(orgSlug, email)` so one attacker cannot
lock out an entire org by hammering one address, and add a short lockout with
backoff after repeated failures. Login already returns an identical error for
"no such user" and "wrong password", which is correct and must stay.

---

### S-4 · MEDIUM · No CORS or security headers — decide before, not after

`main.ts` sets only the global prefix. No `enableCors`, no `helmet`.

Right now that **fails closed**: no CORS headers means a browser on another
origin cannot read responses at all. That is the correct default, but it means
the portal cannot work until CORS is configured — and the tempting fix under
deadline pressure is `enableCors()` with no arguments, which reflects any origin.

**Fix, before the portal's first request:**
- `enableCors({ origin: <explicit allowlist from env>, credentials: true })` —
  never a bare `enableCors()`, never `origin: true`.
- `helmet()` with a real CSP for the console: `default-src 'self'`, no
  `unsafe-inline`, no `unsafe-eval`.
- `Strict-Transport-Security` once TLS is in front (see S-6).

---

### S-5 · MEDIUM · Where the portal keeps its tokens — **CLOSED 2026-08-24**

Not a defect in existing code — a decision that must be made deliberately,
because the wrong choice is the default choice.

`localStorage` is readable by any XSS on the origin, and a CMS that renders
publisher-supplied app names, descriptions and release notes has real XSS
surface.

**Recommendation:** refresh token in an **httpOnly, Secure, SameSite=Lax**
cookie, scoped to the API origin; access token **in memory only**, never
persisted. With `SameSite=Lax` plus an explicit CORS allowlist, CSRF on the
JSON API is largely closed; add a double-submit CSRF token for any
cookie-authenticated state-changing route to close it fully. This pairs exactly
with S-1's `sessions` table — a cookie you cannot revoke is not much better than
`localStorage`.

**Shipped**, with two departures from the recommendation, both deliberate:

- **`SameSite=Strict`, not `Lax`.** A refresh endpoint is exactly what a
  cross-site request would target. With rotation live an attacker who makes the
  browser refresh does not learn the token — CORS stops them reading the reply
  — but they *do* rotate it, so the real tab's next refresh looks like a replay
  and the whole chain is revoked. Lax permits top-level cross-site POSTs to
  carry the cookie; Strict does not. Strict also removes the need for the
  double-submit token this review asked for.
- **The token is stripped from the response body in cookie mode.** Not in the
  recommendation, and without it the whole change is theatre: an XSS would call
  `/auth/refresh`, the cookie would ride along automatically, and the token
  would be read straight out of the reply. httpOnly protects the cookie jar,
  not the response.

Mode is chosen by the client (`X-Auth-Mode: cookie`) rather than inferred, so
the mobile app and every CI script keep the body-token behaviour unchanged.
The cookie is `Path`-scoped to `/v1/auth`. `COOKIE_SECURE` follows `NODE_ENV`
and must not be forced on before TLS — a `Secure` cookie is discarded over
plain HTTP, which signs everybody out rather than hardening anything.

---

### S-6 · MEDIUM · `PUBLIC_BASE_URL` / no TLS termination yet — **CODE READY 2026-08-24, DEPLOYMENT OUTSTANDING**

Carried forward from the progress log, and it becomes load-bearing here. The
signed download URL and the `itms-services` manifest both need HTTPS — iOS
**requires** it for install. A portal serving session cookies over plaintext is
worse still: `Secure` cookies simply will not be sent.

**Fix:** terminate TLS in front (Caddy/Traefik), set `PUBLIC_BASE_URL`, mark
cookies `Secure`, add HSTS.

**What shipped.** Everything in the codebase that TLS touches, verified against
a real certificate rather than reasoned about:

- The API can serve TLS directly (`TLS_CERT`/`TLS_KEY`) for a LAN deployment
  with no public DNS to answer an ACME challenge, or sit behind a proxy.
  `deploy/Caddyfile` and `deploy/README.md` cover the proxy shape.
- **`TRUST_PROXY`**, defaulting to off. This was a latent defect, not a new
  feature: `AuthThrottlerGuard` keys on `req.ips[0] ?? req.ip`, and Express
  fills neither correctly unless told to trust forwarding headers. The moment
  TLS is terminated at a proxy — which is what this finding asks for — every
  caller would have collapsed into one rate-limit bucket, and `req.protocol`
  would have written `http://` into the iOS manifest. Off is the right default:
  trusting `X-Forwarded-For` when nothing sets it lets any caller spoof an
  address and evade the limit.
- Startup warnings when running production without TLS, without
  `COOKIE_SECURE`, or without `TRUST_PROXY`, so this cannot sit silent.

Verified over a locally-trusted certificate: `Set-Cookie` carried
`HttpOnly; SameSite=Strict; Secure`, refresh over TLS with only the cookie
returned 200, and the `itms-services` ticket embedded an **https** manifest URL
— the specific thing iOS refuses when it is http.

**Still outstanding, and it is a deployment decision rather than code:** a
certificate the *phones* trust. `mkcert` covers laptops; a phone needs the root
CA pushed by MDM, or a publicly trusted certificate via a real hostname or a
tunnel. Until that exists, `apps/mobile/app.json` keeps its
`usesCleartextTraffic` exemption — removing it while the API is still `http://`
would stop release builds reaching the API at all, which is the exact failure
that put it there. `deploy/README.md` has the removal steps.

---

### S-7 · LOW · Upload spool is unbounded and unswept

`FileInterceptor({ dest: UPLOAD_TMP })` spools to disk before the store write.
The 2 GiB per-file cap is enforced, but there is no cap on **concurrent** uploads
and no cleanup of the temp file when the request fails after the write.

**Fix:** delete the temp file in a `finally`, cap concurrent uploads per org, and
count in-flight bytes against the org's storage quota once Plan 04 lands.

---

### S-8 · LOW · API keys must never be able to escalate

Anticipatory — the table does not exist yet. When `api_keys` ships, `role` must
be capped at `publisher` **by a CHECK constraint**, not by convention. A CI token
that can mint admins is a privilege-escalation primitive, and CI tokens leak
(logs, forks, screen shares) far more often than passwords do.

---

## Order of work

1. **S-1** `sessions` + rotation + reuse detection + revoke-on-offboard.
   Blocks a working "sign out", so the portal needs it first anyway.
2. **S-2** magic-byte + structural validation. Small, and it is the CMS's
   entire reason to exist.
3. **S-3** throttler on `/auth/*`.
4. **S-4** CORS allowlist + helmet + CSP, wired the same day the portal calls the API.
5. ~~**S-5** cookie/session decision, implemented alongside S-1.~~ **Done.**
6. **S-6** TLS before anything leaves localhost. **Code done; a certificate the
   phones trust is the remaining step.**
7. **S-7**, **S-8** with the features they belong to.

Nothing here blocks *designing* the portal. S-1 through S-4 block *shipping* it.
