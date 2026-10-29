# Deploying MAYA

One production setup:

| Piece | Runs on | Config |
|---|---|---|
| API | Tencent server, Docker Compose + Caddy (`maya-api.muchtar.dev`) | `docker-compose.yml`, `deploy/Dockerfile`, `deploy/Caddyfile` |
| Console | Vercel (`maya-store.muchtar.dev`) | `apps/console/vercel.json` |
| Database | Supabase Postgres 17 | `apps/api/database/bootstrap-supabase.sql` + `apps/api/drizzle/` |
| Builds, icons, MAYA app | Cloudflare R2 | `BLOB_STORE=s3` |
| Mobile app | EAS Build | `apps/mobile/eas.json` |

```
phone ──https──▶ maya-api.muchtar.dev (Caddy ─▶ api container) ──▶ Supabase, R2
browser ─https─▶ Vercel (console) ──rewrite /v1/*──▶ maya-api.muchtar.dev
```

## 1. Database (from your Mac, once per Supabase project)

Use the Supabase **direct** connection (port 5432), never the pooler (6543),
for setup and migrations. Put it in the root `.env` as
`MIGRATION_DATABASE_URL`, then:

```bash
psql "$MIGRATION_DATABASE_URL" -f apps/api/database/bootstrap-supabase.sql
pnpm db:migrate
psql "$MIGRATION_DATABASE_URL" -f apps/api/database/bootstrap-supabase.sql   # again: the audit-log REVOKE needs its table
```

A release that adds a migration: run `pnpm db:migrate` first, then deploy the API.

## 2. API on the Tencent server

First time:

1. DNS: `dig +short maya-api.muchtar.dev` returns the server's IP, and the
   Cloudflare record is grey-cloud (DNS only) so Let's Encrypt can reach Caddy.
2. Firewall / security group: allow inbound TCP 80 and 443.
3. Env file at the repo root, using the PRODUCTION notes in `.env.example`:
   ```bash
   cp .env.example .env
   nano .env            # production values: Supabase pooler URL, R2, JWT_SECRET, TRUST_PROXY=1 ...
   chmod 600 .env
   ```
4. Build and start:
   ```bash
   docker compose build
   docker compose up -d
   ```
5. Check:
   ```bash
   docker compose ps
   docker compose logs api       # boot errors name each invalid variable
   docker compose logs caddy     # look for "certificate obtained successfully"
   curl -sS -i https://maya-api.muchtar.dev/health
   ```

Don't run `docker compose config` unfiltered: it prints the resolved secrets.

Update:

```bash
git pull
docker compose build
docker compose up -d                          # recreates only what changed
docker compose up -d --force-recreate api     # after editing .env
```

Logs: `docker compose logs -f --tail=100 api`.

Rollback: `git checkout <good-commit> && docker compose build && docker compose up -d`.
Rolling back code does not roll back the database.

Disk: `docker image prune` and `docker builder prune` are safe. Avoid
`docker volume prune` and `docker compose down -v`: they delete `caddy_data`,
which holds the certificate, and Let's Encrypt rate-limits re-issuing it.

### Why these settings

- `TRUST_PROXY=1`: Caddy sits in front. Without it every caller shares one
  rate-limit bucket, and iOS install manifests get `http://` URLs that iOS refuses.
- `COOKIE_SECURE=true`: the refresh cookie only travels over HTTPS.
- `BLOB_STORE=s3`: builds live in R2, so rebuilding the container never loses them.

## 3. Console on Vercel

- Project root directory: `apps/console` (`vercel.json` installs and builds from the repo root).
- Environment variable: `VITE_API_BASE_URL=/`.

`vercel.json` rewrites `/v1/*`, `/download/*` and `/health` to
`maya-api.muchtar.dev`, so the browser sees one site. That is required: the
refresh cookie is `SameSite=Strict`, and calling the API on another site
directly would sign everyone out on their first refresh.

On the API, `CORS_ORIGINS` and `PORTAL_URL` are the console's origin.

## 4. Mobile app

Build with EAS (see the [mobile README](../apps/mobile/README.md#eas-builds)), then
put the APK on the download page:

```bash
pnpm --filter @appstore/api publish:client <apk-path-or-url>
```

Run it with the production R2 values in your shell or `.env`
(`BLOB_STORE=s3`, `S3_*`).
