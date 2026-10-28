# Running the API on the Tencent server

Docker Compose runs two containers: `api` (NestJS, port 3000 on the internal
network only) and `caddy` (ports 80/443, automatic Let's Encrypt for
`maya-api.muchtar.dev`). The console is on Vercel; the database is Supabase;
files are in Cloudflare R2.

Run everything from the repo root.

## First deploy

1. DNS: `dig +short maya-api.muchtar.dev` must return this server's IP, and the
   Cloudflare record must be grey-cloud (DNS only) so Let's Encrypt reaches us.
2. Tencent firewall / security group: allow inbound TCP 80 and 443.
3. Database (from your Mac, never from here): run `bootstrap.sql` and the
   Drizzle migrations over the Supabase **direct** connection (5432), as in
   `deploy/README.md` section C.
4. Create the env file and lock it down:
   ```bash
   cp deploy/server.env.example .env
   nano .env            # fill every empty value
   chmod 600 .env
   ```
5. Build and start:
   ```bash
   docker compose build
   docker compose up -d
   ```
6. Check:
   ```bash
   docker compose ps
   docker compose logs api       # boot errors name each invalid variable
   docker compose logs caddy     # look for "certificate obtained successfully"
   curl -sS -i https://maya-api.muchtar.dev/health
   ```

Do not run `docker compose config` unfiltered: it prints resolved secrets.

## Update

```bash
git pull
docker compose build
docker compose up -d          # recreates only what changed
```

A release that adds a migration: migrate from your Mac first, then update here.

## Logs and status

```bash
docker compose ps
docker compose logs -f --tail=100 api
docker compose logs -f --tail=100 caddy
docker stats --no-stream
```

## Restart

```bash
docker compose restart api
docker compose up -d --force-recreate api   # after editing .env
```

## Rollback

```bash
git log --oneline -5
git checkout <good-commit>
docker compose build && docker compose up -d
```

Go back to `main` afterwards with `git checkout main`. Rolling back code does
not roll back the database.

## Disk cleanup

```bash
df -h /
docker system df
docker image prune          # dangling images only, asks first
docker builder prune        # build cache, asks first
```

Avoid `docker volume prune` and `docker compose down -v`: they delete
`caddy_data`, which holds the certificate, and Let's Encrypt rate-limits
re-issuing.
