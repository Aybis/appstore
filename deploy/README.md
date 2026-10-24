# Deploying MAYA

Two shapes, and the right one depends on whether the store is reachable from
the internet.

## A. LAN-hosted (no public DNS)

The API serves TLS itself. Simpler than running a proxy, and the only option
when there is no public hostname for a certificate authority to validate.

```bash
# One certificate covering every address a device might dial.
mkcert -cert-file deploy/certs/api.pem -key-file deploy/certs/api-key.pem \
  localhost 127.0.0.1 ::1 192.168.1.16
```

```bash
TLS_CERT=deploy/certs/api.pem TLS_KEY=deploy/certs/api-key.pem \
COOKIE_SECURE=true PUBLIC_BASE_URL=https://192.168.1.16:3000 \
node apps/api/dist/main
```

**The catch, stated plainly:** a `mkcert` certificate is only trusted by
machines that have its root CA installed. Laptops can run `mkcert -install`;
phones cannot, so the CA has to be pushed by whatever manages the devices (MDM,
or a manual profile install). Without that, Android rejects the connection and
iOS refuses the install — which looks exactly like the app being broken.

If that is not workable, use shape B, or a tunnel (Cloudflare Tunnel,
Tailscale Funnel) which gives a publicly trusted certificate to a service that
has no public IP.

## B. Internet-reachable

Terminate TLS at Caddy, which obtains and renews certificates on its own. See
`Caddyfile`.

```bash
caddy run --config deploy/Caddyfile
```

Then, on the API:

```bash
TRUST_PROXY=1 COOKIE_SECURE=true PUBLIC_BASE_URL=https://api.example.com \
node apps/api/dist/main
```

`TRUST_PROXY` is not optional here. Express only fills `req.ips` and corrects
`req.protocol` when told to trust the forwarding headers, and until then two
things are quietly wrong:

- Every request appears to come from the proxy, so the per-IP rate limit
  becomes **one global budget** and a single noisy client locks out everybody.
- `req.protocol` reads `http`, so the iOS install manifest is written with an
  `http://` URL that iOS refuses.

It defaults to off because the opposite failure is worse: trusting
`X-Forwarded-For` when nothing sets it lets any caller spoof an address, evade
the rate limit and poison the audit trail.

## After TLS is live

Three things were waiting on it:

1. **The refresh cookie can carry `Secure`.** Set `COOKIE_SECURE=true`. A
   `Secure` cookie is discarded over plain HTTP, so this must not be set
   before TLS or everyone is signed out.

2. **iOS installs start working.** `itms-services` requires the manifest and
   the IPA it names to be HTTPS. Nothing else to change — the URL is built
   from the request scheme.

3. **The Android cleartext exemption can go.** In `apps/mobile/app.json`,
   delete the `expo-build-properties` entry carrying
   `usesCleartextTraffic: true`, and the `//cleartext` note beside it. Then
   rebuild — it is a native manifest change, so an OTA update will not carry
   it.

   Do this only once the API the app points at is actually `https://`. Removing
   it while the API is still `http://` makes release builds unable to reach it
   at all, which is precisely the failure that put the exemption there.

## CORS and cookies are same-site

The refresh cookie is `SameSite=Strict`, so the console and the API must share
a registrable domain. Ports do not count, so `localhost:5173` and
`localhost:3000` are fine, as are `maya.example.com` and `api.example.com`.
An API on a genuinely different domain would need `SameSite=None`, which
requires `Secure` and reopens the cross-site request surface that Strict closes.

Set `CORS_ORIGINS` to the console's origin. There is no wildcard and no
default: with nothing set, no browser client is permitted at all.

## C. Hosted: Vercel + Render + Supabase + R2

| Piece | Where | Config |
|---|---|---|
| Console (`apps/console`) | Vercel, root directory `apps/console` | `apps/console/vercel.json` |
| API (`apps/api`) | Render web service | `render.yaml` |
| Database | Supabase Postgres 17 | `infra/supabase/bootstrap.sql` + Drizzle migrations |
| Builds, icons, MAYA client | Cloudflare R2 | `BLOB_STORE=s3` |

**The console calls the API through Vercel, not directly.** `vercel.json`
rewrites `/v1/*`, `/download/*` and `/health` to Render, and the console is
built with `VITE_API_BASE_URL=/`. This is required, not tidy: the refresh cookie
is `SameSite=Strict`, and `*.vercel.app` and `*.onrender.com` are different
sites, so a console calling Render directly signs everybody out on their first
token refresh. Phones call Render directly — no cookie involved.

**Storage must be R2.** Render replaces the disk on every deploy. With
`BLOB_STORE=fs` every uploaded build would disappear at the next push while the
database kept pointing at it. The API warns at boot if it runs in production
on `fs`.

### First deploy

1. Supabase, once per project, over the **direct** connection (5432):

   ```bash
   psql "$DIRECT_URL" -f infra/supabase/bootstrap.sql
   cd apps/api && DATABASE_URL="$DIRECT_URL" npx drizzle-kit migrate
   psql "$DIRECT_URL" -f infra/supabase/bootstrap.sql   # again: the audit-log REVOKE needs its table
   ```

2. Render: apply `render.yaml` as a Blueprint, then fill the `sync: false`
   variables. `DATABASE_URL` is the **pooler** URL (6543), not the direct one.
3. Vercel: project root `apps/console`, env `VITE_API_BASE_URL=/`. If the
   Render service name differs from `maya-api`, fix the three rewrite
   destinations in `vercel.json`.
4. Put the Vercel origin in Render's `CORS_ORIGINS`, and the Render origin in
   `PUBLIC_BASE_URL`.

### Releases

Migrations are not run on deploy (see the note in `render.yaml`). A release
that adds one: migrate first, then deploy — the schema change has to be
backward compatible with the API still running.

The MAYA client build is published to R2 from a workstation:

```bash
BLOB_STORE=s3 S3_ENDPOINT=… S3_BUCKET=… S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… \
  pnpm --filter @appstore/api publish:client <apk-path-or-url>
```
