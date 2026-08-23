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
