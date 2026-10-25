#!/usr/bin/env bash
# Makes this Mac's API reachable from the internet. RUN THIS ONLY WHEN YOU MEAN TO.
#
#   deploy/local-host/tunnel.sh        quick tunnel: random https://*.trycloudflare.com URL,
#                                      different every time it starts
#   deploy/local-host/tunnel.sh stop   (or just run stop.sh)
#
# Prints the URL. Then run:  deploy/local-host/point-vercel.sh <that-url>
. "$(dirname "$0")/_common.sh"

[ "${1:-}" = "stop" ] && exec "$(dirname "$0")/stop.sh" tunnel
command -v cloudflared >/dev/null || { echo "install it: brew install cloudflared"; exit 1; }
health >/dev/null || { echo "start the API first: deploy/local-host/start.sh"; exit 1; }
alive "$RUN_DIR/tunnel.pid" && { echo "already running: $(cat "$RUN_DIR/tunnel.url" 2>/dev/null)"; exit 0; }

: > "$LOG_DIR/tunnel.log"
nohup cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" >>"$LOG_DIR/tunnel.log" 2>&1 &
echo $! > "$RUN_DIR/tunnel.pid"

for _ in $(seq 1 30); do
  url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" | head -1 || true)"
  if [ -n "$url" ]; then echo "$url" > "$RUN_DIR/tunnel.url"; echo "$url"; exit 0; fi
  sleep 1
done
echo "no URL after 30s, see $LOG_DIR/tunnel.log"; exit 1
