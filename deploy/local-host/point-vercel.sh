#!/usr/bin/env bash
# Points the console and the API at a public URL.
#
#   deploy/local-host/point-vercel.sh https://something.trycloudflare.com
#
# Edits apps/console/vercel.json (the three rewrite destinations) and
# PUBLIC_BASE_URL in deploy/backend.env.local, then tells you what to commit.
# It does NOT commit, push or restart anything.
. "$(dirname "$0")/_common.sh"

URL="${1:-}"; URL="${URL%/}"
[[ "$URL" =~ ^https://[A-Za-z0-9.-]+$ ]] || { echo "usage: point-vercel.sh https://host"; exit 2; }

python3 - "$ROOT/apps/console/vercel.json" "$URL" <<'PY'
import json, sys
path, url = sys.argv[1], sys.argv[2]
cfg = json.load(open(path))
for r in cfg["rewrites"]:
    if r["destination"].startswith("http"):
        r["destination"] = url + "/" + r["destination"].split("/", 3)[3]
json.dump(cfg, open(path, "w"), indent=2); open(path, "a").write("\n")
PY
sed -i '' "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=$URL|" "$ENV_FILE"
echo "vercel.json and PUBLIC_BASE_URL now point at $URL"
echo "next: restart ONLY the API (stop.sh api && start.sh), then commit vercel.json and push to main"
