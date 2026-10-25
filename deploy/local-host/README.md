# Running the backend on this Mac

The API runs on this machine. Supabase holds the data, Cloudflare R2 holds the
files, Vercel serves the console. Nothing here is reachable from the internet
until you run `tunnel.sh` yourself.

```
phone / browser ──https──▶ Vercel (console)  ──rewrite /v1/*──▶ tunnel ──▶ this Mac :3000
                                                                              │
                                                  Supabase Postgres ◀────────┤
                                                  Cloudflare R2     ◀────────┘
```

All commands run from the repo root. Every script is non-interactive and safe to
run twice, so an agent can drive them.

## One-time setup

| What | Where | State |
|---|---|---|
| Credentials (Supabase password, R2 keys) | `deploy/env.production.local` | filled in, git-ignored |
| Database schema | Supabase project `cschfyufthmknuyffczn` | migrated, RLS verified |
| R2 bucket | `maya-artifacts` | created, keys tested |
| Console | https://maya-console-uhnwi.vercel.app | deployed from `main` |
| `cloudflared` | `brew install cloudflared` | installed |

`deploy/local-host/make-env.sh` turns `env.production.local` into
`deploy/backend.env.local`, which is what the API actually reads. `start.sh`
calls it for you. It generates `JWT_SECRET` once and **keeps it**: a new secret
signs everyone out.

## Run it

```bash
deploy/local-host/start.sh --build     # build, start in background, wait for /health
deploy/local-host/status.sh            # exit 0 = API answers, 1 = it does not
deploy/local-host/stop.sh              # stops the API and the tunnel
```

| Script | Does | Exit codes |
|---|---|---|
| `start.sh` | Starts the API on `:3000`. `--build` rebuilds first. `--local` forces http and a non-secure cookie, for testing on this Mac only. | 0 running, 1 failed, 2 bad flag |
| `status.sh` | Prints API pid, tunnel pid and URL, `/health` | 0 healthy, 1 not |
| `stop.sh [api\|tunnel]` | Stops the API and the tunnel, or only one of them | 0 ok, 2 bad arg |
| `tunnel.sh` | **Exposes the API to the internet** through a Cloudflare quick tunnel and prints the URL | 0 URL printed, 1 failed |
| `point-vercel.sh <url>` | Points `apps/console/vercel.json` and `PUBLIC_BASE_URL` at that URL. Commits and restarts nothing. | 0 ok, 2 bad URL |

Logs: `~/Library/Logs/maya/api.log` and `tunnel.log`. Pid files: `deploy/.run/`.

## Going public (the part that needs a human decision)

Opening a tunnel exposes this Mac's API to anyone with the link. An agent should
not do this on its own; the person who owns the machine says yes first.

```bash
deploy/local-host/start.sh --build
deploy/local-host/tunnel.sh                                   # prints https://<random>.trycloudflare.com
deploy/local-host/point-vercel.sh https://<random>.trycloudflare.com
deploy/local-host/stop.sh api && deploy/local-host/start.sh   # API re-reads PUBLIC_BASE_URL; tunnel untouched
git add apps/console/vercel.json && git commit -m "chore: point console at the current tunnel" && git push origin main
```

Pushing to `main` redeploys the console on Vercel by itself.

**The quick-tunnel URL changes every time the tunnel starts**, so each time you
stop the tunnel, repeat from `tunnel.sh` down. `stop.sh api` exists so that
restarting the API does not also change the URL. For a fixed URL use a named
tunnel on a domain you own (needs `cloudflared tunnel login` in a browser) or
move to the VPS.

## Check it works end to end

```bash
curl -s https://maya-console-uhnwi.vercel.app/health      # {"status":"ok"} once tunnelled
```

Then open the console and sign up. **Signup creates the first org and its
owner, so do it yourself and keep that password to yourself.**

## Limits of this setup

- The Mac must be on and awake. Closing the lid or losing Wi-Fi takes the store
  down. `caffeinate -dimsu &` keeps it awake while you test.
- Nothing restarts automatically after a reboot. Run `start.sh` again.
- Do not run `make-env.sh --force` or delete `backend.env.local` without
  copying `JWT_SECRET` first, unless signing everyone out is what you want.

## When the VPS arrives

The API needs no change. Copy `deploy/backend.env.local` to the server, run the
API under Docker or systemd behind Caddy (`deploy/Caddyfile`), set
`PUBLIC_BASE_URL` to its https address, and point `vercel.json` at it. This
folder, the tunnel and `point-vercel.sh` are then no longer needed.

## Secrets hygiene

`deploy/*.local` and `deploy/.run/` are git-ignored. Never commit
`backend.env.local`: it holds the database password and R2 secret in clear. The
Supabase `sbp_` management token pasted into an earlier chat is **not** needed
to run anything and should be revoked in the Supabase dashboard.
